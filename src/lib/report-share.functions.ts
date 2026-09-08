import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { bundledShareRecord, isShareKind, isShareSlug, type ReportSharePayload, type ReportShareRecord, type ShareKind } from "./report-share";

type ShareRow = {
  kind: string;
  number: string;
  report_id: string;
  payload: ReportSharePayload | string;
  answer: string;
  answered_at: string | Date | null;
  answered_by: string;
};

function parsePayload(raw: ReportSharePayload | string): ReportSharePayload | null {
  if (!raw) return null;
  const obj = typeof raw === "string" ? (JSON.parse(raw) as ReportSharePayload) : raw;
  if (!obj || typeof obj !== "object") return null;
  if (!isShareKind(String(obj.kind)) || typeof obj.number !== "string" || typeof obj.id !== "string") return null;
  return {
    kind: obj.kind,
    id: obj.id,
    number: obj.number,
    createdAt: String(obj.createdAt ?? ""),
    projectName: String(obj.projectName ?? ""),
    address: String(obj.address ?? ""),
    customer: String(obj.customer ?? ""),
    title: String(obj.title ?? ""),
    body: String(obj.body ?? ""),
    location: String(obj.location ?? ""),
    extra: obj.extra && typeof obj.extra === "object" ? Object.fromEntries(Object.entries(obj.extra).map(([k, v]) => [k, String(v ?? "")])) : {},
    photos: Array.isArray(obj.photos)
      ? obj.photos
          .filter((p) => p && typeof p.src === "string")
          .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? ""), src: String(p.src), caption: p.caption ? String(p.caption) : undefined }))
      : [],
  };
}

function iso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toRecord(row: ShareRow): ReportShareRecord | null {
  const payload = parsePayload(row.payload);
  if (!payload) return null;
  return {
    ...payload,
    answer: row.answer ?? "",
    answeredAt: iso(row.answered_at),
    answeredBy: row.answered_by ?? "",
  };
}

export const publishReportShare = createServerFn({ method: "POST" })
  .validator((input: { kind: ShareKind; number: string; reportId: string; payload: ReportSharePayload }) => input)
  .handler(async ({ data }) => {
    if (!isShareKind(data.kind) || !isShareSlug(data.number) || !data.reportId.trim()) return { ok: false as const, error: "bad-key" };
    try {
      const sql = await getSql();
      await sql.query(
        `insert into report_shares (kind, number, report_id, payload, updated_at)
         values ($1, $2, $3, $4::jsonb, now())
         on conflict (kind, number) do update set
           report_id = excluded.report_id,
           payload = excluded.payload,
           updated_at = now()`,
        [data.kind, data.number, data.reportId, JSON.stringify(data.payload)],
      );
      return { ok: true as const, kind: data.kind, number: data.number };
    } catch (err) {
      console.error("[report-share] publish failed", err);
      return { ok: false as const, error: "db" };
    }
  });

export const getReportShare = createServerFn({ method: "GET" })
  .validator((input: { kind: string; number: string }) => input)
  .handler(async ({ data }) => {
    if (!isShareKind(data.kind) || !isShareSlug(data.number)) return { ok: false as const, error: "missing" as const };
    try {
      const sql = await getSql();
      const rows = await sql.query<ShareRow>(
        "select kind, number, report_id, payload, answer, answered_at, answered_by from report_shares where kind = $1 and number = $2 limit 1",
        [data.kind, data.number],
      );
      const record = rows[0] ? toRecord(rows[0]) : null;
      if (record) return { ok: true as const, share: record };
    } catch (err) {
      console.error("[report-share] get failed", err);
    }
    const bundled = bundledShareRecord(data.kind, data.number);
    if (bundled) return { ok: true as const, share: bundled };
    return { ok: false as const, error: "missing" as const };
  });

export const answerReportShare = createServerFn({ method: "POST" })
  .validator((input: { kind: string; number: string; answer: string; answeredBy?: string }) => input)
  .handler(async ({ data }) => {
    if (!isShareKind(data.kind) || !isShareSlug(data.number)) return { ok: false as const, error: "missing" as const };
    const answer = data.answer.trim().slice(0, 8000);
    if (!answer) return { ok: false as const, error: "empty" as const };
    const who = (data.answeredBy ?? "").trim().slice(0, 120);
    try {
      const sql = await getSql();
      const rows = await sql.query<ShareRow>(
        `update report_shares
         set answer = $3, answered_by = $4, answered_at = now(), updated_at = now()
         where kind = $1 and number = $2
         returning kind, number, report_id, payload, answer, answered_at, answered_by`,
        [data.kind, data.number, answer, who],
      );
      let record = rows[0] ? toRecord(rows[0]) : null;
      if (!record) {
        const bundled = bundledShareRecord(data.kind, data.number);
        if (!bundled) return { ok: false as const, error: "missing" as const };
        await sql.query(
          `insert into report_shares (kind, number, report_id, payload, answer, answered_by, answered_at, updated_at)
           values ($1, $2, $3, $4::jsonb, $5, $6, now(), now())
           on conflict (kind, number) do update set
             answer = excluded.answer,
             answered_by = excluded.answered_by,
             answered_at = now(),
             updated_at = now()`,
          [data.kind, data.number, bundled.id, JSON.stringify(bundled), answer, who],
        );
        record = { ...bundled, answer, answeredBy: who, answeredAt: new Date().toISOString() };
      }
      return { ok: true as const, share: record };
    } catch (err) {
      console.error("[report-share] answer failed", err);
      return { ok: false as const, error: "missing" as const };
    }
  });
