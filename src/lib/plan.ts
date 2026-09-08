import { copenhagenDate, projectById } from "./seed.ts";
import type { Employee, PlanBlock, Project } from "./types.ts";

const WEEKDAYS: { n: number; keys: string[] }[] = [
  { n: 1, keys: ["mandag", "man"] },
  { n: 2, keys: ["tirsdag", "tirs"] },
  { n: 3, keys: ["onsdag", "ons"] },
  { n: 4, keys: ["torsdag", "tors"] },
  { n: 5, keys: ["fredag", "fre"] },
  { n: 6, keys: ["lørdag", "lordag", "lør"] },
  { n: 7, keys: ["søndag", "sondag", "søn"] },
];

export function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(d);
}

export function fromYmd(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 10, 0, 0));
}

export function addDaysYmd(iso: string, n: number) {
  const d = fromYmd(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function startOfIsoWeek(iso = copenhagenDate()) {
  const d = fromYmd(iso);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function isoWeek(iso = copenhagenDate()) {
  const d = fromYmd(iso);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

export function weekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i));
}

export function weekdayLabel(iso: string, locale = "da-DK") {
  return fromYmd(iso).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
}

export const PLAN_PLACES = [
  { id: "sted-lager", label: "Lager" },
  { id: "sted-koersel", label: "Kørsel" },
  { id: "sted-andet", label: "Andet" },
] as const;

export type PlanPlaceId = (typeof PLAN_PLACES)[number]["id"];

export function isPlanPlace(id: string) {
  return PLAN_PLACES.some((p) => p.id === id);
}

export function planPlaceLabel(block: Pick<PlanBlock, "projectId" | "place" | "title">) {
  const fixed = PLAN_PLACES.find((p) => p.id === block.projectId);
  if (fixed) return fixed.label;
  if (block.place) return block.place;
  return projectById(block.projectId).name;
}

export function weekStartForPerson(plans: PlanBlock[], personId: string, today = copenhagenDate()) {
  const thisW = startOfIsoWeek(today);
  const thisEnd = addDaysYmd(thisW, 6);
  const mine = plans.filter((p) => planCoversPerson(p, personId));
  if (mine.some((p) => p.start <= thisEnd && p.end >= thisW)) return thisW;
  const upcoming = mine.filter((p) => p.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (upcoming) return startOfIsoWeek(upcoming.start);
  const last = [...mine].sort((a, b) => b.end.localeCompare(a.end))[0];
  return last ? startOfIsoWeek(last.start) : thisW;
}

export function rangesFromDays(days: string[]): { start: string; end: string }[] {
  const sorted = [...new Set(days)].sort();
  const out: { start: string; end: string }[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && addDaysYmd(last.end, 1) === d) last.end = d;
    else out.push({ start: d, end: d });
  }
  return out;
}

export function resolvePlanPlace(text: string, projects: { id: string; name: string }[]): { projectId: string; place?: string } {
  const q = text.trim().toLowerCase();
  if (/lager/.test(q)) return { projectId: "sted-lager", place: "Lager" };
  if (/kørsel|koersel|kore|køre/.test(q)) return { projectId: "sted-koersel", place: "Kørsel" };
  if (/^andet$|\bandet\b/.test(q) && !projects.some((p) => q.includes(p.name.toLowerCase()))) {
    return { projectId: "sted-andet", place: "Andet" };
  }
  const hit = projects.find((p) => q.includes(p.name.toLowerCase()) || p.id === q);
  if (hit) return { projectId: hit.id };
  if (q) return { projectId: "sted-andet", place: text.trim().slice(0, 40) };
  return { projectId: "sted-andet", place: "Andet" };
}

export function projectBarClass(projectId: string) {
  if (projectId === "sted-lager") return "bg-moss text-sand";
  if (projectId === "sted-koersel") return "bg-navy-mid text-sand";
  if (projectId === "sted-andet") return "bg-ink text-sand";
  if (projectId === "job-hillerodsholm") return "bg-brick text-sand";
  if (projectId === "job-islevvaenge") return "bg-navy text-sand";
  if (projectId === "job-kaerhuset" || projectId === "job-ruskaer") return "bg-moss text-sand";
  if (projectId === "job-solbakkegaard") return "bg-navy text-sand";
  if (projectId === "job-klostergaarden") return "bg-moss text-sand";
  if (projectId === "job-provestenen" || projectId === "job-strandvejen") return "bg-navy-mid text-sand";
  if (projectId === "job-soren-privat") return "bg-ink text-sand";
  return "bg-navy text-sand";
}

function weekdayIndex(text: string): number | null {
  const q = text.toLowerCase();
  for (const row of WEEKDAYS) {
    if (row.keys.some((k) => new RegExp(`\\b${k}\\b`, "i").test(q))) return row.n;
  }
  return null;
}

function dateOnWeek(weekStart: string, weekday: number) {
  return addDaysYmd(weekStart, weekday - 1);
}

export function weekBase(text: string, today = copenhagenDate()): string {
  const weekStart = startOfIsoWeek(today);
  const q = text.toLowerCase();
  if (/næste uge|naeste uge/.test(q)) return addDaysYmd(weekStart, 7);
  const uge = q.match(/\buge\s*(\d{1,2})\b/);
  if (uge) {
    const w = Number(uge[1]);
    const cur = isoWeek(today);
    return addDaysYmd(weekStart, (w - cur) * 7);
  }
  return weekStart;
}

export function parsePlanRange(text: string, today = copenhagenDate()): { start: string; end: string } | null {
  const q = text.toLowerCase();
  const weekStart = startOfIsoWeek(today);
  const nextHint = /næste uge|naeste uge/.test(q);
  if (/hele ugen/.test(q) && nextHint) {
    const base = addDaysYmd(weekStart, 7);
    return { start: base, end: addDaysYmd(base, 4) };
  }
  if (/hele ugen|denne uge/.test(q) && !nextHint) return { start: weekStart, end: addDaysYmd(weekStart, 4) };
  if (/\bi dag\b|idag/.test(q)) return { start: today, end: today };
  if (/\bi morgen\b|imorgen/.test(q)) {
    const t = addDaysYmd(today, 1);
    return { start: t, end: t };
  }
  const uge = q.match(/\buge\s*(\d{1,2})\b/);
  let base = weekStart;
  if (nextHint) base = addDaysYmd(weekStart, 7);
  if (uge) {
    const w = Number(uge[1]);
    const cur = isoWeek(today);
    const delta = (w - cur) * 7;
    base = addDaysYmd(weekStart, delta);
  }
  const til = q.match(
    /\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|man|tirs|ons|tors|fre)\b.{0,12}\b(til|og|–|-)\b.{0,8}\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|man|tirs|ons|tors|fre)\b/,
  );
  if (til) {
    const a = weekdayIndex(til[1]!);
    const b = weekdayIndex(til[3]!);
    if (a && b) {
      let start = dateOnWeek(base, a);
      let end = dateOnWeek(base, b);
      if (end < start) end = addDaysYmd(end, 7);
      if (end < today && !uge && !nextHint) {
        start = addDaysYmd(start, 7);
        end = addDaysYmd(end, 7);
      }
      return { start, end };
    }
  }
  const one = weekdayIndex(q);
  if (one) {
    let day = dateOnWeek(base, one);
    if (day < today && !uge && !nextHint) day = addDaysYmd(day, 7);
    return { start: day, end: day };
  }
  if (nextHint) {
    return { start: base, end: addDaysYmd(base, 4) };
  }
  return null;
}

