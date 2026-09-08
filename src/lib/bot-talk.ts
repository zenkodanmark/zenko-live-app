import { heuristicActions, type BotAction } from "./bot-actions.ts";
import { wantsPlanCommit } from "./plan.ts";
import { EMPLOYEES, PROJECTS, projectById } from "./seed.ts";
import type { Employee, Lang, Project } from "./types.ts";

export type TalkTool = "web" | "udbud" | "mail" | "calendar" | "drive";

export type TalkTurn = {
  answer: string;
  drafts: BotAction[];
  execute: boolean;
  tools: TalkTool[];
  offered: TalkTool[];
  notes: string[];
};

const CONFIRM_SHORT =
  /^(ja|ok|okay|godkendt|godkend|udfør|udfor|gør det|gor det|kør|do it|sí|si|tak|yes|da|dobrze)\b/i;

export function wantsArchive(text: string) {
  const q = text.toLowerCase();
  return /arkiv|læg .*på sagen|læg .*ind på|så de ansatte kan/.test(q);
}

export function isConfirm(text: string) {
  const q = text.toLowerCase().trim();
  if (!q) return false;
  if (/ikke endnu|vent|ret først|ikke godkend/.test(q)) return false;
  if (CONFIRM_SHORT.test(q) && q.length < 48) return true;
  return /gør det|udfør det|godkendt|læg det ind|læg det i plan|lig at dette|læg at dette|send det|opret det/.test(q);
}

export function isCorrection(text: string) {
  const q = text.toLowerCase().trim();
  if (/^(nej|ret|rettelse|ændr)\b/.test(q)) return true;
  if (/\d+\s*(mm|cm|kr|m)?\s+(ikke|i stedet)/.test(q)) return true;
  if (/ikke\s+\d+\s*(mm|cm|kr)?/.test(q)) return true;
  return /\b(skal være|i stedet for|ændr(e|et)? til)\b/.test(q);
}

export function speakLang(text: string): Lang {
  if (/[ąćęłńóśźż]/i.test(text) || /\b(co robimy|proszę|zrób|sprawdź)\b/i.test(text)) return "pl";
  if (/[ăâîșț]/i.test(text) || /\b(ce facem|te rog|fă)\b/i.test(text)) return "ro";
  if (/[іїєґ]/i.test(text)) return "uk";
  if (/\b(qué|hacer|hola|gracias|revisa)\b/i.test(text) || /[áéíóúñ¿¡]/.test(text)) return "es";
  return "da";
}

export function detectTools(text: string): TalkTool[] {
  const q = text.toLowerCase();
  const out: TalkTool[] = [];
  if (/udbud|kontrolplan|hvad siger (udbud|kontrakt)|ds\/en|eurocode/.test(q)) out.push("udbud");
  if (/internet|google|leverandør|pris|norm|ds \d|stål i mur|murankre|bindere/.test(q) || /\bsøg\b/.test(q)) out.push("web");
  if (/mail|gmail|indbakke|e-mail/.test(q)) out.push("mail");
  if (/kalender|byggemøde|sikkerhedsmøde|\blin\b|møder/.test(q)) out.push("calendar");
  if (/\bdrive\b|drev|00 admin|felt-indbakke|mappe 0/.test(q)) out.push("drive");
  return [...new Set(out)];
}

export function wantsLookup(text: string) {
  const q = text.toLowerCase();
  return /tjek|check|slå op|\bsøg\b|hvad siger|find (mail|møde|udbud)|kig i/.test(q) || detectTools(text).length > 0;
}

