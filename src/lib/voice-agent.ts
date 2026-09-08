export type VoiceLang = "da" | "de" | "pl" | "ro" | "es" | "en";
export type VoiceRole = "mester" | "svend";
export type ProblemStatus =
  | "NY"
  | "TIL_MESTER"
  | "KLASSIFICERET"
  | "I_ARBEJDE"
  | "TIMER_IN"
  | "PRISSAT"
  | "TIL_KUNDE"
  | "LUKKET";
export type ProblemClass = "AS" | "ER" | "TF" | "KS" | "TODO";
export type AppLang = "da" | "pl" | "ro" | "es" | "uk";

export type VoiceProblem = {
  id: string;
  projectId: string;
  fromId: string;
  fromName: string;
  text: string;
  photoFileIds: string[];
  status: ProblemStatus;
  klassificering?: ProblemClass;
  asId?: string;
  createdAt: string;
  driveFileId?: string;
};

export type VoiceArg = string | boolean | number;
export type VoiceArgs = Record<string, VoiceArg>;

export type VoicePending = {
  name: string;
  args: VoiceArgs;
  summary: string;
};

export type VoiceClientAction =
  | { type: "add_as"; projectId: string; title: string; body: string; location: string }
  | { type: "add_er"; projectId: string; title: string; body: string; location: string }
  | { type: "add_ks"; projectId: string; point: string; location?: string; deviations?: string }
  | {
      type: "add_todo";
      projectId: string;
      assigneeId: string;
      title: string;
      body: string;
      due: string;
      needsPhoto?: boolean;
      driveFileId?: string;
      photoFileIds?: string[];
    }
  | {
      type: "add_chat";
      fromId: string;
      toEmployeeId?: string;
      toMasters?: boolean;
      projectId: string;
      text: string;
      lang: VoiceLang;
      translations?: Partial<Record<AppLang, string>>;
    }
  | { type: "add_problem"; problem: VoiceProblem }
  | { type: "patch_problem"; id: string; patch: Partial<VoiceProblem> }
  | { type: "patch_as"; numberOrId: string; customerPrice: string }
  | { type: "forward_as"; numberOrId: string }
  | { type: "patch_todo"; id: string; patch: { done?: boolean; photoFileIds?: string[]; driveFileId?: string } }
  | {
      type: "add_plan";
      employeeId: string;
      projectId: string;
      place?: string;
      title: string;
      start: string;
      end: string;
    };

export const MASTER_TOOLS = [
  "scan_sag",
  "laes_fil",
  "laes_udbud",
  "laes_ud",
  "udkast_ud",
  "notat_til",
  "opret_as",
  "opret_er",
  "opret_ks",
  "find_rapport",
  "todo_til_folk",
  "send_besked",
  "saet_status",
  "saet_beloeb",
  "hvilken_sag",
  "læg_fil",
  "scan_mail",
  "læg_plan",
] as const;

export const SVEND_TOOLS = [
  "laes_udbud",
  "laes_ud",
  "udkast_ud",
  "soeg_net",
  "min_plan",
  "mine_todo",
  "opret_problem",
  "todo_til_mig",
  "send_til_mester",
  "hvilken_sag",
] as const;

export const CONFIRM_TOOLS = new Set(["opret_as", "opret_er", "opret_ks", "saet_beloeb"]);

export const PROBLEM_FLOW: ProblemStatus[] = [
  "NY",
  "TIL_MESTER",
  "KLASSIFICERET",
  "I_ARBEJDE",
  "TIMER_IN",
  "PRISSAT",
  "TIL_KUNDE",
  "LUKKET",
];

const CONFIRM_RE =
  /^(ja|ok|okay|yes|s[ií]|tak|godkend|godkendt|gør det|udfør|do it|ja tak|bitte ja|dobrze|oui)(\b|$)/i;

