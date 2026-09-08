export type ReportFixKind = "slip" | "tf" | "ent" | "ks" | "pack";
export type FixScalar = string | number | boolean;
export type FixSnapshot = Record<string, FixScalar | null>;
export type FixPatch = Record<string, FixScalar>;
export type FixChange = { field: string; label: string; from: string; to: string };

export const FIX_FIELDS: Record<ReportFixKind, string[]> = {
  slip: ["title", "location", "body", "masterSolution", "customerPrice", "hoursEst", "materialsEst"],
  tf: ["title", "question", "answer"],
  ent: ["title", "location", "body", "noteHe"],
  ks: ["point", "deviations", "crew", "employeeName", "process", "trade", "approved"],
  pack: ["title"],
};

export const FIX_LABELS: Record<string, string> = {
  title: "titel",
  location: "lokation",
  body: "beskrivelse",
  question: "spørgsmål",
  answer: "svar",
  masterSolution: "kunde-bemærkning",
  noteHe: "kunde-bemærkning",
  customerPrice: "pris",
  point: "KS-punkt",
  deviations: "afvigelser",
  crew: "sjak",
  employeeName: "medarbejder",
  process: "proces",
  trade: "fag",
  approved: "godkendt",
  hoursEst: "timer",
  materialsEst: "materialer",
};

export function snapshotOf(kind: ReportFixKind, report: Record<string, unknown> | null | undefined): FixSnapshot {
  const out: FixSnapshot = {};
  for (const k of FIX_FIELDS[kind]) {
    const v = report?.[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = k === "hoursEst" ? 0 : k === "approved" ? false : "";
  }
  return out;
}

export function extractJson(raw: string): Record<string, unknown> {
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

export function sanitizePatch(allowed: string[], raw: Record<string, unknown>): FixPatch {
  const out: FixPatch = {};
  for (const k of allowed) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (k === "hoursEst") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,]/g, "").replace(",", "."));
      if (Number.isFinite(n)) out[k] = n;
      continue;
    }
    if (k === "approved") {
      out[k] = v === true || v === "true" || v === "ja" || v === "godkendt";
      continue;
    }
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (typeof v === "number") out[k] = String(v);
    else if (typeof v === "boolean") out[k] = v;
  }
  if (typeof out.customerPrice === "string") {
    const t = out.customerPrice;
    if (/\d/.test(t) && !/kr/i.test(t)) out.customerPrice = `${t} kr`;
  }
  return out;
}

function rawFromModel(json: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const nested = json.patch;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  const top: Record<string, unknown> = {};
  let hit = false;
  for (const k of allowed) {
    if (k in json) {
      top[k] = json[k];
      hit = true;
    }
  }
  return hit ? top : {};
}

export function parseModelPatch(
  raw: string,
  kind: ReportFixKind,
  snapshot: FixSnapshot,
): { patch: FixPatch; summary: string } {
  const allowed = FIX_FIELDS[kind];
  const json = extractJson(raw);
  const rawPatch = rawFromModel(json, allowed);
  const patch = dropUnchanged(snapshot, sanitizePatch(allowed, rawPatch));
  const summary =
    typeof json.summary === "string" && json.summary.trim() ? json.summary.trim() : summarizePatch(patch);
  return { patch, summary };
}

export function dropUnchanged(snapshot: FixSnapshot, patch: FixPatch): FixPatch {
  const out: FixPatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (String(snapshot[k] ?? "") === String(v)) continue;
    out[k] = v;
  }
  return out;
}

export function mergePatches(base: FixPatch, overlay: FixPatch): FixPatch {
  return { ...base, ...overlay };
}

export function diffChanges(snapshot: FixSnapshot, patch: FixPatch): FixChange[] {
  return Object.entries(patch).map(([field, to]) => ({
    field,
    label: FIX_LABELS[field] ?? field,
    from: clip(String(snapshot[field] ?? "—")),
    to: clip(String(to)),
  }));
}

