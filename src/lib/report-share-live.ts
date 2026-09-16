import { softrKsPhotos } from "./softr-ks.ts";
import { projectById } from "./seed.ts";
import { supabase } from "./supabase.ts";
import {
  asShareRecord,
  buildAsSharePayload,
  buildErSharePayload,
  buildKsSharePayload,
  buildTfShareReportPayload,
  matchesShareKey,
  shareLookupKeys,
  type ReportShareRecord,
  type ShareKind,
} from "./report-share.ts";
import { entFromRow, fieldFromRow, ksFromRow, projectFromRow, slipFromRow, tfFromRow } from "./sb-rows.ts";
import { isLedelseOn } from "./sag-ledelse.ts";
import type { FieldItem, KsPhoto, KsReport, Project } from "./types.ts";

const TABLE: Record<ShareKind, string> = {
  as: "slips",
  tb: "offers",
  tf: "tfs",
  er: "ents",
  ks: "ks_reports",
};

function isPublicLedelse(row: { ledelseStatus?: string; trashedAt?: string }) {
  return isLedelseOn(row);
}

async function fetchByKeys(table: string, keys: string[]): Promise<Record<string, unknown>[]> {
  if (!keys.length) return [];
  try {
    const or = keys.flatMap((k) => [`id.eq.${k}`, `number.eq.${k}`]).join(",");
    const { data, error } = await supabase().from(table).select("*").or(or).limit(25);
    if (error || !data) return [];
    return data as Record<string, unknown>[];
  } catch {
    return [];
  }
}

async function fetchProject(id: string): Promise<Project> {
  if (!id) return projectById(id);
  try {
    const { data, error } = await supabase().from("projects").select("*").eq("id", id).maybeSingle();
    if (!error && data) return projectFromRow(data as Record<string, unknown>);
  } catch {
    /* seed fallback */
  }
  return projectById(id);
}

async function fetchFields(ids: string[]): Promise<FieldItem[]> {
  const want = ids.filter(Boolean).slice(0, 40);
  if (!want.length) return [];
  try {
    const { data, error } = await supabase().from("field_items").select("*").in("id", want).limit(40);
    if (error || !data) return [];
    return data.map((r) => fieldFromRow(r as Record<string, unknown>)).filter((f) => f.id);
  } catch {
    return [];
  }
}

function pickRow<T extends { id: string; number: string }>(rows: T[], slug: string): T | null {
  return rows.find((r) => matchesShareKey(r, slug)) ?? rows[0] ?? null;
}

function ksWithLedelse(raw: Record<string, unknown>): KsReport {
  const row = ksFromRow(raw);
  const status = String(raw.ledelse_status ?? "");
  if (status === "med_til_ledelse" || status === "skjult") return { ...row, ledelseStatus: status };
  return row;
}

export async function loadLiveShare(kind: ShareKind, slug: string): Promise<ReportShareRecord | null> {
  const keys = shareLookupKeys(kind, slug);
  const rawRows = await fetchByKeys(TABLE[kind], keys);
  if (!rawRows.length) return null;

  if (kind === "as" || kind === "tb") {
    const slips = rawRows.map(slipFromRow).filter((r) => r.id);
    const slip = pickRow(slips, slug);
    if (!slip || !isPublicLedelse(slip)) return null;
    const job = await fetchProject(slip.projectId);
    const fields = await fetchFields(slip.photoIds ?? []);
    const payload = buildAsSharePayload(slip, job, fields);
    return asShareRecord(kind === "tb" ? { ...payload, kind: "tb" } : payload);
  }

  if (kind === "tf") {
    const tfs = rawRows.map(tfFromRow).filter((r) => r.id);
    const tf = pickRow(tfs, slug);
    if (!tf || !isPublicLedelse(tf)) return null;
    const job = await fetchProject(tf.projectId);
    const fields = await fetchFields(tf.photoIds ?? []);
    const payload = buildTfShareReportPayload(tf, job, fields);
    return asShareRecord(payload, {
      answer: tf.answer ?? "",
      answeredAt: tf.answeredAt ?? null,
      answeredBy: tf.answeredBy ?? "",
    });
  }

  if (kind === "er") {
    const ents = rawRows.map(entFromRow).filter((r) => r.id);
    const ent = pickRow(ents, slug);
    if (!ent || !isPublicLedelse(ent)) return null;
    const job = await fetchProject(ent.projectId);
    const fields = await fetchFields(ent.photoIds ?? []);
    return asShareRecord(buildErSharePayload(ent, job, fields));
  }

  const reports = rawRows.map(ksWithLedelse).filter((r) => r.id);
  const report = pickRow(reports, slug);
  if (!report || !isPublicLedelse(report)) return null;
  const job = await fetchProject(report.projectId);
  const photos: KsPhoto[] = softrKsPhotos();
  return asShareRecord(buildKsSharePayload(report, job, photos));
}