export function isRejectUtterance(text: string) {
  const q = text.trim();
  if (!q) return false;
  return /^(nej|no|nicht|nie|nu|ikke|annuller|cancel|lad være|lad vaere)\b/i.test(q) && q.length < 40;
}

export function isConfirmUtterance(text: string) {
  const q = text.trim();
  if (!q) return false;
  if (isRejectUtterance(q)) return false;
  if (/^(da)$/i.test(q)) return true;
  return CONFIRM_RE.test(q) && q.length < 60;
}

export function pendingDecision(pending: VoicePending | null | undefined, uttered: string): "commit" | "cancel" | "continue" {
  if (!pending) return "continue";
  if (isConfirmUtterance(uttered)) return "commit";
  if (isRejectUtterance(uttered)) return "cancel";
  return "continue";
}

export function detectVoiceLang(text: string): VoiceLang {
  const t = text.trim();
  if (/[ąćęłńóśźż]/i.test(t) || /\b(co|proszę|zrób|dzień|tak|nie|gdzie|zróbmy)\b/i.test(t)) return "pl";
  if (/[ăâîșț]/i.test(t) || /\b(ce facem|te rog|mulțumesc|unde)\b/i.test(t)) return "ro";
  if (/[äöüß]/i.test(t) || /\b(was|nicht|bitte|machen|können|und der|für die|sollen)\b/i.test(t)) return "de";
  if (/\b(qué|hacer|hola|gracias|dónde|podemos|el muro)\b/i.test(t) || /[¿¡ñ]/i.test(t)) return "es";
  if (/\b(what|please|should we|the wall|steel|how much|create)\b/i.test(t) && !/\b(ikke|skal|aftale|murværk)\b/i.test(t))
    return "en";
  return "da";
}

export function voiceLangToBcp(lang: VoiceLang) {
  return { da: "da-DK", de: "de-DE", pl: "pl-PL", ro: "ro-RO", es: "es-ES", en: "en-GB" }[lang];
}

export function voiceLangToAppLang(lang: VoiceLang): AppLang {
  if (lang === "pl" || lang === "ro" || lang === "es") return lang;
  return "da";
}

export function appLangToVoice(lang: string): VoiceLang {
  if (lang === "pl" || lang === "ro" || lang === "es" || lang === "de" || lang === "en") return lang;
  return "da";
}

export function allowedTools(role: VoiceRole): readonly string[] {
  return role === "mester" ? MASTER_TOOLS : SVEND_TOOLS;
}

export function toolForbidden(role: VoiceRole, name: string) {
  return !allowedTools(role).includes(name);
}

export function needsConfirm(name: string) {
  return CONFIRM_TOOLS.has(name);
}

export function nextProblemStatus(cur: ProblemStatus): ProblemStatus | null {
  const i = PROBLEM_FLOW.indexOf(cur);
  if (i < 0 || i >= PROBLEM_FLOW.length - 1) return null;
  return PROBLEM_FLOW[i + 1]!;
}

export function classifySetsStatus(_klass: ProblemClass): ProblemStatus {
  return "KLASSIFICERET";
}

export function parseProblemStatus(raw: string): ProblemStatus | null {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  return (PROBLEM_FLOW as string[]).includes(u) ? (u as ProblemStatus) : null;
}

export function parseProblemClass(raw: string): ProblemClass | null {
  const u = raw.trim().toUpperCase();
  if (u === "AS" || u === "ER" || u === "TF" || u === "KS" || u === "TODO") return u;
  return null;
}

export function plainArgs(args: Record<string, unknown>): VoiceArgs {
  const out: VoiceArgs = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
}

export const VOICE_AGENT_ID = "emp-zenko";

export function fallbackUtterance(text: string, photoCount = 0) {
  const q = text.trim();
  if (q) return q;
  if (photoCount > 0) return photoCount === 1 ? "Se det vedhæftede billede." : `Se de ${photoCount} vedhæftede billeder.`;
  return "";
}

