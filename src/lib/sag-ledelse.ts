import { FIRM, FIRM_CVR, FIRM_LINE, FIRM_MAIL, FIRM_PHONE, PROJECTS } from "./seed.ts";
import { slugForProject, slugFromName, isKundeSlug, projectIdFromSlug, kundeMeta, toKundeReport, padReportNo } from "./ks-customer.ts";
import { scanForProject } from "./udbud-plan.ts";
import { softrAsFieldItems, softrAsSlips } from "./softr-as.ts";
import { softrErReports } from "./softr-er.ts";
import { softrTfReports } from "./softr-tf.ts";
import { SEED_ENTS, SEED_FIELD_ITEMS, SEED_SLIPS, SEED_TFS } from "./seed.ts";
import { photoSrc } from "./tf-share.ts";
import { defaultLedelseStatus } from "./sag-ledelse-defaults.ts";
import type { Entrepreneur, FieldItem, KsPhoto, KsReport, LedelseReply, Offer, Project, Slip, Tf } from "./types.ts";

export type SagKind = "tf" | "as" | "tb" | "er";

export type SagPhoto = { id: string; src: string; n: string };

export type SagMaterial = { text: string; amount: number | null };

export type SagJobMeta = {
  slug: string;
  projectId: string;
  name: string;
  client: string;
  address: string;
  trade: string;
  period: string;
  qualityManager: string;
  scope: string;
  cvr: string;
  phone: string;
  mail: string;
  firm: string;
  firmLine: string;
};

export type SagTfView = {
  id: string;
  number: string;
  slug: string;
  title: string;
  body: string;
  createdAt: string;
  answered: boolean;
  location: string;
  customer: string;
  projectName: string;
  address: string;
  photos: SagPhoto[];
  replies: LedelseReply[];
};

export type SagAsView = {
  id: string;
  number: string;
  slug: string;
  title: string;
  body: string;
  description: string;
  location: string;
  createdAt: string;
  customer: string;
  projectName: string;
  address: string;
  price: number | null;
  priceLabel: string;
  note: string;
  materials: SagMaterial[];
  photos: SagPhoto[];
  replies: LedelseReply[];
};

export type SagErView = {
  id: string;
  number: string;
  slug: string;
  title: string;
  body: string;
  location: string;
  createdAt: string;
  customer: string;
  projectName: string;
  address: string;
  note: string;
  photos: SagPhoto[];
  replies: LedelseReply[];
};

export type SagKsView = {
  id: string;
  number: string;
  slug: string;
  title: string;
  createdAt: string;
  location: string;
  point: string;
  partCode: string;
  partTitle: string;
  task: string;
  qcScope: string;
  qcMethod: string;
  deviations: string;
  employeeName: string;
  photos: SagPhoto[];
  replies: LedelseReply[];
};

export type SagSite = {
  job: SagJobMeta;
  tfs: SagTfView[];
  slips: SagAsView[];
  tbs: SagAsView[];
  ents: SagErView[];
  kss: SagKsView[];
};

export { slugForProject, slugFromName, isKundeSlug, projectIdFromSlug };

export function sagPath(slug: string, extra: string[] = []) {
  return ["/sag", slug, ...extra].join("/");
}

export function isLedelseOn(row: { ledelseStatus?: string; trashedAt?: string }) {
  return row.ledelseStatus === "med_til_ledelse" && !row.trashedAt;
}

export function priceNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw !== 0 ? Math.round(raw) : null;
  const digits = String(raw || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round(n);
}

export function priceLabel(raw: string | number | null | undefined) {
  const n = priceNumber(raw);
  if (n == null) return "—";
  return `${n.toLocaleString("da-DK")},-`;
}

export function parseAsMaterials(body: string): { description: string; lines: SagMaterial[] } {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const split = text.split(/\bMaterialer\b/i);
  const description = (split[0] || "").trim();
  const rest = (split[1] || "").trim();
  if (!rest) return { description: description || text.trim(), lines: [] };
  const lines = rest
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, amount: amountFromLine(line) }));
  return { description, lines };
}

