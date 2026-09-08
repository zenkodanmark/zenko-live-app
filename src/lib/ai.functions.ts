import { createServerFn } from "@tanstack/react-start";
import {
  diffChanges,
  fieldGuide,
  heuristicFix,
  mergePatches,
  parseModelPatch,
  snapshotOf,
  summarizePatch,
  type FixChange,
  type FixPatch,
  type FixSnapshot,
  type ReportFixKind,
} from "./report-fix";
import { controlPlanFor, FLOORS, ROOMS, copenhagenDate } from "./seed";
import type { Lang } from "./types";
import { extractJsonObject, grokChat, grokChatWeb } from "./grok-chat";
import { UDBUD_CORPUS, snippetFromCorpus } from "./udbud-corpus";
import { briefMailItems, mailSnapshot } from "./mail.snapshot";
import { afterLookupAnswer, heuristicTalk, isConfirm, speakLang, type TalkTool } from "./bot-talk";
import { sanitizeActions } from "./bot-actions";
import { addDaysYmd, startOfIsoWeek } from "./plan";

import { LANG_IDS } from "./i18n";

function apiKey() {
  return process.env.XAI_API_KEY?.trim() || "";
}

export const translateMessage = createServerFn({ method: "POST" })
  .validator((input: { text: string; from: Lang }) => input)
  .handler(async ({ data }) => {
    const from = data.from;
    const text = data.text.slice(0, 800);
    const fallback: Partial<Record<Lang, string>> = { [from]: data.text, da: data.text };
    try {
      const raw = await grokChat({
        system: `You translate short messages for a Danish masonry crew (Zenko).
The source language is ${from} (the sender's profile language). Do NOT detect or guess another language from the sentence.
NEVER translate job names, street addresses, report numbers or point codes (examples: Hillerødsholm, Kærhuset, Jyderup, Selskovvej 24, 10.02.04, Z-KS-2026-003, Z-AS-2026-001). Keep product names and measures as written.
Return ONLY JSON with keys da,ro,pl,uk,de,en,es — the same meaning in every language.`,
        user: `From ${from}:\n${text}`,
        maxTokens: 700,
        timeoutMs: 18000,
        temperature: 0,
      });
      if (!raw) return { ok: false as const, translations: fallback };
      const json = extractJson(raw);
      const translations: Partial<Record<Lang, string>> = {};
      for (const lang of LANG_IDS) {
        const v = json[lang];
        if (typeof v === "string" && v.trim()) translations[lang] = v.trim();
      }
      if (!translations[from]) translations[from] = data.text;
      const daOk = from === "da" || Boolean(translations.da && translations.da !== data.text);
      if (!daOk) return { ok: false as const, translations: { ...fallback, ...translations } };
      return { ok: true as const, translations };
    } catch {
      return { ok: false as const, translations: fallback };
    }
  });

export const transcribeClip = createServerFn({ method: "POST" })
  .validator((input: { audioBase64: string; mime: string; language?: string }) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available" };
    let buf: Buffer;
    try {
      buf = Buffer.from(data.audioBase64, "base64");
    } catch {
      return { ok: false as const, error: "bad audio" };
    }
    if (buf.length < 200) return { ok: false as const, error: "empty clip" };
    if (buf.length > 2_400_000) return { ok: false as const, error: "clip too long" };
    const mime = data.mime || "audio/webm";
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    if (data.language) form.append("language", data.language);
    form.append("format", "true");
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `clip.${ext}`);
    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) return { ok: false as const, error: `xAI STT ${res.status}` };
    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false as const, error: "empty transcript" };
    return { ok: true as const, text };
  });

export const speakTranslation = createServerFn({ method: "POST" })
  .validator((input: { text: string; lang: Lang }) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available" };
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        text: data.text.slice(0, 600),
        voice_id: "eve",
        language: data.lang,
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI TTS ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 80) return { ok: false as const, error: "empty audio" };
    return { ok: true as const, audio: `data:audio/mpeg;base64,${buf.toString("base64")}` };
  });