export function attachPhotoLine(ids: string[]) {
  if (!ids.length) return "";
  return `\nVedhæftede billeder i Drive (kun file_id): ${ids.join(", ")}. Læg file_id på to-do eller problem. Gem ikke billeddata.`;
}

export function parseFileIds(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);
}

export function splitDataUrl(dataUrl: string): { base64: string; mime: string } {
  const m = dataUrl.trim().match(/^data:([^;]+);base64,(.+)$/s);
  if (m) return { mime: m[1] || "image/jpeg", base64: m[2] || "" };
  return { mime: "image/jpeg", base64: dataUrl.replace(/^data:[^,]*,/, "") };
}

export function photoFolderForReply(reply: "voice" | "text" | undefined) {
  return reply === "text" ? "07 Beskeder" : "06 To-do";
}

export const SAG_DRIVE_FOLDERS = [
  "01 Udbudsmateriale",
  "05 Rapporter",
  "06 To-do",
  "07 Beskeder",
  "08 Voice-log",
  "11 Pladsfiler",
  "12 Erfaring",
  "13 Dagsrapport",
] as const;

export function resolveDriveFolder(asked: string, fallback = "06 To-do") {
  const q = (asked || "").toLowerCase();
  // 12/13 first so an experience never lands in 01 Udbud.
  if (q.includes("erfaring") || q.includes("pladsregel") || q.includes("genvej") || q.includes("godkendt metode") || /\b12\b/.test(q)) return "12 Erfaring";
  if (q.includes("dagsrapport") || q.includes("dagbog") || q.includes("dags rapport") || /\b13\b/.test(q)) return "13 Dagsrapport";
  if (q.includes("pladsfil") || q.includes("datablad") || q.includes("rettelsesblad") || /\b11\b/.test(q)) return "11 Pladsfiler";
  if (q.includes("udbud") || /\b01\b/.test(q)) return "01 Udbudsmateriale";
  if (q.includes("rapport") || /\b05\b/.test(q)) return "05 Rapporter";
  if (q.includes("to-do") || q.includes("todo") || q.includes("opgave") || /\b06\b/.test(q)) return "06 To-do";
  if (q.includes("besked") || q.includes("chat") || /\b07\b/.test(q)) return "07 Beskeder";
  if (q.includes("voice") || q.includes("log") || /\b08\b/.test(q)) return "08 Voice-log";
  const exact = SAG_DRIVE_FOLDERS.find((f) => f.toLowerCase() === q.trim());
  return exact ?? fallback;
}