export function applyCorrection(text: string, drafts: BotAction[]): BotAction[] {
  if (!drafts.length) return drafts;
  const q = text.toLowerCase();
  let blob = JSON.stringify(drafts);
  const keepDrop = q.match(/(\d+)\s*mm\s+(?:ikke|i stedet for|fremfor)\s+(\d+)/i);
  const dropKeep = q.match(/ikke\s+(\d+)\s*mm.*?(\d+)\s*mm/i);
  if (keepDrop) blob = blob.replaceAll(keepDrop[2]!, keepDrop[1]!);
  else if (dropKeep) blob = blob.replaceAll(dropKeep[1]!, dropKeep[2]!);
  else {
    const simple = q.match(/(\d+)\s*(?:mm|cm|kr)?\s+(?:ikke|i stedet for)\s+(\d+)/i);
    if (simple) blob = blob.replaceAll(simple[2]!, simple[1]!);
  }
  try {
    const next = JSON.parse(blob) as BotAction[];
    return Array.isArray(next) ? next : drafts;
  } catch {
    return drafts;
  }
}

export function mergeDrafts(old: BotAction[], next: BotAction[]): BotAction[] {
  const out = [...old];
  for (const n of next) {
    const i = out.findIndex((o) => sameDraft(o, n));
    if (i >= 0) out[i] = { ...out[i], ...n } as BotAction;
    else out.push(n);
  }
  return out;
}

function sameDraft(a: BotAction, b: BotAction) {
  if (a.type !== b.type) return false;
  if (a.type === "set_plan" && b.type === "set_plan") return a.employeeId === b.employeeId && a.start === b.start && a.projectId === b.projectId;
  if (a.type === "create_todo" && b.type === "create_todo") return (a.assigneeId ?? "") === (b.assigneeId ?? "") && a.projectId === b.projectId;
  if (a.type === "create_project" && b.type === "create_project") return a.name === b.name;
  if (a.type === "create_tf" && b.type === "create_tf") return true;
  if (a.type === "create_slip" && b.type === "create_slip") return true;
  if (a.type === "create_ks" && b.type === "create_ks") return a.point === b.point;
  return a.type === b.type;
}

function firstName(employees: Employee[], id?: string) {
  const name = id ? employees.find((e) => e.id === id)?.name : "";
  return name ? name.split(" ")[0]! : "";
}

export function labelDraft(a: BotAction, employees: Employee[] = EMPLOYEES, projects: Project[] = PROJECTS): string {
  const job = "projectId" in a && a.projectId ? projects.find((p) => p.id === a.projectId)?.name ?? projectById(a.projectId).name : "";
  const whoId = a.type === "set_plan" ? a.employeeId : a.type === "create_todo" ? a.assigneeId : a.type === "create_chat" ? a.assigneeId : undefined;
  const who = firstName(employees, whoId) || whoId || "";
  if (a.type === "create_tf") return `TF · ${a.title || a.question.slice(0, 48)} · ${job}`;
  if (a.type === "create_todo") return `To-do · ${who || "ansat"} · ${a.title}${a.due ? ` · ${a.due}` : ""}`;
  if (a.type === "set_plan") return `Plan · ${who} · ${job} · ${a.title} ${a.start}–${a.end}`;
  if (a.type === "create_slip") return `Aftaleseddel · ${a.title} · ${job}${a.customerPrice ? ` · ${a.customerPrice}` : ""}`;
  if (a.type === "create_ks") return `KS ${a.point} · ${job}${a.floor ? ` · ${a.floor}` : ""}`;
  if (a.type === "create_ent") return `Entreprenørrapport · ${a.title} · ${job}`;
  if (a.type === "create_note") return `Note · ${job}`;
  if (a.type === "export_hours") return `Timeark · ${a.employeeName ?? "alle"} · ${a.month ?? "periode"}`;
  if (a.type === "create_chat") return `Chat · ${who || "sjak"} · ${a.text.slice(0, 48)}`;
  if (a.type === "draft_mail") return `Mail-kladde · ${a.to} · ${a.subject}`;
  if (a.type === "create_project") return `Ny sag · ${a.name}`;
  return "Udkast";
}

export function draftSummary(drafts: BotAction[], employees?: Employee[], projects?: Project[]) {
  if (!drafts.length) return "";
  if (drafts.length === 1) return `Udkast: ${labelDraft(drafts[0]!, employees, projects)}. Sig ja eller ret.`;
  return `Udkast til ${drafts.length} ting. Sig ja eller ret.`;
}