function amountFromLine(line: string): number | null {
  const dotted = [...line.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*(?:,-)?/g)];
  if (dotted.length) return priceNumber(dotted[dotted.length - 1]![1]);
  const dash = line.match(/(\d+)\s*,-/);
  if (dash) return priceNumber(dash[1]);
  return null;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) if (!map.has(row.id)) map.set(row.id, row);
  return [...map.values()];
}

function photosOf(ids: string[], fieldItems: FieldItem[]): SagPhoto[] {
  const out: SagPhoto[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const item of fieldItems) {
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

function withDefault<T extends { number: string; ledelseStatus?: string }>(kind: SagKind, row: T): T {
  if (row.ledelseStatus) return row;
  return { ...row, ledelseStatus: defaultLedelseStatus(kind, row.number) };
}

export function sagJobMeta(project: Project, extra?: Partial<SagJobMeta>): SagJobMeta {
  const kunde = kundeMeta(project);
  const scan = scanForProject(project.id);
  return {
    slug: slugForProject(project),
    projectId: project.id,
    name: extra?.name || project.name,
    client: extra?.client || kunde.client || scan.meta.client || "",
    address: extra?.address || scan.meta.address || project.address || "",
    trade: extra?.trade || project.trade || kunde.trade || "",
    period: extra?.period || project.period || kunde.period || "",
    qualityManager: extra?.qualityManager || project.qualityManager || kunde.qualityManager || "",
    scope: extra?.scope || kunde.scope || scan.meta.scope || "",
    cvr: FIRM_CVR,
    phone: FIRM_PHONE,
    mail: FIRM_MAIL,
    firm: FIRM,
    firmLine: FIRM_LINE,
  };
}

export function sagJobFields(job: SagJobMeta) {
  const rows: [string, string][] = [
    ["Til", job.client],
    ["Entreprise", job.trade],
    ["Adresse", job.address],
    ["Omfang", job.scope],
    ["Periode", job.period],
    ["Sagsansvarlig", job.qualityManager],
  ];
  return rows.filter(([, v]) => v.trim());
}

function reportSlug(number: string) {
  return String(number)
    .trim()
    .replace(/^(AS|ER|TB)[-.\s]*/i, "")
    .replace(/\s+/g, "")
    .slice(0, 40);
}

export function toSagTf(tf: Tf, job: Project, fields: FieldItem[]): SagTfView | null {
  const row = withDefault("tf", tf);
  if (!isLedelseOn(row)) return null;
  return {
    id: tf.id,
    number: tf.number,
    slug: reportSlug(tf.number) || tf.number,
    title: (tf.title ?? "").trim() || tf.question,
    body: tf.question,
    createdAt: tf.createdAt,
    answered: Boolean(tf.answered || tf.ledelseReplies?.length),
    location: "",
    customer: job.customer || "",
    projectName: job.name,
    address: job.address,
    photos: photosOf(tf.photoIds ?? [], fields),
    replies: tf.ledelseReplies ?? (tf.answer ? [{ id: "seed", text: tf.answer, at: tf.answeredAt || tf.createdAt }] : []),
  };
}

export function toSagAs(slip: Slip, job: Project, fields: FieldItem[]): SagAsView | null {
  const row = withDefault("as", slip);
  if (!isLedelseOn(row)) return null;
  const parsed = parseAsMaterials(slip.body);
  const note = (slip.masterSolution || "").trim();
  return {
    id: slip.id,
    number: slip.number,
    slug: reportSlug(slip.number),
    title: slip.title,
    body: slip.body,
    description: parsed.description,
    location: slip.location,
    createdAt: slip.createdAt,
    customer: job.customer || "",
    projectName: job.name,
    address: job.address,
    price: priceNumber(slip.customerPrice),
    priceLabel: priceLabel(slip.customerPrice),
    note: /ingen/i.test(note) ? "" : note,
    materials: parsed.lines,
    photos: photosOf(slip.photoIds ?? [], fields),
    replies: slip.ledelseReplies ?? [],
  };
}

export function toSagTb(offer: Offer, job: Project, fields: FieldItem[]): SagAsView | null {
  const row = withDefault("tb", offer);
  if (!isLedelseOn(row)) return null;
  return toSagAs({ ...offer, ledelseStatus: "med_til_ledelse" }, job, fields);
}

export function toSagEr(ent: Entrepreneur, job: Project, fields: FieldItem[]): SagErView | null {
  const row = withDefault("er", ent);
  if (!isLedelseOn(row)) return null;
  const note = (ent.noteHe || "").trim();
  return {
    id: ent.id,
    number: ent.number,
    slug: reportSlug(ent.number),
    title: ent.title,
    body: ent.body,
    location: ent.location,
    createdAt: ent.createdAt,
    customer: job.customer || "",
    projectName: job.name,
    address: job.address,
    note: /ingen/i.test(note) ? "" : note,
    photos: photosOf(ent.photoIds ?? [], fields),
    replies: ent.ledelseReplies ?? [],
  };
}

export function toSagKs(report: KsReport, job: Project, photos: KsPhoto[]): SagKsView | null {
  if (report.trashedAt) return null;
  const view = toKundeReport(report, job, photos);
  return {
    id: view.id,
    number: view.number,
    slug: padReportNo(view.number),
    title: view.task || view.part.title,
    createdAt: view.createdAt,
    location: view.location,
    point: view.point,
    partCode: view.part.code,
    partTitle: view.part.title,
    task: view.task,
    qcScope: view.qcScope,
    qcMethod: view.qcMethod,
    deviations: view.deviations,
    employeeName: view.employeeName,
    photos: view.photos,
    replies: report.ledelseReplies ?? [],
  };
}

export function buildSagSite(opts: {
  project: Project;
  tfs: Tf[];
  slips: Slip[];
  tbs?: Offer[];
  ents: Entrepreneur[];
  kss?: KsReport[];
  ksPhotos?: KsPhoto[];
  fieldItems: FieldItem[];
  published?: { tf?: string[]; as?: string[]; tb?: string[]; er?: string[] } | null;
  jobExtra?: Partial<SagJobMeta>;
}): SagSite {
  const job = sagJobMeta(opts.project, opts.jobExtra);
  const allow = opts.published;
  const tfOk = (r: Tf) => (allow?.tf ? allow.tf.includes(r.id) || isLedelseOn(withDefault("tf", r)) : isLedelseOn(withDefault("tf", r)));
  const asOk = (r: Slip) => (allow?.as ? allow.as.includes(r.id) || isLedelseOn(withDefault("as", r)) : isLedelseOn(withDefault("as", r)));
  const tbOk = (r: Offer) => (allow?.tb ? allow.tb.includes(r.id) || isLedelseOn(withDefault("tb", r)) : isLedelseOn(withDefault("tb", r)));
  const erOk = (r: Entrepreneur) => (allow?.er ? allow.er.includes(r.id) || isLedelseOn(withDefault("er", r)) : isLedelseOn(withDefault("er", r)));
  const tfs = opts.tfs
    .filter((r) => r.projectId === opts.project.id && !r.trashedAt && tfOk(r))
    .map((r) => toSagTf({ ...r, ledelseStatus: "med_til_ledelse" }, opts.project, opts.fieldItems))
    .filter((r): r is SagTfView => Boolean(r))
    .sort((a, b) => a.number.localeCompare(b.number, "da"));
  const slips = opts.slips
    .filter((r) => r.projectId === opts.project.id && !r.trashedAt && asOk(r))
    .map((r) => toSagAs({ ...r, ledelseStatus: "med_til_ledelse" }, opts.project, opts.fieldItems))
    .filter((r): r is SagAsView => Boolean(r))
    .sort((a, b) => Number(reportSlug(a.number)) - Number(reportSlug(b.number)) || a.number.localeCompare(b.number, "da"));
  const tbs = (opts.tbs ?? [])
    .filter((r) => r.projectId === opts.project.id && !r.trashedAt && tbOk(r))
    .map((r) => toSagTb({ ...r, ledelseStatus: "med_til_ledelse" }, opts.project, opts.fieldItems))
    .filter((r): r is SagAsView => Boolean(r))
    .sort((a, b) => a.number.localeCompare(b.number, "da"));
  const ents = opts.ents
    .filter((r) => r.projectId === opts.project.id && !r.trashedAt && erOk(r))
    .map((r) => toSagEr({ ...r, ledelseStatus: "med_til_ledelse" }, opts.project, opts.fieldItems))
    .filter((r): r is SagErView => Boolean(r))
    .sort((a, b) => a.number.localeCompare(b.number, "da"));
  const kss = (opts.kss ?? [])
    .filter((r) => r.projectId === opts.project.id && !r.trashedAt)
    .map((r) => toSagKs(r, opts.project, opts.ksPhotos ?? []))
    .filter((r): r is SagKsView => Boolean(r))
    .sort((a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number, "da"));
  return { job, tfs, slips, tbs, ents, kss };
}

export function bundledSagInputs() {
  return {
    projects: PROJECTS,
    tfs: uniqueById([...softrTfReports(), ...SEED_TFS]),
    slips: uniqueById([...softrAsSlips(), ...SEED_SLIPS]),
    ents: uniqueById([...softrErReports(), ...SEED_ENTS]),
    fieldItems: uniqueById([...softrAsFieldItems(), ...SEED_FIELD_ITEMS]),
  };
}

export function asPdfFilename(job: SagJobMeta, iso = new Date().toISOString()) {
  const day = iso.slice(0, 10);
  const sag = slugFromName(job.name).replace(/-/g, "") || "sag";
  return `Zenko_AS_${sag}_${day}.pdf`;
}

export function sumAsPrices(rows: Pick<SagAsView, "price">[]) {
  let sum = 0;
  let missing = 0;
  for (const r of rows) {
    if (r.price == null) missing += 1;
    else sum += r.price;
  }
  return { sum, missing, label: sum ? `${sum.toLocaleString("da-DK")},-` : "—" };
}

export const SAG_PAGE_SIZE = 20;

export function tfCounts(tfs: Pick<SagTfView, "answered" | "replies">[]) {
  const answered = tfs.filter((t) => t.answered || (t.replies && t.replies.length > 0)).length;
  return { total: tfs.length, answered, open: tfs.length - answered };
}

export function matchesQuery(hay: string, q: string) {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return hay.toLowerCase().includes(n);
}

export function matchesDay(iso: string, ymd: string) {
  if (!ymd.trim()) return true;
  return iso.slice(0, 10) === ymd.trim();
}

export function paginate<T>(rows: T[], page: number, size = SAG_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { page: p, pages, total: rows.length, slice: rows.slice((p - 1) * size, p * size) };
}

export function filterTfs(rows: SagTfView[], opts: { q?: string; status?: "all" | "open" | "answered"; day?: string }) {
  const q = opts.q ?? "";
  const status = opts.status ?? "all";
  const day = opts.day ?? "";
  return rows.filter((r) => {
    if (status === "open" && (r.answered || r.replies.length)) return false;
    if (status === "answered" && !(r.answered || r.replies.length)) return false;
    if (!matchesDay(r.createdAt, day)) return false;
    return matchesQuery(`${r.number} ${r.title} ${r.body} ${r.location}`, q);
  });
}

export function filterAs(rows: SagAsView[], opts: { q?: string; day?: string; minPrice?: number | null }) {
  const q = opts.q ?? "";
  const day = opts.day ?? "";
  const min = opts.minPrice ?? null;
  return rows.filter((r) => {
    if (!matchesDay(r.createdAt, day)) return false;
    if (min != null && (r.price == null || r.price < min)) return false;
    return matchesQuery(`${r.number} ${r.title} ${r.body} ${r.description} ${r.priceLabel}`, q);
  });
}

export function filterEr(rows: SagErView[], opts: { q?: string; day?: string }) {
  const q = opts.q ?? "";
  const day = opts.day ?? "";
  return rows.filter((r) => {
    if (!matchesDay(r.createdAt, day)) return false;
    return matchesQuery(`${r.number} ${r.title} ${r.body} ${r.location}`, q);
  });
}

export function filterKs(rows: SagKsView[], opts: { q?: string; day?: string }) {
  const q = opts.q ?? "";
  const day = opts.day ?? "";
  return rows.filter((r) => {
    if (!matchesDay(r.createdAt, day)) return false;
    return matchesQuery(`${r.number} ${r.title} ${r.task} ${r.location} ${r.partTitle} ${r.point}`, q);
  });
}