function clip(s: string, n = 90) {
  const t = s.replace(/\s+/g, " ").trim() || "—";
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function summarizePatch(patch: FixPatch): string {
  const keys = Object.keys(patch);
  if (!keys.length) return "Ingen ændring.";
  return `Rettede ${keys.map((k) => FIX_LABELS[k] ?? k).join(", ")}.`;
}

function takeUntilNextField(text: string) {
  return text
    .split(/\s+(?=(?:titlen?|lokation(?:en)?|sted(?:et)?|pris(?:en)?|beskrivelse(?:n)?|tekst(?:en)?|kunde(?:n)?|punkt|ks\b|timer|materialer|sjak(?:ket)?)\b)/i)[0]!
    .trim();
}

export function heuristicFix(kind: ReportFixKind, text: string, current: FixSnapshot): FixPatch {
  const out: Record<string, unknown> = {};
  const t = text.trim();
  if (!t) return {};

  const punkt = t.match(/(?:kontrolpunkt|punkt|ks(?:-?punkt)?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (punkt && kind === "ks") out.point = punkt[1];

  const pris =
    t.match(/(?:pris(?:en)?|koster|beløb)\s*(?:skal\s+(?:være|sættes\s+til)|er|til|:)?\s*[^\d]{0,12}(\d{1,3}(?:[.\s]\d{3})+|\d+)/i) ||
    t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*(?:kr\.?|kroner)/i);
  if (pris && kind === "slip") {
    const n = pris[1]!.replace(/[^\d]/g, "");
    if (n) out.customerPrice = `${Number(n).toLocaleString("da-DK")} kr`;
  }

  const titel = t.match(/titlen?\s*(?:skal\s+(?:være|hedde)|hedder|er|:)\s*["«]?([^\n"»]+)/i);
  if (titel && kind !== "ks") out.title = takeUntilNextField(titel[1]!);

  const lok = t.match(/(?:lokation(?:en)?|sted(?:et)?)\s*(?:skal\s+være|er|:)\s*([^\n]+)/i);
  if (lok && (kind === "slip" || kind === "ent")) out.location = takeUntilNextField(lok[1]!);

  const sal = t.match(/\b(\d+\.?\s*sal|stuen|taget|kælderen|kælder)\b/i);
  if (sal && (kind === "slip" || kind === "ent") && !out.location) {
    const loc = String(current.location ?? "");
    const bit = sal[1]!.replace(/\s+/g, " ");
    out.location = loc.toLowerCase().includes(bit.toLowerCase()) ? loc : `${loc ? loc.replace(/,?\s*$/, "") + ", " : ""}${bit}`;
  }

  const besk = t.match(
    /(?:beskrivelse(?:n)?|tekst(?:en)?|brødtekst)\s*(?:skal\s+(?:være|lyde|hedde)|er|:)\s*([\s\S]+)/i,
  );
  if (besk) {
    const body = takeUntilNextField(besk[1]!);
    if (kind === "slip" || kind === "ent") out.body = body;
    if (kind === "tf") out.question = body;
    if (kind === "ks") out.deviations = body;
  }

  const kunde = t.match(
    /(?:kunde(?:n)?(?:\s*bemærkning)?|løsning(?:en)?)\s*(?:skal\s+(?:være|lyde)|er|:)\s*([\s\S]+)/i,
  );
  if (kunde && kind === "slip") out.masterSolution = takeUntilNextField(kunde[1]!);
  if (kunde && kind === "ent") out.noteHe = takeUntilNextField(kunde[1]!);

  const spm = t.match(/(?:spørgsmål(?:et)?)\s*(?:skal\s+(?:være|lyde)|er|:)\s*([\s\S]+)/i);
  if (spm && kind === "tf") out.question = takeUntilNextField(spm[1]!);

  const svar = t.match(/(?:svar(?:et)?)\s*(?:skal\s+(?:være|lyde)|er|:)\s*([\s\S]+)/i);
  if (svar && kind === "tf") out.answer = takeUntilNextField(svar[1]!);

  const hours = t.match(/(\d+)\s*timer/i);
  if (hours && kind === "slip") out.hoursEst = Number(hours[1]);

  const mat = t.match(/materialer\s*(?:skal\s+være|er|:)\s*([^\n]+)/i);
  if (mat && kind === "slip") out.materialsEst = takeUntilNextField(mat[1]!);

  const sjak = t.match(/sjak(?:ket)?\s*(?:skal\s+være|er|:)\s*([^\n]+)/i);
  if (sjak && kind === "ks") out.crew = takeUntilNextField(sjak[1]!);

  return dropUnchanged(current, sanitizePatch(FIX_FIELDS[kind], out));
}

export function fieldGuide(kind: ReportFixKind) {
  return FIX_FIELDS[kind].map((k) => `${k} (${FIX_LABELS[k] ?? k})`).join(", ");
}