const OFFER: Record<Lang, string> = {
  da: "Vil du have jeg tjekker udbuddet og normen — så kan vi lave TF og to-do bagefter?",
  es: "¿Quieres que revise el pliego y la norma? Después hacemos TF y to-do.",
  pl: "Sprawdzić ofertę i normę? Potem zrobimy TF i zadanie.",
  ro: "Vrei să verific caietul și norma? Apoi facem TF și to-do.",
  uk: "Перевірити тендер і норму? Потім зробимо TF і завдання.",
  de: "Soll ich Angebot und Norm prüfen? Danach machen wir TF und To-do.",
  en: "Want me to check the tender and the standard? Then we can make a TF and to-do.",
};

const NOTED: Record<Lang, string> = {
  da: "Noteret. Sig til når jeg skal tjekke noget eller lave et udkast.",
  es: "Anotado. Dime cuando deba revisar algo o hacer un borrador.",
  pl: "Zapisane. Daj znać, gdy mam sprawdzić albo zrobić szkic.",
  ro: "Notat. Spune când trebuie să verific sau să fac un ciornă.",
  uk: "Занотовано. Скажи, коли перевірити або зробити чернетку.",
  de: "Notiert. Sag Bescheid, wenn ich etwas prüfen oder einen Entwurf machen soll.",
  en: "Noted. Tell me when to check something or draft it.",
};

const CHECKING: Record<Lang, string> = {
  da: "Jeg tjekker og kommer tilbage.",
  es: "Lo reviso y vuelvo.",
  pl: "Sprawdzam i wracam.",
  ro: "Verific și revin.",
  uk: "Перевіряю і повернусь.",
  de: "Ich prüfe und komme zurück.",
  en: "I'll check and come back.",
};

export function spokenFindings(text: string) {
  const cleaned = text
    .replace(/^(Udbud|Net|Mail|Kalender|Drive\/udbud):\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= 420) return cleaned;
  return `${cleaned.slice(0, 400).replace(/\s+\S*$/, "")}…`;
}

export function afterLookupAnswer(findings: string, notes: string[], lang: Lang = "da") {
  const body = spokenFindings(findings);
  const steel = notes.some((n) => /stål|stal|steel|żelaz|fier/i.test(n)) || /stål|binder|rustfri/i.test(findings);
  const ask =
    lang === "es"
      ? "¿Hago TF a la dirección de obra y un to-do para quitarlo?"
      : lang === "pl"
        ? "Zrobić TF do kierownika i zadanie, żeby to usunąć?"
        : "Skal jeg lave TF til byggeledelsen og to-do til at fjerne det?";
  if (steel) return body ? `${body}\n${ask}` : ask;
  return body || (lang === "da" ? "Jeg fandt ikke noget sikkert. Sig hvad jeg skal oprette." : body);
}

function steelDrafts(projectId: string, notes: string[]): BotAction[] {
  const body = notes.filter(Boolean).slice(-2).join(" — ") || "Gammelt stål i mur. Kan ikke fortsætte.";
  return [
    {
      type: "create_tf",
      projectId,
      title: "Gammelt stål i mur — kan ikke fortsætte",
      question: body,
    },
    {
      type: "create_todo",
      projectId,
      assigneeId: "emp-marius",
      title: `Fjern gammelt stål som ekstra`,
      due: new Date().toISOString().slice(0, 10),
      needsPhoto: true,
    },
  ];
}