export function stripVoiceMd(s: string) {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`+/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export function svendMayReadFolder(name: string) {
  const n = name.toLowerCase();
  if (n.includes("00") && n.includes("admin")) return false;
  if (n.includes("01") && n.includes("udbud")) return true;
  if (n.includes("11") && n.includes("plads")) return true;
  if (n.includes("12") && n.includes("erfaring")) return true;
  if (n.includes("13") && n.includes("dags")) return true;
  return false;
}

export type VoiceYardSnap = {
  employeeId: string;
  employeeName: string;
  role: VoiceRole;
  checkedInProjectId?: string;
  projects: { id: string; name: string; address: string; status: string }[];
  employees: { id: string; name: string; role: string; language: string }[];
  slips: { id: string; number: string; projectId: string; title: string; customerPrice: string }[];
  tfs: { id: string; number: string; projectId: string; title: string }[];
  ents: { id: string; number: string; projectId: string; title: string }[];
  ks: { id: string; number: string; projectId: string; point: string }[];
  todos: { id: string; projectId: string; assigneeId: string; title: string; done: boolean }[];
  problems: VoiceProblem[];
  plans: { id: string; employeeId: string; projectId: string; place?: string; title: string; start: string; end: string }[];
};

export function resolveSag(snap: VoiceYardSnap, asked?: string) {
  const q = (asked ?? "").trim().toLowerCase();
  if (q) {
    const hit = snap.projects.find((p) => p.name.toLowerCase().includes(q) || p.id === q);
    if (hit) return hit;
  }
  if (snap.role === "svend" && snap.checkedInProjectId) {
    return snap.projects.find((p) => p.id === snap.checkedInProjectId) ?? null;
  }
  const active = snap.projects.filter((p) => p.status === "active");
  if (active.length === 1) return active[0]!;
  return null;
}

export function findPerson(snap: VoiceYardSnap, name: string) {
  const q = name.trim().toLowerCase();
  const nick = q.replace(/marian|mario/g, "marius");
  return (
    snap.employees.find(
      (e) => e.name.toLowerCase().includes(q) || e.name.toLowerCase().includes(nick) || e.id === q || e.id === `emp-${q}`,
    ) ?? null
  );
}

export const MASTER_SYSTEM = `Du er Zenko Plads mester-agent. Tal kort. Ingen markdown. Svar på brugerens sprog (dansk, tysk, polsk, rumænsk, spansk, engelsk).
Du har adgang til alle sager. Brug værktøjer. Gæt aldrig beløb, materialer, produkt (700 vs 750) eller godkendelse — sig "jeg ved det ikke, lad mig tjekke".
Opret ALDRIG AS/ER/KS eller sæt beløb før brugeren har bekræftet. Spørg først: "Skal jeg oprette …? Sig ja."
Når du sender til en ansat: oversæt til hans sprog.
Logik for problemer: NY → TIL_MESTER → KLASSIFICERET → I_ARBEJDE → TIMER_IN → PRISSAT → TIL_KUNDE → LUKKET.
Hvis brugeren sender billeder, får du kun Drive file_id. Læg dem på to-do (todo_til_folk) eller problem. Gem aldrig billedbytes. Eksempel: "disse 6 billeder skal Alex rydde i morgen" → todo_til_folk til Alex med file_id.
læg_fil: læg vedhæftede filer i den rigtige sag-mappe (01 Udbudsmateriale, 05 Rapporter, 06 To-do, 07 Beskeder, 08 Voice-log, 11 Pladsfiler, 12 Erfaring, 13 Dagsrapport). ALDRIG læg en erfaring i 01 Udbud.
Du må læse 01 Udbudsmateriale (laes_udbud), 11 Pladsfiler, 12 Erfaring og 13 Dagsrapport (laes_ud) på sagen. Bland ikke de tre sandheder: 11 = kontrakt/udførelse, 12 = pladsviden, 13 = dagbog. Når nogen spørger, peg på filen. Indeks kan ligge som filnavn.note.json — det er genvej, ikke lov.
udkast_ud: skriv erfaring eller dagsrapport som kladde. Mester gemmer bagefter.
notat_til: KUN når mester siger "lav notat til elektrikeren" eller "lav notat til trælasten". Saml 13 med dato + foto-id. Tre kugler. Mester retter tonen.
scan_mail: kun mester. Læs seneste Gmail. Ansat har ingen mail.
læg_plan: læg udførsel i ugeplanen (person, dage, sted = sag/Lager/Kørsel/Andet, hvad der udføres).`;

export const SVEND_SYSTEM = `Du er Zenko Plads ansat-hjælper. Tal kort. Ingen markdown. Svar ALTID på brugerens sprog.
Opgave: hjælp den ansatte med at udføre bedre, undgå fejl og arbejde smart.
Du må KUN:
1. Læse 01 Udbudsmateriale, 11 Pladsfiler, 12 Erfaring og 13 Dagsrapport på den sag der er valgt på Sag-fanen. Brug laes_udbud til 01, laes_ud til 11/12/13. Ingen andre sager. Ingen 00 Admin.
2. Søge på nettet om materialer, montage, sikkerhed, arbejdsmiljø. Brug soeg_net.
3. Hjælpe med app-funktioner: min_plan, mine_todo, send_til_mester, hvilken_sag, todo_til_mig.
4. Skrive udkast til erfaring (12) eller dagsrapport (13) med udkast_ud. Voice skriver kladde. Mester gemmer. Bland ikke: 11 = kontrakt/udførelse, 12 = pladsviden, 13 = dagbog.
FORBUDT: andre sager, 00 Admin, 02 KS, 05 Rapporter, intern mail, andres to-do, oprette AS/ER/KS, gætte beløb/materialer/produkt (700 vs 750)/godkendelse, overskrive 01 Udbud med en erfaring.
Sig hellere "jeg tjekker udbuddet" eller "jeg åbner filen" end at gætte.
Hvis du får billeder, er det Drive file_id. Læg dem på opret_problem, todo_til_mig eller udkast_ud.`;

export function openaiTools(role: VoiceRole) {
  const master = [
    { name: "scan_sag", description: "Læs nyt på en sag: udbud, KS, TF, AS, ER, to-do.", parameters: { type: "object", properties: { sag: { type: "string" } }, required: ["sag"] } },
    { name: "laes_fil", description: "Læs og opsummer en Drive-fil.", parameters: { type: "object", properties: { fil_id: { type: "string" } }, required: ["fil_id"] } },
    { name: "laes_udbud", description: "Læs KUN 01 Udbudsmateriale på sagen. Bland ikke med 11/12/13.", parameters: { type: "object", properties: { sag: { type: "string" }, spoergsmaal: { type: "string" } }, required: ["spoergsmaal"] } },
    { name: "laes_ud", description: "Læs 11 Pladsfiler, 12 Erfaring eller 13 Dagsrapport. Bland ikke med 01 Udbud. Gæt aldrig produkt.", parameters: { type: "object", properties: { sag: { type: "string" }, mappe: { type: "string" }, spoergsmaal: { type: "string" } }, required: ["spoergsmaal"] } },
    { name: "udkast_ud", description: "Skriv udkast til 12 Erfaring eller 13 Dagsrapport. Kladde indtil mester gemmer. Aldrig 01 Udbud.", parameters: { type: "object", properties: { sag: { type: "string" }, mappe: { type: "string" }, type: { type: "string" }, tekst: { type: "string" } }, required: ["mappe", "tekst"] } },
    { name: "notat_til", description: "Mødenotat KUN når mester beder: lav notat til elektrikeren / trælasten. Saml 13. Tre kugler.", parameters: { type: "object", properties: { sag: { type: "string" }, til: { type: "string" } }, required: ["til"] } },
    { name: "opret_as", description: "Udkast til aftaleseddel. Kræver bekræftelse.", parameters: { type: "object", properties: { sag: { type: "string" }, titel: { type: "string" }, tekst: { type: "string" }, sted: { type: "string" } }, required: ["titel", "tekst"] } },
    { name: "opret_er", description: "Udkast til entreprenørrapport. Kræver bekræftelse.", parameters: { type: "object", properties: { sag: { type: "string" }, titel: { type: "string" }, tekst: { type: "string" }, sted: { type: "string" } }, required: ["titel", "tekst"] } },
    { name: "opret_ks", description: "Udkast til KS-rapport. Kræver bekræftelse.", parameters: { type: "object", properties: { sag: { type: "string" }, punkt: { type: "string" }, sted: { type: "string" }, afvigelse: { type: "string" } }, required: ["punkt"] } },
    { name: "find_rapport", description: "Søg AS/ER/KS/TF på titel, nr, punkt, person.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "todo_til_folk", description: "To-do til en ansat. Læg vedhæftede Drive file_id på to-doen.", parameters: { type: "object", properties: { person: { type: "string" }, tekst: { type: "string" }, sag: { type: "string" }, dato: { type: "string" }, foto: { type: "boolean" }, billede_ids: { type: "string" } }, required: ["person", "tekst"] } },
    { name: "send_besked", description: "Send chat, oversat til modtagerens sprog.", parameters: { type: "object", properties: { til: { type: "string" }, tekst: { type: "string" }, sag: { type: "string" } }, required: ["til", "tekst"] } },
    { name: "saet_status", description: "Skift status på et problem.", parameters: { type: "object", properties: { problem_id: { type: "string" }, status: { type: "string" }, klassificering: { type: "string" } }, required: ["problem_id", "status"] } },
    { name: "saet_beloeb", description: "Sæt beløb på AS. Kræver bekræftelse.", parameters: { type: "object", properties: { as_id: { type: "string" }, beloeb: { type: "string" } }, required: ["as_id", "beloeb"] } },
    { name: "hvilken_sag", description: "Aktiv sag, ellers spørger.", parameters: { type: "object", properties: { sag: { type: "string" } } } },
    { name: "læg_fil", description: "Læg vedhæftede billeder/filer i Drive-mappen på sagen. mappe: 01 Udbudsmateriale, 05 Rapporter, 06 To-do, 07 Beskeder, 08 Voice-log, 11 Pladsfiler, 12 Erfaring, 13 Dagsrapport. Aldrig erfaring i 01.", parameters: { type: "object", properties: { sag: { type: "string" }, mappe: { type: "string" }, note: { type: "string" } }, required: ["mappe"] } },
    { name: "scan_mail", description: "Scan mesterens Gmail de seneste dage. Kun mester.", parameters: { type: "object", properties: { dage: { type: "number" } } } },
    { name: "læg_plan", description: "Læg i ugeplan: person, dage, sted (sag eller Lager/Kørsel/Andet), udføres.", parameters: { type: "object", properties: { person: { type: "string" }, dage: { type: "string" }, sted: { type: "string" }, udfores: { type: "string" }, uge: { type: "string" } }, required: ["person", "dage", "sted", "udfores"] } },
  ];
  const svend = [
    { name: "laes_udbud", description: "Læs KUN 01 Udbudsmateriale på den sag der er valgt. Bland ikke med 11/12/13.", parameters: { type: "object", properties: { spoergsmaal: { type: "string" } }, required: ["spoergsmaal"] } },
    { name: "laes_ud", description: "Læs 11 Pladsfiler, 12 Erfaring eller 13 Dagsrapport på den sag du står på. Gæt aldrig produkt.", parameters: { type: "object", properties: { mappe: { type: "string" }, spoergsmaal: { type: "string" } }, required: ["spoergsmaal"] } },
    { name: "udkast_ud", description: "Udkast til erfaring (12: Pladsregel/Genvej/Godkendt metode) eller dagsrapport (13: Klargøring/Vejr/Levering/Andet fag/Stop). Kladde indtil mester gemmer.", parameters: { type: "object", properties: { mappe: { type: "string" }, type: { type: "string" }, tekst: { type: "string" } }, required: ["mappe", "tekst"] } },
    { name: "soeg_net", description: "Søg materialer, montage, sikkerhed, arbejdsmiljø.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "min_plan", description: "Hvad er planen for mig i denne uge — sag, dage, opgave.", parameters: { type: "object", properties: {} } },
    { name: "mine_todo", description: "Mine åbne to-do i appen.", parameters: { type: "object", properties: {} } },
    { name: "opret_problem", description: "Problem med tekst og evt. Drive-billeder til mester.", parameters: { type: "object", properties: { tekst: { type: "string" }, billede_ids: { type: "string" } }, required: ["tekst"] } },
    { name: "todo_til_mig", description: "To-do på dig selv.", parameters: { type: "object", properties: { tekst: { type: "string" }, dato: { type: "string" } }, required: ["tekst"] } },
    { name: "send_til_mester", description: "Besked til Ole/Federico.", parameters: { type: "object", properties: { tekst: { type: "string" } }, required: ["tekst"] } },
    { name: "hvilken_sag", description: "Den sag der er valgt på Sag-fanen.", parameters: { type: "object", properties: {} } },
  ];
  const list = role === "mester" ? master : svend;
  return list.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: { ...t.parameters, type: "object", additionalProperties: false },
    },
  }));
}