export const recognizeKsPhoto = createServerFn({ method: "POST" })
  .validator((input: { dataUrl: string; projectId: string; hint?: string }) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available" };
    if (!data.dataUrl.startsWith("data:image") || data.dataUrl.length > 900_000) {
      return { ok: false as const, error: "image too large" };
    }
    const plan = controlPlanFor(data.projectId)
      .map((p) => `${p.code} ${p.title} — ${p.hint}`)
      .join("\n");
    const prompt = `You classify a masonry quality-control photo for Zenko Danmark.
Project control plan:
${plan}

Also allowed: "div" = extra work / cannot tell / not a KS point.
Floors: ${FLOORS.join(", ")}
Places: ${ROOMS.join(", ")}

Hint from the worker (speech or text, may be another language): ${data.hint ?? "none"}

The worker does NOT pick the KS point. You and the master do.
Return ONLY JSON: {"point":"5.3"|"div"|code, "label":"short da", "confidence":0-1, "reason":"one sentence da", "floor":"1. sal"|string, "room":"Altan"|string}
If balcony repair / hole in brick: 5.4.
If plaster/filsning/vange: 5.5.
If chimney joints / pointing / udkasning: 5.7.
If insulation/blown wool/cavity: 5.3 (Hillerødsholm) or 3.1 (generic).
If extra work (sills, scaffolding, materials, unrelated): div.`;

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 220,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: data.dataUrl } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const json = extractJson(body.choices?.[0]?.message?.content ?? "");
    const point = typeof json.point === "string" ? json.point : "div";
    const codes = new Set(["div", ...controlPlanFor(data.projectId).map((p) => p.code)]);
    const floors = FLOORS as readonly string[];
    const rooms = ROOMS as readonly string[];
    const floor = typeof json.floor === "string" && floors.includes(json.floor) ? json.floor : "";
    const room = typeof json.room === "string" && rooms.includes(json.room) ? json.room : "";
    return {
      ok: true as const,
      point: codes.has(point) ? point : "div",
      label: typeof json.label === "string" ? json.label : "",
      confidence: typeof json.confidence === "number" ? json.confidence : 0,
      reason: typeof json.reason === "string" ? json.reason : "",
      floor,
      room,
    };
  });

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const v = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const applyReportFix = createServerFn({ method: "POST" })
  .validator((input: { kind: ReportFixKind; instruction: string; report: Record<string, string | number | boolean | null> }) => input)
  .handler(async ({ data }) => {
    const kind = data.kind;
    const instruction = data.instruction.trim().slice(0, 2000);
    const empty = { ok: false as const, error: "empty", patch: {} as FixPatch, summary: "", changes: [] as FixChange[] };
    if (!instruction) return empty;
    const snapshot = snapshotOf(kind, data.report);
    const fallback = () => {
      const patch = heuristicFix(kind, instruction, snapshot);
      return pack(patch, snapshot, Object.keys(patch).length ? summarizePatch(patch) : "Jeg kunne ikke se hvad der skal rettes. Beskriv titel, sted, tekst og pris.");
    };
    const key = apiKey();
    if (!key) return fallback();

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 1200,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Du er Zenko Danmarks ret-bot. Mester beskriver ALLE fejl på en murerrapport. Du retter ALLE nævnte felter — aldrig kun prisen.

Rapporttype: ${kind}
Felter: ${fieldGuide(kind)}
slip = aftaleseddel. tf = teknisk forespørgsel. ent = entreprenørrapport. ks = proceskontrol. pack = fakturabilag.

Returner KUN JSON med:
- "summary": én dansk sætning om hvad du rettede
- hvert felt du ændrer, som nøgler på topniveau (title, body, location, …) ELLER samlet under "patch"

Regler:
- Ret ALT mester nævner: titel, lokation, etage, rum, beskrivelse, spørgsmål, svar, pris, timer, materialer, KS-punkt, sjak, afvigelser, kunde-bemærkning.
- Hvis de nævner flere ting, SKAL patchen indeholde flere felter. En pris alene er forkert hvis de også talte om titel eller tekst.
- customerPrice som "4.800 kr". hoursEst som tal. approved som true/false.
- Hvis de siger at beskrivelsen skal NÆVNE noget, omskriv body/question/masterSolution så indholdet er med, uden at smide øvrige fakta.
- Hvis de giver ny fuld tekst, erstat feltet.
- KS-punkt er koder som 5.4, 5.5, 5.7.
- Ret ikke felter de ikke nævner. Tøm ikke felter.
- Ingen markdown.`,
            },
            {
              role: "user",
              content: `Nuværende rapport:\n${JSON.stringify(snapshot).slice(0, 4000)}\n\nRettelser fra mester:\n${instruction}`,
            },
          ],
        }),
      });
      if (!res.ok) return fallback();
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = parseModelPatch(body.choices?.[0]?.message?.content ?? "", kind, snapshot);
      const merged = mergePatches(heuristicFix(kind, instruction, snapshot), parsed.patch);
      if (!Object.keys(merged).length) return fallback();
      return pack(merged, snapshot, parsed.summary || summarizePatch(merged));
    } catch {
      return fallback();
    }
  });

function pack(patch: FixPatch, snapshot: FixSnapshot, summary: string) {
  const changes = diffChanges(snapshot, patch);
  return { ok: true as const, patch, summary, changes };
}

export type MesterYard = {
  projectId: string;
  projectName: string;
  huddle: string;
  onSite: string[];
  issues: string[];
  slips: string[];
  tfs: string[];
  todos: string[];
  plans?: string[];
  hours: string;
  employees: string[];
  projects: { id: string; name: string }[];
  photoCount: number;
};

export const askMesterBot = createServerFn({ method: "POST" })
  .validator((input: { query: string; yard: MesterYard; history?: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim();
    const empty = { ok: false as const, answer: "", actions: [] as Record<string, string>[] };
    if (!query) return empty;
    const y = data.yard;
    const corpus = (UDBUD_CORPUS[y.projectId] ?? []).map((r) => `### ${r.name}\n${r.text.slice(0, 2200)}`).join("\n").slice(0, 6000);
    const mail = mailSnapshot(y.projectId, y.projectName);
    const mailBrief = briefMailItems(mail.items, y.projectName);
    const context = [
      `Aktiv sag: ${y.projectName} (${y.projectId})`,
      `Projekter: ${y.projects.map((p) => `${p.id}=${p.name}`).join(", ")}`,
      `Ansatte: ${y.employees.join(", ")}`,
      `Huddle: ${y.huddle}`,
      `På plads: ${y.onSite.join(", ") || "ingen"}`,
      `Åbne beskeder: ${y.issues.join(" | ") || "ingen"}`,
      `Aftalesedler: ${y.slips.join(" | ") || "ingen"}`,
      `TF: ${y.tfs.join(" | ") || "ingen"}`,
      `Opgaver: ${y.todos.join(" | ") || "ingen"}`,
      `Ugeplan: ${y.plans?.join(" | ") || "ingen"}`,
      `Timer i systemet:\n${y.hours || "ingen"}`,
      `Billeder vedhæftet nu: ${y.photoCount}`,
      `Mail-overblik:\n${mailBrief}`,
      corpus ? `Udbud (uddrag):\n${corpus}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const raw = await grokChat({
      system: `Du er mester-assistent for Zenko Danmark. Du UDFØRER handlinger — du er ikke et skema.
Svar på dansk. Returner KUN JSON:
{"answer":"hvad du gør, konkret","actions":[...]}

Handlingstyper:
- create_ks {type, projectId, point, floor, room, deviations} — KS-rapport. Altaner/reparation = 5.4, fils/vange = 5.5, skorsten/omfug = 5.7, hulmur = 5.3. Brug billederne mester lagde.
- create_slip {type, projectId, title, location, body, customerPrice}
- create_tf {type, projectId, title, question}
- create_ent {type, projectId, title, location, body}
- create_todo {type, projectId, title, assigneeId, due, needsPhoto}
- set_plan {type, employeeId, projectId, title, start, end} start/end YYYY-MM-DD. Læg udførsel i ugeplanen og opret to-do.
- create_note {type, projectId, body}
- export_hours {type, employeeName, projectId, month} — month som "2025-12". Gør det når de vil have timer, liste, ark, csv, download, løn.

Regler:
- Når mester siger planen (hvem, sag, dage, hvad): ALTID set_plan + create_todo til hver nævnt ansat. employeeId er emp-alex, emp-ion, emp-marius, emp-osvaldo.
- Hvis de lægger billeder og siger KS / altan / fils / skorsten: ALTID create_ks. Gæt ikke. Gør det.
- Hvis de beder om timer/ark/csv: ALTID export_hours. Brug navn og sag fra spørgsmålet. December i 2026-spørgsmål før december-måned = 2025-12.
- projectId SKAL være et id fra listen (job-hillerodsholm, job-islevvaenge, job-kaerhuset, job-solbakkegaard, job-klostergaarden, job-provestenen, job-soren-privat). Strandvejen 84 = job-provestenen. Ruskær 35 = job-kaerhuset.
- Flere handlinger er tilladt.
- Hvis de kun spørger (udbud, mail, hvem mangler KS), actions = [] og svar med data fra konteksten.`,
      user: `${context}\n\nMester: ${query.slice(0, 800)}`,
      history: data.history,
      maxTokens: 800,
      timeoutMs: 20000,
    });
    if (!raw) return { ok: true as const, answer: "", actions: [] as Record<string, string>[] };
    const json = extractJsonObject(raw);
    const answer = typeof json.answer === "string" ? json.answer.trim() : raw.replace(/```json|```/g, "").trim();
    const actions = Array.isArray(json.actions) ? (json.actions as Record<string, string>[]) : [];
    return { ok: true as const, answer, actions };
  });

export type TalkBotIn = {
  query: string;
  yard: MesterYard;
  history?: { role: "user" | "assistant"; content: string }[];
  drafts?: unknown[];
  offered?: TalkTool[];
  notes?: string[];
  photoCount?: number;
};

export const talkMesterBot = createServerFn({ method: "POST" })
  .validator((input: TalkBotIn) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim();
    const y = data.yard;
    const employees = (await import("./seed")).EMPLOYEES;
    const projects = y.projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: "",
      lat: 0,
      lng: 0,
      radiusM: 0,
      brief: "",
      huddle: "",
      nextTask: "",
      udbudFolderId: "",
      status: "active" as const,
      createdBy: "",
      source: "",
    }));
    const fullProjects = (await import("./seed")).PROJECTS;
    const usedProjects = fullProjects.filter((p) => y.projects.some((x) => x.id === p.id)).length ? fullProjects : projects;
    const drafts0 = sanitizeActions(data.drafts ?? [], usedProjects);
    const heu = heuristicTalk({
      query,
      photoCount: data.photoCount ?? y.photoCount,
      drafts: drafts0,
      offered: data.offered ?? [],
      notes: data.notes ?? [],
      employees,
      projects: usedProjects,
    });
    if (heu.execute) {
      return {
        ok: true as const,
        answer: heu.answer,
        drafts: heu.drafts,
        execute: true,
        tools: [] as TalkTool[],
        offered: [] as TalkTool[],
        notes: heu.notes,
        citations: [] as string[],
      };
    }

    const tools = heu.tools.length ? heu.tools : [];
    let findings = "";
    let citations: string[] = [];
    let loginRequired: boolean | undefined;
    let loginUrl: string | undefined;
    if (tools.length) {
      const got = await gatherTalkTools(tools, y, query);
      findings = got.text;
      citations = got.citations;
      loginRequired = got.loginRequired;
      loginUrl = got.loginUrl;
      const spoken = afterLookupAnswer(findings, [...(data.notes ?? []), ...heu.notes], speakLang(query));
      const raw = await grokChat({
        system:
          "Du er mester-assistent for Zenko. Kort mundtligt, max 5 sætninger, det sprog mester taler. Ingen markdown. Hvis det handler om stål/stop: slut med om de vil have TF og to-do.",
        user: `Mester: ${query.slice(0, 800)}\nFund:\n${findings.slice(0, 3500)}`,
        history: data.history,
        historyLimit: 8,
        maxTokens: 280,
        timeoutMs: 10000,
        temperature: 0.2,
      });
      return {
        ok: true as const,
        answer: (raw && raw.length < 700 ? raw : spoken) || spoken,
        drafts: heu.drafts,
        execute: false,
        tools: [] as TalkTool[],
        offered: [] as TalkTool[],
        notes: heu.notes,
        citations,
        loginRequired,
        loginUrl,
      };
    }

    if (heu.drafts.length || heu.offered.length) {
      return {
        ok: true as const,
        answer: heu.answer,
        drafts: heu.drafts,
        execute: false,
        tools: [] as TalkTool[],
        offered: heu.offered,
        notes: heu.notes,
        citations: [] as string[],
      };
    }

    const context = [
      `Aktiv sag: ${y.projectName} (${y.projectId})`,
      `Projekter: ${y.projects.map((p) => `${p.id}=${p.name}`).join(", ")}`,
      `Ansatte: ${y.employees.join(", ")} (Marian=Marius, emp-marius)`,
      `På plads: ${y.onSite.join(", ") || "ingen"}`,
      `TF: ${y.tfs.join(" | ") || "ingen"}`,
      `Opgaver: ${y.todos.join(" | ") || "ingen"}`,
      `Ugeplan: ${y.plans?.join(" | ") || "ingen"}`,
      `Husket: ${(data.notes ?? []).join(" | ") || "intet"}`,
      `Udkast nu: ${drafts0.length ? JSON.stringify(drafts0).slice(0, 1200) : "ingen"}`,
      `Tilbudt tjek: ${(data.offered ?? []).join(",") || "ingen"}`,
      `Billeder vedhæftet: ${data.photoCount ?? y.photoCount}`,
      findings ? `Fund:\n${findings.slice(0, 6000)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await grokChat({
      system: `Du er mester-assistent for Zenko Danmark. Kort, mundtlig. Som en kontormedarbejder der kender sagerne.
Svar på det sprog mester taler. Aldrig en lang rapport medmindre de beder om det. Bekræftelser på én linje.

Samtale-regler:
- Alt de siger er kontekst. Info gemmes (notes). Opret INGENTING før de siger "gør det", "udfør", "godkendt" eller klart ja TIL ET UDKAST.
- "ja" til et tilbud om at tjekke = sæt tools, execute=false.
- Instruks om at oprette (TF, to-do, KS, aftaleseddel, plan, mail): vis UDKAST i drafts, execute=false.
- Rettelse ("nej, 200 mm ikke 180"): opdater drafts, execute=false.
- Først execute=true når der ligger udkast OG de bekræfter.

Returner KUN JSON:
{"answer":"kort mundtligt","drafts":[...],"execute":false,"tools":[],"offered":[],"notes":[]}

Handlingstyper:
- create_ks {type, projectId, point, floor, room, deviations}
- create_slip {type, projectId, title, location, body, customerPrice}
- create_tf {type, projectId, title, question}
- create_ent {type, projectId, title, location, body}
- create_todo {type, projectId, title, assigneeId, due, needsPhoto}
- set_plan {type, employeeId, projectId, title, start, end}
- create_note {type, projectId, body}
- export_hours {type, employeeName, projectId, month}
- create_chat {type, projectId, text, assigneeId}
- draft_mail {type, to, subject, body} — appen sender ikke mail; kladde til kopiering.

tools/offered: "web"|"udbud"|"mail"|"calendar"|"drive"
employeeId/assigneeId: emp-alex, emp-ion, emp-marius, emp-osvaldo, emp-ole, emp-federico
projectId fra listen. drafts skal have sag, hvem, hvad, dage/beløb.`,
      user: `${context}\n\nMester: ${query.slice(0, 1200)}`,
      history: data.history,
      historyLimit: 16,
      maxTokens: 900,
      timeoutMs: 22000,
      temperature: 0.2,
    });

    if (!raw) {
      return {
        ok: true as const,
        answer: findings ? findings.slice(0, 600) : heu.answer,
        drafts: heu.drafts,
        execute: false,
        tools: [] as TalkTool[],
        offered: heu.offered,
        notes: heu.notes,
        citations,
        loginRequired,
        loginUrl,
      };
    }
    const json = extractJsonObject(raw);
    const answer =
      typeof json.answer === "string" && json.answer.trim()
        ? json.answer.trim()
        : findings
          ? findings.slice(0, 600)
          : heu.answer;
    let drafts = sanitizeActions(json.drafts ?? json.actions, usedProjects);
    if (!drafts.length) drafts = heu.drafts;
    let execute = json.execute === true && isConfirm(query) && drafts.length > 0;
    const offered = Array.isArray(json.offered) ? (json.offered as TalkTool[]).filter(isTalkTool) : heu.offered;
    const notes = Array.isArray(json.notes) ? json.notes.map((n) => String(n).slice(0, 180)) : heu.notes;
    if (execute && !isConfirm(query)) execute = false;
    return {
      ok: true as const,
      answer,
      drafts,
      execute,
      tools: [] as TalkTool[],
      offered,
      notes,
      citations,
      loginRequired,
      loginUrl,
    };
  });

function isTalkTool(v: unknown): v is TalkTool {
  return v === "web" || v === "udbud" || v === "mail" || v === "calendar" || v === "drive";
}

async function gatherTalkTools(tools: TalkTool[], y: MesterYard, query: string): Promise<{ text: string; citations: string[]; loginRequired?: boolean; loginUrl?: string }> {
  const bits: string[] = [];
  const citations: string[] = [];
  let loginRequired: boolean | undefined;
  let loginUrl: string | undefined;
  const jobs = tools.map(async (tool) => {
    try {
      if (tool === "udbud") {
        const { askUdbud } = await import("./drive.functions");
        const res = await askUdbud({ data: { projectId: y.projectId, query } });
        if (res.line) bits.push(`Udbud: ${res.line}`);
        if (res.used?.length) citations.push(...res.used);
        if (res.loginRequired) {
          loginRequired = true;
          loginUrl = res.loginUrl;
        }
      } else if (tool === "web") {
        const web = await grokChatWeb({
          system: "Kort dansk svar til en murermester. Materialer, DS/EN-normer, leverandører, vejledende priser. Max 8 sætninger. Citér kilder.",
          user: query.slice(0, 800),
          maxTokens: 500,
          timeoutMs: 18000,
        });
        if (web?.text) bits.push(`Net: ${web.text}`);
        if (web?.citations?.length) citations.push(...web.citations);
      } else if (tool === "mail") {
        const { listSagMail } = await import("./mail.functions");
        const res = await listSagMail({ data: { projectId: y.projectId, projectName: y.projectName } });
        bits.push(`Mail: ${res.brief || briefMailItems(res.items, y.projectName)}`);
        if (res.loginRequired) {
          loginRequired = true;
          loginUrl = res.loginUrl;
        }
      } else if (tool === "calendar") {
        const { listYardCalendar } = await import("./calendar.functions");
        const from = `${startOfIsoWeek(copenhagenDate())}T00:00:00.000Z`;
        const to = `${addDaysYmd(startOfIsoWeek(copenhagenDate()), 21)}T00:00:00.000Z`;
        const res = await listYardCalendar({ data: { from, to, query } });
        const lines = res.events.slice(0, 8).map((e) => `${e.at.slice(0, 10)} ${e.title}${e.where ? ` · ${e.where}` : ""}`);
        bits.push(`Kalender:\n${lines.join("\n") || "Ingen møder i tre uger."}`);
        if (res.loginRequired) {
          loginRequired = true;
          loginUrl = res.loginUrl;
        }
      } else if (tool === "drive") {
        const { askUdbud } = await import("./drive.functions");
        const res = await askUdbud({ data: { projectId: y.projectId, query } });
        bits.push(`Drive/udbud: ${res.line || "Ingen træf i mapperne."}`);
        if (res.loginRequired) {
          loginRequired = true;
          loginUrl = res.loginUrl;
        }
      }
    } catch {
      bits.push(`${tool}: kunne ikke hente nu.`);
    }
  });
  await Promise.all(jobs);
  return { text: bits.join("\n"), citations: [...new Set(citations)].slice(0, 8), loginRequired, loginUrl };
}

export const handleWorkingField = createServerFn({ method: "POST" })
  .validator(
    (input: {
      instruction: string;
      employeeName: string;
      employeeLang: Lang;
      original: string;
      daText: string;
      projectId: string;
      projectName: string;
      hasPhotos: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const fallback = heuristicWork(data);
    const raw = await grokChat({
      system: `Du er mester-assistent for Zenko Danmark. Mester dikterer hvad der skal ske med en besked fra en ansat.
Returner KUN JSON:
{"answer":"kort til mester på dansk","reply":"besked til den ansatte på deres sprog","replyDa":"samme på dansk","actions":[...]}
Handlingstyper:
- reply — svar den ansatte (altid hvis mester vil have besked sendt)
- create_todo {type, title, body, kind, needsPhoto} kind=task|notice|ask. needsPhoto=true hvis de skal sende billede.
- create_slip {type, title, location, body}

Regler:
- Ekstra arbejde / aftaleseddel: create_slip + create_todo (ask, så de husker timer) + reply.
- Oversæt reply til den ansattes sprog (${data.employeeLang}).
- Gør det mester siger. Opfind ikke pris.`,
      user: `Sag: ${data.projectName} (${data.projectId})
Ansat: ${data.employeeName} (sprog ${data.employeeLang})
Besked (da): ${data.daText}
Original: ${data.original}
Billeder: ${data.hasPhotos ? "ja" : "nej"}
Mester: ${data.instruction.slice(0, 1200)}`,
      maxTokens: 700,
      timeoutMs: 18000,
    });
    if (!raw) return fallback;
    const json = extractJsonObject(raw);
    const answer = typeof json.answer === "string" ? json.answer.trim() : fallback.answer;
    const reply = typeof json.reply === "string" ? json.reply.trim() : fallback.reply;
    const replyDa = typeof json.replyDa === "string" ? json.replyDa.trim() : fallback.replyDa;
    const actions = Array.isArray(json.actions) ? (json.actions as Record<string, string | boolean>[]) : fallback.actions;
    return { ok: true as const, answer: answer || fallback.answer, reply: reply || fallback.reply, replyDa: replyDa || fallback.replyDa, actions: actions.length ? actions : fallback.actions };
  });

function heuristicWork(data: {
  instruction: string;
  employeeName: string;
  employeeLang: Lang;
  daText: string;
  projectName: string;
  hasPhotos: boolean;
}) {
  const q = `${data.instruction} ${data.daText}`.toLowerCase();
  const extra = /ekstra|aftale|stål|stal|steel|żelaz|zelaz|fjerne/.test(q);
  const replyDa = extra
    ? `Vi fjerner det. Det er ekstra arbejde — giv mester timerne når du er færdig.`
    : data.instruction.slice(0, 280);
  const reply =
    data.employeeLang === "pl"
      ? extra
        ? "Usuwamy to. To dodatkowa praca — podaj godziny mistrzowi, gdy skończysz."
        : replyDa
      : data.employeeLang === "es"
        ? extra
          ? "Lo quitamos. Es trabajo extra: da las horas al maestro cuando termines."
          : replyDa
        : replyDa;
  const actions: Record<string, string | boolean>[] = [{ type: "reply" }];
  if (extra) {
    actions.push({
      type: "create_todo",
      title: "Giv timer når stål er fjernet",
      body: "Når du er færdig med at fjerne stålet: giv mester timerne.",
      kind: "ask",
    });
    actions.push({
      type: "create_slip",
      title: "Fjernelse af stål",
      location: data.projectName,
      body: `${data.daText}\n\nMester: ${data.instruction.slice(0, 400)}`,
    });
  } else if (/to.?do|opgave|husk|opryd/.test(q)) {
    actions.push({ type: "create_todo", title: data.instruction.slice(0, 80), body: data.instruction, kind: "task", needsPhoto: /billede|foto/.test(q) });
  }
  return {
    ok: true as const,
    answer: extra ? `Svarer ${data.employeeName}, laver to-do og opretter aftaleseddel. Du udfylder beløb og sender.` : `Svarer ${data.employeeName}.`,
    reply,
    replyDa,
    actions,
  };
}

export const askCrewSag = createServerFn({ method: "POST" })
  .validator(
    (input: {
      projectId: string;
      projectName: string;
      query: string;
      lang: Lang;
      history?: { role: "user" | "assistant"; content: string }[];
      dataUrl?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const corpus = (UDBUD_CORPUS[data.projectId] ?? []).map((r) => `### ${r.name}\n${r.text}`).join("\n\n").slice(0, 9000);
    const langName = data.lang === "da" ? "dansk" : data.lang === "pl" ? "polsk" : data.lang === "es" ? "spansk" : data.lang === "ro" ? "rumænsk" : "ukrainsk";
    const key = apiKey();
    let vision = "";
    if (data.dataUrl && data.dataUrl.startsWith("data:image") && data.dataUrl.length < 900_000 && key) {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(18000),
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 400,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content: "Du er murer-faglig. Beskriv billedet konkret: produkt, bindere, mørtel, stål, skade. Dansk. Kort.",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: data.query.slice(0, 400) || "Hvad er det?" },
                  { type: "image_url", image_url: { url: data.dataUrl } },
                ],
              },
            ],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          vision = body.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch {
        vision = "";
      }
    }
    const grok = await grokChat({
      system: `Du er sag-bot for Zenko Danmark. Du hjælper den ansatte med UDFØRSEL: hvordan, materialer, bindere, mørtel, KS-krav, arbejdsmiljø.
Du må IKKE tale om priser, aftalesedler, faktura eller interne aftaler.
Svar KUN på ${langName}. Kort, konkret, citér udbuddet og punktnummer.
${
  data.projectId === "job-islevvaenge"
    ? "Islevvænge: gule og røde rækkehuse Fortvej/Knudsbølvej. Fuger udkradses 20 mm, mørtel KC 50/50/700, skrabefuge. Ingen afsyring. Puds/vandskuring/filts på gavle røde Fortvej: KC 50/50/490 rød som eksisterende filts. Skorsten: 85 % omfug, 15 % ny opmuring. Ekstra 2 skifter ved tag."
    : "Bindere Hillerødsholm: min. 4 stk/m², 6 stk/m² ved hjørner og 2 m fra hjørner. Ø4 rustfri. Skal godkendes af byggeledelsen."
}
Arbejdsmiljø: stillads, fald, støv. Hvis billedet er bindere eller fuger: sig type og hvordan iht. udbud.`,
      user: `Sag: ${data.projectName}\nSpørgsmål: ${data.query.slice(0, 800)}\n${vision ? `Billede: ${vision}` : ""}\n\nUdbud:\n${corpus || "Intet udbud indlæst."}`,
      history: data.history,
      maxTokens: 700,
      timeoutMs: 20000,
    });
    if (grok) return { ok: true as const, line: grok, used: corpus ? [data.projectId === "job-islevvaenge" ? "ISV_K01_C08.2_Zmur" : "udbud"] : [], vision };
    const snip = snippetFromCorpus(data.projectId, data.query);
    if (snip) return { ok: true as const, line: `${snip.excerpt} (${snip.name})`, used: [snip.name], vision };
    const hit = corpus.toLowerCase().includes("binder") && /binder|bindere/.test(data.query.toLowerCase());
    const da =
      hit
        ? "Ifølge murerbeskrivelsen skal du bore renoveringsbindere min. 4 stk. pr. m². 2 m fra hjørner og ved åbninger: min. 6 stk. pr. m². Ø4 rustfri, min. 145 mm + hulrum. Bindere skal godkendes af byggeledelsen før brug."
        : "Jeg fandt ikke et sikkert svar i udbuddet. Spørg mester.";
    return { ok: true as const, line: da, used: hit ? ["K01_C08_002_Murer"] : [], vision };
  });

export const askSagInfo = createServerFn({ method: "POST" })
  .validator((input: { projectName: string; brief: string; query: string; history?: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data }) => {
    const grok = await grokChat({
      system: `Du uddyber info-skærmen for murermester Ole på ${data.projectName}.
Du har overblikket (mail, chat, to-do, møder, rapporter). Svar kort på dansk. Ingen markdown-overskrifter.
Hvis det ikke står i overblikket, sig det ærligt.`,
      user: `Overblik:\n${data.brief.slice(0, 6000)}\n\nSpørgsmål: ${data.query.slice(0, 600)}`,
      history: data.history,
      maxTokens: 500,
      timeoutMs: 18000,
    });
    return { ok: true as const, line: grok || "Jeg kan ikke uddybe det ud fra overblikket." };
  });

