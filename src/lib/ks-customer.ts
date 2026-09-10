import { FIRM, FIRM_CVR, FIRM_LINE, FIRM_MAIL, FIRM_PHONE, PROJECTS, SEED_KS_REPORTS, findControlPoint } from "./seed.ts";
import { planForProject, scanForProject, type UdbudPart } from "./udbud-plan.ts";
import { seedDrivePhotos } from "./ks-drive.ts";
import { softrKsPhotos, softrKsReports } from "./softr-ks.ts";
import { photoSrc } from "./tf-share.ts";
import { shortPunktTitle } from "./ks-punkt.ts";
import type { Entrepreneur, FieldItem, KsPhoto, KsReport, KsType, Project, Tf } from "./types.ts";
import { isKundeSlug } from "./route-guards.ts";

export { isKundeSlug };

export type KundePart = {
  code: string;
  title: string;
  controlPoint: string;
};

export type KundePhoto = { id: string; src: string; n: string };

export type KundeDocKind = "ks" | "tf" | "er";

export type KundeReportView = {
  id: string;
  number: string;
  pad: string;
  createdAt: string;
  employeeName: string;
  location: string;
  point: string;
  part: KundePart;
  task: string;
  qcScope: string;
  qcMethod: string;
  criteria: string;
  deviations: string;
  photos: KundePhoto[];
  kind?: KundeDocKind;
  body?: string;
};

export type KundeJobMeta = {
  slug: string;
  projectId: string;
  name: string;
  client: string;
  address: string;
  department: string;
  trade: string;
  scope: string;
  period: string;
  qualityManager: string;
  cvr: string;
  phone: string;
  mail: string;
  firm: string;
  firmLine: string;
  ksType: KsType;
};

export type KundeSite = {
  job: KundeJobMeta;
  parts: KundePart[];
  reports: KundeReportView[];
  published: number;
};

export const HANDBOOK = {
  purpose: {
    n: "01",
    title: "Formål",
    body: "Formålet er at sikre den byggetekniske kvalitet — som fastlagt for entreprisen, ellers svarende til normal god håndværksmæssig udførelse.",
  },
  duty: {
    n: "02",
    title: "Ansvar",
    body: "Virksomhedsledelsen har det overordnede ansvar for ressourcer til entreprisen. Den sagsansvarlige har ansvaret for at arbejdet udføres konditionsmæssigt, og at kvaliteten dokumenteres som aftalt.",
  },
  control: {
    n: "03",
    title: "Kontrol på sagen",
    items: [
      "Modtagekontrol: materialer kontrolleres ved ankomst for mængde og kvalitet efter kontrolplanen. Dokumenteres.",
      "Proceskontrol: under udførelsen følges de punkter der gælder for entreprisen. Afvigelser beskrives og udbedres. Dokumenteres med foto.",
      "Slutkontrol: når arbejdet eller en afgrænset del er afsluttet, foretager den sagsansvarlige en slutkontrol.",
    ],
  },
  docs: {
    n: "04",
    title: "Dokumentation",
    body: "Dokumentationen afleveres til bygherre eller dennes rådgivere efter aftale. Alle dokumenter opbevares i den gældende ansvarsperiode. Kontrolplanen for denne sag er listen på forsiden. Kun de punkter der indgår i entreprisen, og de rapporter der er valgt til kunden, er med.",
  },
} as const;

const JOB_SLUGS: Record<string, string> = {
  "job-hillerodsholm": "hilleroedsholm",
  "job-islevvaenge": "islevvaenge",
  "job-kaerhuset": "kaerhuset",
  "job-provestenen": "proevestenen",
  "job-klostergaarden": "klostergaarden",
  "job-solbakkegaard": "solbakkegaard",
};

const JOB_META: Record<string, Partial<KundeJobMeta>> = {
  "job-hillerodsholm": {
    department: "NAB afd. 4121",
    trade: "Murværk",
    qualityManager: "Ole",
  },
  "job-islevvaenge": {
    department: "Rødovre afd. 2304",
    trade: "Murværk",
    qualityManager: "Ole",
  },
  "job-kaerhuset": {
    trade: "Murværk",
    qualityManager: "Ole",
    scope: "Ruskær 35, ombygning",
  },
};

export const OVRIGE_PART: KundePart = { code: "ovrige", title: "Øvrigt", controlPoint: "" };

export function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function slugForProject(project: { id: string; name: string }) {
  return JOB_SLUGS[project.id] || slugFromName(project.name);
}

export function projectIdFromSlug(slug: string, projects: Project[] = PROJECTS): string | null {
  const s = slug.trim();
  const known = Object.entries(JOB_SLUGS).find(([, v]) => v === s);
  if (known) return known[0];
  const hit = projects.find((p) => slugForProject(p) === s);
  return hit?.id ?? null;
}