export function parseDaysList(text: string, today = copenhagenDate()): string[] {
  const q = text.toLowerCase();
  const nextHint = /næste uge|naeste uge/.test(q);
  let base = startOfIsoWeek(today);
  if (nextHint) base = addDaysYmd(base, 7);
  const days: string[] = [];
  for (const row of WEEKDAYS) {
    if (row.keys.some((k) => new RegExp(`\\b${k}\\b`, "i").test(q))) {
      days.push(dateOnWeek(base, row.n));
    }
  }
  if (days.length) return [...new Set(days)].sort();
  const range = parsePlanRange(text, today);
  if (!range) return [];
  const out: string[] = [];
  let d = range.start;
  while (d <= range.end) {
    out.push(d);
    d = addDaysYmd(d, 1);
  }
  return out;
}

export function planWorkTitle(text: string) {
  const q = text.toLowerCase();
  if (/gavl/.test(q) && /puds/.test(q)) return "Puds gavle";
  if (/kælder|kaelder/.test(q) && /puds/.test(q)) return "Puds kælder";
  if (/gavl/.test(q)) return "Gavle";
  if (/kælder|kaelder/.test(q)) return "Kælder";
  if (/puds/.test(q)) return "Pudsarbejde";
  if (/fils/.test(q)) return "Filsning";
  if (/fuge out|fuge-out/.test(q)) return "Fuge out";
  if (/fuge in|fuge-in/.test(q)) return "Fuge in";
  if (/fuge/.test(q)) return "Fugearbejde";
  if (/altan/.test(q)) return "Altan";
  if (/skorsten/.test(q)) return "Skorsten";
  if (/bindere/.test(q)) return "Bindere";
  if (/opryd/.test(q)) return "Oprydning";
  if (/mørtel|mortel/.test(q)) return "Mørtel";
  if (/ks\b/.test(q)) return "KS";
  return "Udførsel";
}

export function matchEmployees(text: string, employees: Employee[]) {
  const q = text.toLowerCase();
  return employees.filter((e) => {
    const first = e.name.toLowerCase().split(" ")[0]!;
    if (q.includes(first)) return true;
    if (first === "marius" && q.includes("marian")) return true;
    if (first === "osvaldo" && q.includes("osvando")) return true;
    if (first === "federico" && /frederico|federico|fede\b/.test(q)) return true;
    return false;
  });
}

export function looksLikePlan(text: string) {
  const q = text.toLowerCase();
  return /plan|skal|læg|laeg|uge\s*\d|næste uge|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|hele ugen|i morgen|i dag/.test(q);
}