export function heuristicTalk(input: {
  query: string;
  photoCount: number;
  drafts: BotAction[];
  offered: TalkTool[];
  notes?: string[];
  employees: Employee[];
  projects: Project[];
}): TalkTurn {
  const q = input.query.trim();
  const lang = speakLang(q);
  const notes = input.notes ?? [];
  const job = input.projects.find((p) => p.status === "active") ?? input.projects[0];
  const empty: TalkTurn = { answer: "", drafts: input.drafts, execute: false, tools: [], offered: [], notes: [] };

  if (isCorrection(q) && input.drafts.length) {
    const drafts = applyCorrection(q, input.drafts);
    return { ...empty, drafts, answer: draftSummary(drafts, input.employees, input.projects) };
  }

  if (isConfirm(q) && q.length < 80) {
    if (input.drafts.length) return { ...empty, execute: true, drafts: input.drafts, answer: "Gør det." };
    if (input.offered.length) return { ...empty, tools: input.offered, answer: CHECKING[lang] };
    if (job && notes.some((n) => /stål|stal|steel|kan ikke komme/i.test(n))) {
      const drafts = steelDrafts(job.id, notes);
      return { ...empty, drafts, answer: draftSummary(drafts, input.employees, input.projects) };
    }
  }

  const tools = detectTools(q);
  if (!wantsArchive(q) && wantsLookup(q) && tools.length) {
    return { ...empty, tools, notes: q ? [q.slice(0, 180)] : [], answer: CHECKING[lang] };
  }

  const heu = heuristicActions(q, input.photoCount, input.employees, input.projects);
  if (heu.actions.length) {
    const drafts = mergeDrafts(input.drafts, heu.actions);
    const go =
      (wantsPlanCommit(q) && drafts.some((a) => a.type === "set_plan" || a.type === "create_project")) ||
      (wantsArchive(q) && drafts.some((a) => a.type === "create_note"));
    return { ...empty, drafts, execute: go, answer: go ? "Gør det." : draftSummary(drafts, input.employees, input.projects) };
  }

  if (/hvad gør vi|hvad gør jeg|kan ikke komme|står fast|problem|stål|stop|acero|żelaz|fier vechi|qué hacemos|co robimy|ce facem/.test(q.toLowerCase())) {
    return {
      ...empty,
      offered: ["udbud", "web"],
      notes: [q.slice(0, 180)],
      answer: OFFER[lang],
    };
  }

  if (q) {
    return { ...empty, notes: [q.slice(0, 180)], answer: NOTED[lang] };
  }
  return empty;
}

export function confirmLine(drafts: BotAction[], employees: Employee[] = EMPLOYEES, numbers: string[] = []) {
  const jobs = drafts.filter((a) => a.type === "create_project");
  const plans = drafts.filter((a) => a.type === "set_plan");
  const notes = drafts.filter((a) => a.type === "create_note");
  if (notes.length && notes.some((a) => a.type === "create_note" && /Zmur|Ztag|udbud|beskriv/i.test(a.body))) {
    return "Murer og tag ligger på Islevvænge. Ansatte kan spørge sag-bot.";
  }
  if (jobs.length || plans.length >= 3) {
    const bits: string[] = [];
    if (jobs.length) bits.push(`${jobs.map((j) => (j.type === "create_project" ? j.name : "")).filter(Boolean).join(", ")} oprettet`);
    if (plans.length) bits.push("planen er lagt");
    const line = bits.join(", ");
    return line ? line.charAt(0).toUpperCase() + line.slice(1) + "." : "Udført.";
  }
  const bits: string[] = [];
  let tfNumber = numbers[0];
  for (const a of drafts) {
    if (a.type === "create_tf") bits.push(tfNumber ? `${tfNumber} oprettet` : "TF oprettet");
    else if (a.type === "create_todo") bits.push(`${firstName(employees, a.assigneeId) || "ansat"} har to-doen`);
    else if (a.type === "set_plan") bits.push(`plan på ${firstName(employees, a.employeeId) || "ansat"}`);
    else if (a.type === "create_slip") bits.push("aftaleseddel oprettet");
    else if (a.type === "create_ks") bits.push(`KS ${a.point}`);
    else if (a.type === "export_hours") bits.push("timeark klar");
    else if (a.type === "create_chat") bits.push("besked sendt");
    else if (a.type === "draft_mail") bits.push("mail-kladde klar");
    else if (a.type === "create_project") bits.push(`${a.name} oprettet`);
  }
  const line = bits.filter(Boolean).join(", ");
  return line ? line.charAt(0).toUpperCase() + line.slice(1) + "." : "Udført.";
}
