import { photoSrc, type TfSharePhoto } from "./tf-share.ts";
import { projectById, SEED_ENTS, SEED_FIELD_ITEMS, SEED_KS_REPORTS, SEED_SLIPS, SEED_TFS } from "./seed.ts";
import { softrAsFieldItems, softrAsSlips } from "./softr-as.ts";
import { softrErReports } from "./softr-er.ts";
import { softrKsPhotos, softrKsReports } from "./softr-ks.ts";
import { softrTfReports } from "./softr-tf.ts";
import type { Entrepreneur, FieldItem, KsPhoto, KsReport, Project, Slip, Tf } from "./types";

export type ShareKind = "ks" | "as" | "tf" | "er";

export type ReportSharePhoto = TfSharePhoto & { caption?: string };

export type ReportSharePayload = {
  kind: ShareKind;
  id: string;
  number: string;
  createdAt: string;
  projectName: string;
  address: string;
  customer: string;
  title: string;
  body: string;
  location: string;
  extra: Record<string, string>;
  photos: ReportSharePhoto[];
};

export type ReportShareRecord = ReportSharePayload & {
  answer: string;
  answeredAt: string | null;
  answeredBy: string;
};

const KIND_RE = /^(ks|as|tf|er)$/;
const SLUG_RE = /^[A-Za-z0-9._-]{1,40}$/;

export function isShareKind(value: string): value is ShareKind {
  return KIND_RE.test(value);
}

export function shareSlug(number: string) {
  const raw = String(number).trim();
  const stripped = raw.replace(/^(AS|TF|ER|KS)[-.\s]*/i, "").replace(/\s+/g, "");
  const slug = (stripped || raw).replace(/[^A-Za-z0-9._-]/g, "");
  return slug.slice(0, 40);
}

export function isShareSlug(value: string) {
  return SLUG_RE.test(value.trim());
}

export function matchesShareSlug(number: string, slug: string) {
  return shareSlug(number) === shareSlug(slug);
}

export function reportSharePath(kind: ShareKind, number: string) {
  return `/r/${kind}/${shareSlug(number)}`;
}

export function shareKindLabel(kind: ShareKind) {
  if (kind === "ks") return "Proceskontrol";
  if (kind === "as") return "Aftaleseddel";
  if (kind === "tf") return "Teknisk forespørgsel";
  return "Entreprenørrapport";
}

export function asShareRecord(payload: ReportSharePayload, extras?: Partial<Pick<ReportShareRecord, "answer" | "answeredAt" | "answeredBy">>): ReportShareRecord {
  return {
    ...payload,
    answer: extras?.answer ?? payload.extra.answer ?? "",
    answeredAt: extras?.answeredAt ?? payload.extra.answeredAt ?? null,
    answeredBy: extras?.answeredBy ?? payload.extra.answeredBy ?? "",
  };
}

function collectFieldPhotos(ids: string[], fieldItems: FieldItem[]): ReportSharePhoto[] {
  const photos: ReportSharePhoto[] = [];
  for (const item of fieldItems) {
    if (!ids.includes(item.id) && !ids.includes(item.driveFileId ?? "")) continue;
    const src = photoSrc(item);
    if (!src) continue;
    photos.push({ id: item.id, name: item.name, src });
  }
  return photos;
}

export function buildAsSharePayload(slip: Slip, job: Project, fieldItems: FieldItem[]): ReportSharePayload {
  return {
    kind: "as",
    id: slip.id,
    number: slip.number,
    createdAt: slip.createdAt,
    projectName: job.name,
    address: job.address,
    customer: job.customer || "Ole Jepsen A/S",
    title: slip.title,
    body: slip.body,
    location: slip.location,
    extra: {
      masterSolution: slip.masterSolution || "",
      customerPrice: slip.customerPrice || "",
    },
    photos: collectFieldPhotos(slip.photoIds, fieldItems),
  };
}

export function buildTfShareReportPayload(tf: Tf, job: Project, fieldItems: FieldItem[]): ReportSharePayload {
  return {
    kind: "tf",
    id: tf.id,
    number: tf.number,
    createdAt: tf.createdAt,
    projectName: job.name,
    address: job.address,
    customer: job.customer || "Ole Jepsen A/S",
    title: (tf.title ?? "").trim() || tf.question,
    body: tf.question,
    location: "",
    extra: {},
    photos: collectFieldPhotos(tf.photoIds, fieldItems),
  };
}