export function wantsPlanCommit(text: string) {
  const q = text.toLowerCase();
  return /læg .*plan|lig at dette|læg at dette|læg det i plan|i planen|udfør|gør det/.test(q);
}

export type PlanChunk = {
  employees: Employee[];
  projectName: string;
  create: boolean;
  title: string;
  start: string;
  end: string;
};

function foldName(s: string) {
  return s.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
}

export function extractJobName(chunk: string): string {
  const hedder = chunk.match(/hedder\s+([^.\n]+?)(?:\s*[-–—]\s*opret|\s+opret|\s*$)/i);
  if (hedder) {
    return hedder[1]!.replace(/\s*[-–—]\s*$/, "").replace(/\s+opret.*$/i, "").replace(/\s+der hedder dette.*$/i, "").trim();
  }
  const sagen = chunk.match(/\b(?:sagen|projektet)\s+([A-ZÆØÅa-zæøå][\wÆØÅæøå ./-]{2,40})/);
  if (sagen) return sagen[1]!.replace(/\s+de skal.*$/i, "").replace(/\s+og være.*$/i, "").trim();
  return "";
}

function splitPlanChunks(text: string, employees: Employee[]): string[] {
  const raw = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^(lig|læg)\b.*plan/i.test(s));
  const out: string[] = [];
  for (const row of raw) {
    const hasPeople = matchEmployees(row, employees).length > 0;
    const workOnly = /puds|gavl|kælder|kaelder|fils|fuge|mandag|tirsdag|onsdag|torsdag|fredag/.test(row.toLowerCase());
    if (!hasPeople && out.length && workOnly) {
      out[out.length - 1] += ` ${row}`;
    } else if (hasPeople || /hedder|opret|sag|projekt/.test(row.toLowerCase())) {
      out.push(row);
    }
  }
  return out;
}

export function parseWeekPlan(
  text: string,
  employees: Employee[],
  _projects: Project[],
  today = copenhagenDate(),
): PlanChunk[] {
  const base = weekBase(text, today);
  const chunks = splitPlanChunks(text, employees);
  const out: PlanChunk[] = [];
  for (const chunk of chunks) {
    const who = matchEmployees(chunk, employees);
    if (!who.length) continue;
    const create = /opret/.test(chunk.toLowerCase());
    const projectName = extractJobName(chunk);
    if (!projectName) continue;
    const hasDay = weekdayIndex(chunk) != null;
    const range = hasDay
      ? parsePlanRange(/næste uge/.test(chunk.toLowerCase()) ? chunk : `næste uge ${chunk}`, today)
      : { start: base, end: addDaysYmd(base, 4) };
    if (!range) continue;
    out.push({
      employees: who,
      projectName,
      create,
      title: planWorkTitle(chunk),
      start: range.start,
      end: range.end,
    });
  }
  return out;
}

export function jobSlug(name: string) {
  const s = foldName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `job-${s || "ny"}`;
}

export function placeFor(name: string): { address: string; lat: number; lng: number } {
  const n = foldName(name);
  if (n.includes("klostergard")) return { address: "Klostervej 1–15, 3400 Hillerød", lat: 55.9324, lng: 12.2978 };
  if (n.includes("provesten") || n.includes("strandvej")) return { address: "Strandvejen 84, 3300 Frederiksværk", lat: 55.9706, lng: 11.9985 };
  if (n.includes("soren") || n.includes("privat")) return { address: "Privat sag — adresse mangler", lat: 55.676, lng: 12.568 };
  return { address: "Adresse mangler", lat: 55.68, lng: 12.45 };
}

export function barSpan(block: PlanBlock, weekStart: string) {
  const days = weekDays(weekStart);
  const start = block.start < days[0]! ? days[0]! : block.start;
  const end = block.end > days[6]! ? days[6]! : block.end;
  if (end < days[0]! || start > days[6]!) return null;
  const col = days.indexOf(start);
  const last = days.indexOf(end);
  if (col < 0 || last < 0) return null;
  return { col, span: last - col + 1 };
}

export function planPeopleIds(block: Pick<PlanBlock, "employeeId" | "employeeIds">) {
  if (block.employeeIds?.length) return [...new Set(block.employeeIds.filter(Boolean))];
  return block.employeeId ? [block.employeeId] : [];
}

export function planCoversPerson(block: Pick<PlanBlock, "employeeId" | "employeeIds">, employeeId: string) {
  return planPeopleIds(block).includes(employeeId);
}

export function blocksForWeek(blocks: PlanBlock[], weekStart: string, employeeId?: string) {
  return blocks.filter((b) => {
    if (employeeId && !planCoversPerson(b, employeeId)) return false;
    return !(b.end < weekStart || b.start > addDaysYmd(weekStart, 6));
  });
}

export function planLabel(block: PlanBlock) {
  return `${planPlaceLabel(block)} · ${block.title}`;
}

export function emptyPlanHint(projects: Project[]) {
  const names = projects.filter((p) => p.status === "active").map((p) => p.name);
  return names[0] ?? "sagen";
}