export function padReportNo(number: string) {
  const n = Number(String(number).replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return String(number).replace(/[^A-Za-z0-9]/g, "").slice(-2).padStart(2, "0") || "01";
  return String(n).padStart(2, "0");
}

export function pointCodeOf(report: Pick<KsReport, "point" | "task">) {
  const fromTask = String(report.task || "").match(/(\d+\.\d+\.\d+)/);
  if (fromTask) return fromTask[1];
  const fromPoint = String(report.point || "").match(/(\d+\.\d+)/);
  return fromPoint?.[1] ?? "";
}

function fromPlan(code: string, plan: UdbudPart[]): KundePart | null {
  const hit = plan.find((p) => p.code === code);
  if (!hit) return null;
  return { code: hit.code, title: shortPunktTitle(hit.title) || hit.title, controlPoint: hit.controlPoint };
}

export function partFromKundePunkt(punkt: string, projectId: string): KundePart {
  const v = punkt.trim();
  if (!v) return OVRIGE_PART;
  const plan = planForProject(projectId);
  const byCode = fromPlan(v, plan);
  if (byCode) return byCode;
  const lower = v.toLowerCase();
  const byTitle = plan.find((p) => {
    const short = shortPunktTitle(p.title).toLowerCase();
    return short === lower || p.title.toLowerCase() === lower || p.code.toLowerCase() === lower;
  });
  if (byTitle) return fromPlan(byTitle.code, plan) ?? { code: byTitle.code, title: shortPunktTitle(byTitle.title) || byTitle.title, controlPoint: byTitle.controlPoint };
  return { code: slugFromName(v) || OVRIGE_PART.code, title: shortPunktTitle(v) || v, controlPoint: "" };
}

export function partForReport(report: Pick<KsReport, "point" | "task" | "location" | "projectId" | "kundePunkt">): KundePart {
  const raw = (report.kundePunkt ?? "").trim();
  if (!raw) return OVRIGE_PART;
  return partFromKundePunkt(raw, report.projectId);
}

export function isPublished(report: { kundeStatus?: string; trashedAt?: string }) {
  return report.kundeStatus === "med_til_kunden" && !report.trashedAt;
}

export function kundeMeta(project: Project): KundeJobMeta {
  const extra = JOB_META[project.id] ?? {};
  const scan = scanForProject(project.id);
  const scope = extra.scope || scan.meta.scope || "";
  return {
    slug: slugForProject(project),
    projectId: project.id,
    name: project.name,
    client: extra.client || project.customer || "",
    address: project.address,
    department: extra.department ?? "",
    trade: extra.trade ?? "Murværk",
    scope,
    period: extra.period ?? "",
    qualityManager: extra.qualityManager ?? "Ole",
    cvr: FIRM_CVR,
    phone: FIRM_PHONE,
    mail: FIRM_MAIL,
    firm: FIRM,
    firmLine: FIRM_LINE,
    ksType: project.ksType ?? "alm",
  };
}

function filledFields(job: KundeJobMeta) {
  const rows: [string, string][] = [
    ["Firma", job.firm],
    ["Sag", job.name],
    ["Bygherre", job.client],
    ["Entreprise", job.trade],
    ["Omfang", job.scope],
    ["Blok / afdeling", job.department],
    ["Periode", job.period],
    ["Kvalitetsansvarlig", job.qualityManager],
    ["CVR", job.cvr],
  ];
  return rows.filter(([, v]) => v.trim());
}

export function kundeJobFields(job: KundeJobMeta) {
  return filledFields(job);
}

function cleanDeviation(raw?: string) {
  const t = (raw ?? "").trim();
  if (!t) return "Ingen";
  if (/ingen/i.test(t)) return "Ingen";
  if (/fejlfrit/i.test(t)) return "Ingen";
  if (/overensstemmelse/i.test(t)) return "Ingen";
  return t;
}

function photosOf(report: KsReport, photos: KsPhoto[]): KundePhoto[] {
  const ids = report.photoIds ?? [];
  const hits = photos.filter((p) => ids.includes(p.id) || ids.includes(p.driveFileId ?? "") || p.id.startsWith(`softr-ks-${report.number}-`));
  const seen = new Set<string>();
  const out: KundePhoto[] = [];
  let i = 0;
  for (const p of hits) {
    if (seen.has(p.id)) continue;
    const src = photoSrc({ dataUrl: p.dataUrl, driveUrl: p.driveUrl, driveFileId: p.driveFileId });
    if (!src) continue;
    seen.add(p.id);
    i += 1;
    out.push({ id: p.id, src, n: String(i).padStart(2, "0") });
  }
  return out;
}

export function toKundeReport(report: KsReport, job: Project, photos: KsPhoto[]): KundeReportView {
  const part = partForReport(report);
  const plan = findControlPoint(report.point, job.id);
  return {
    id: report.id,
    number: report.number,
    pad: padReportNo(report.number),
    createdAt: report.createdAt,
    employeeName: report.employeeName || "Zenko",
    location: report.location || "",
    point: pointCodeOf(report) || report.point,
    part,
    task: report.task || part.title,
    qcScope: report.qcScope || plan?.qcScope || plan?.extent || "",
    qcMethod: report.qcMethod || plan?.method || plan?.controlType || "",
    criteria: plan?.criteria || "",
    deviations: cleanDeviation(report.deviations),
    photos: photosOf(report, photos),
  };
}

export const TF_PART: KundePart = { code: "tf", title: "Tekniske forespørgsler", controlPoint: "" };
export const ER_PART: KundePart = { code: "er", title: "Entreprenørrapporter", controlPoint: "" };

function fieldPhotos(ids: string[], items: FieldItem[]): KundePhoto[] {
  const out: KundePhoto[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const item of items) {
    if (!ids.includes(item.id) && !ids.includes(item.driveFileId ?? "")) continue;
    if (seen.has(item.id)) continue;
    const src = photoSrc(item);
    if (!src) continue;
    seen.add(item.id);
    n += 1;
    out.push({ id: item.id, src, n: String(n).padStart(2, "0") });
  }
  return out;
}

export function toKundeTf(tf: Tf, fields: FieldItem[]): KundeReportView {
  return {
    id: tf.id,
    number: tf.number,
    pad: tf.number,
    createdAt: tf.createdAt,
    employeeName: "",
    location: "",
    point: "",
    part: TF_PART,
    task: (tf.title ?? "").trim() || tf.question,
    qcScope: "",
    qcMethod: "",
    criteria: "",
    deviations: tf.answer || "",
    photos: fieldPhotos(tf.photoIds ?? [], fields),
    kind: "tf",
    body: tf.question,
  };
}

export function toKundeEr(ent: Entrepreneur, fields: FieldItem[]): KundeReportView {
  return {
    id: ent.id,
    number: ent.number,
    pad: ent.number,
    createdAt: ent.createdAt,
    employeeName: "",
    location: ent.location || "",
    point: "",
    part: ER_PART,
    task: ent.title,
    qcScope: "",
    qcMethod: "",
    criteria: "",
    deviations: (ent.noteHe || "").trim(),
    photos: fieldPhotos(ent.photoIds ?? [], fields),
    kind: "er",
    body: ent.body,
  };
}

function sortParts(parts: KundePart[], projectId: string) {
  const plan = planForProject(projectId);
  const udbud = new Set(plan.map((p) => p.code));
  return [...parts].sort((a, b) => {
    if (a.code === OVRIGE_PART.code) return 1;
    if (b.code === OVRIGE_PART.code) return -1;
    const aU = udbud.has(a.code);
    const bU = udbud.has(b.code);
    if (aU && bU) return a.code.localeCompare(b.code);
    if (aU) return -1;
    if (bU) return 1;
    return a.title.localeCompare(b.title, "da");
  });
}

export function buildKundeSite(opts: {
  project: Project;
  reports: KsReport[];
  photos: KsPhoto[];
  publishedIds?: string[] | null;
  tfs?: Tf[];
  ents?: Entrepreneur[];
  fieldItems?: FieldItem[];
}): KundeSite {
  const job = kundeMeta(opts.project);
  const allow = opts.publishedIds ? new Set(opts.publishedIds) : null;
  const chosen = opts.reports.filter((r) => {
    if (r.trashedAt) return false;
    if (r.projectId !== opts.project.id) return false;
    if (allow) return allow.has(r.id) || isPublished(r);
    return isPublished(r);
  });
  const views = chosen
    .map((r) => toKundeReport(r, opts.project, opts.photos))
    .sort((a, b) => a.part.code.localeCompare(b.part.code) || Number(a.number) - Number(b.number) || a.number.localeCompare(b.number));
  const parts: KundePart[] = [];
  const seen = new Set<string>();
  for (const r of views) {
    if (seen.has(r.part.code)) continue;
    seen.add(r.part.code);
    parts.push(r.part);
  }
  return { job, parts: sortParts(parts, opts.project.id), reports: views, published: views.length };
}

export function bundledKundeInputs() {
  return { reports: [...softrKsReports(), ...SEED_KS_REPORTS], photos: [...softrKsPhotos(), ...seedDrivePhotos()], projects: PROJECTS };
}

export function kundePath(slug: string, extra: string[] = []) {
  return ["/kunde", slug, ...extra].join("/");
}

export function pdfFilename(job: KundeJobMeta, iso = new Date().toISOString()) {
  const day = iso.slice(0, 10);
  const sag = slugFromName(job.name).replace(/-/g, "") || "sag";
  const trade = slugFromName(job.trade).replace(/-/g, "") || "murvaerk";
  return `Zenko_KS_${sag}_${trade}_${day}.pdf`;
}

export type KundeReportPayload = KundeReportView;

export function snapshotKundeReport(report: KsReport, job: Project, photos: KsPhoto[]): KundeReportPayload {
  return toKundeReport(report, job, photos);
}