export function buildErSharePayload(ent: Entrepreneur, job: Project, fieldItems: FieldItem[]): ReportSharePayload {
  return {
    kind: "er",
    id: ent.id,
    number: ent.number,
    createdAt: ent.createdAt,
    projectName: job.name,
    address: job.address,
    customer: job.customer || "Ole Jepsen A/S",
    title: ent.title,
    body: ent.body,
    location: ent.location,
    extra: { noteHe: ent.noteHe || "" },
    photos: collectFieldPhotos(ent.photoIds, fieldItems),
  };
}

export function buildKsSharePayload(report: KsReport, job: Project, photos: KsPhoto[]): ReportSharePayload {
  const ids = report.photoIds ?? [];
  const hits = photos.filter((p) => ids.includes(p.id) || ids.includes(p.driveFileId ?? "") || p.id.startsWith(`softr-ks-${report.number}-`));
  const seen = new Set<string>();
  const out: ReportSharePhoto[] = [];
  for (const p of hits) {
    if (seen.has(p.id)) continue;
    const src = photoSrc({ dataUrl: p.dataUrl, driveUrl: p.driveUrl, driveFileId: p.driveFileId });
    if (!src) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.originalName || p.id,
      src,
      caption: [p.point, p.employeeName, p.floor, p.room].filter(Boolean).join(" · "),
    });
  }
  return {
    kind: "ks",
    id: report.id,
    number: report.number,
    createdAt: report.createdAt,
    projectName: job.name,
    address: job.address,
    customer: job.customer || "Ole Jepsen A/S",
    title: report.task || report.point,
    body: report.deviations?.trim() || "Ingen afvigelser.",
    location: report.location || "",
    extra: {
      point: report.point,
      crew: report.crew || "",
      employeeName: report.employeeName || "",
      process: report.process || "Murerarbejde",
      trade: report.trade || "Murer",
      company: report.company || "Zenko Danmark ApS",
      qcScope: report.qcScope || "",
      qcMethod: report.qcMethod || "",
      approved: report.approved === false ? "Nej" : "Ja",
    },
    photos: out,
  };
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) if (!map.has(row.id)) map.set(row.id, row);
  return [...map.values()];
}

function bundledFields(): FieldItem[] {
  return [...softrAsFieldItems(), ...SEED_FIELD_ITEMS];
}

/** Rapport fra lokale Softr/seed-data — gæstesiden virker uden login og uden at nogen har trykket Kopiér. */
export function bundledSharePayload(kind: ShareKind, slug: string): ReportSharePayload | null {
  const key = shareSlug(slug);
  if (!key) return null;
  const jobOf = (projectId: string) => projectById(projectId);
  const fields = bundledFields();
  if (kind === "ks") {
    const row = uniqueById([...softrKsReports(), ...SEED_KS_REPORTS]).find((r) => matchesShareSlug(r.number, key));
    if (!row) return null;
    return buildKsSharePayload(row, jobOf(row.projectId), softrKsPhotos());
  }
  if (kind === "as") {
    const row = uniqueById([...softrAsSlips(), ...SEED_SLIPS]).find((r) => matchesShareSlug(r.number, key));
    if (!row) return null;
    return buildAsSharePayload(row, jobOf(row.projectId), fields);
  }
  if (kind === "tf") {
    const row = uniqueById([...softrTfReports(), ...SEED_TFS]).find((r) => matchesShareSlug(r.number, key));
    if (!row) return null;
    return buildTfShareReportPayload(row, jobOf(row.projectId), fields);
  }
  const row = uniqueById([...softrErReports(), ...SEED_ENTS]).find((r) => matchesShareSlug(r.number, key));
  if (!row) return null;
  return buildErSharePayload(row, jobOf(row.projectId), fields);
}

export function bundledShareRecord(kind: ShareKind, slug: string): ReportShareRecord | null {
  const payload = bundledSharePayload(kind, slug);
  if (!payload) return null;
  if (payload.kind === "tf") {
    const tf = uniqueById([...softrTfReports(), ...SEED_TFS]).find((r) => r.id === payload.id);
    if (tf?.answer) {
      return asShareRecord(payload, {
        answer: tf.answer,
        answeredAt: tf.answeredAt ?? tf.createdAt,
        answeredBy: tf.answeredBy ?? "",
      });
    }
  }
  return asShareRecord(payload);
}

export function reportMailCopy(row: ReportSharePayload, url: string) {
  const kind = shareKindLabel(row.kind);
  const headline = row.title || row.number;
  return {
    subject: `${kind} ${row.number} — ${row.projectName}`,
    body: `Hej,\n\nHer er ${kind.toLowerCase()} ${row.number} vedr. ${headline} på ${row.projectName}.\n\nÅbn rapporten her (kun rapporten — ingen login, ingen app):\n${url}\n\nVenlig hilsen\nZenko Danmark`,
  };
}
