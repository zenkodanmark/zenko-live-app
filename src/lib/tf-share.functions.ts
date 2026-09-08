import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { isShareToken, type TfSharePayload, type TfShareRecord } from "./tf-share";

type ShareRow = {
  token: string;
  tf_id: string;
  payload: TfSharePayload | string;
  answer: string;
  answered_at: string | Date | null;
  answered_by: string;
};

function parsePayload(raw: TfSharePayload | string): TfSharePayload | null {
  if (!raw) return null;
  const obj = typeof raw === "string" ? (JSON.parse(raw) as TfSharePayload) : raw;
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.tfId !== "string" || typeof obj.number !== "string") return null;
  return {
    tfId: obj.tfId,
    number: obj.number,
    title: String(obj.title ?? ""),
    question: String(obj.question ?? ""),
    createdAt: String(obj.createdAt ?? ""),
    projectName: String(obj.projectName ?? ""),
    address: String(obj.address ?? ""),
    customer: String(obj.customer ?? ""),
    photos: Array.isArray(obj.photos)
      ? obj.photos
          .filter((p) => p && typeof p.src === "string")
          .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? ""), src: String(p.src) }))
      : [],
  };
}

function iso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toRecord(row: ShareRow): TfShareRecord | null {
  const payload = parsePayload(row.payload);
  if (!payload) return null;
  return {
    ...payload,
    token: row.token,
    answer: row.answer ?? "",
    answeredAt: iso(row.answered_at),
    answeredBy: row.answered_by ?? "",
  };
}

export const publishTfShare = createServerFn({ method: "POST" })
  .validator((input: { token: string; tfId: string; payload: TfSharePayload }) => input)
  .handler(async ({ data }) => {
    if (!isShareToken(data.token) || !data.tfId.trim()) return { ok: false as const, error: "bad-token" };
    const sql = await getSql();
    await sql.query(
      `insert into tf_shares (token, tf_id, payload, updated_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (token) do update set
         tf_id = excluded.tf_id,
         payload = excluded.payload,
         updated_at = now()`,
      [data.token, data.tfId, JSON.stringify(data.payload)],
    );
    return { ok: true as const, token: data.token };
  });

export const getTfShare = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    if (!isShareToken(data.token)) return { ok: false as const, error: "missing" as const };
    const sql = await getSql();
    const rows = await sql.query<ShareRow>("select token, tf_id, payload, answer, answered_at, answered_by from tf_shares where token = $1 limit 1", [
      data.token,
    ]);
    const record = rows[0] ? toRecord(rows[0]) : null;
    if (!record) return { ok: false as const, error: "missing" as const };
    return { ok: true as const, share: record };
  });

export const answerTfShare = createServerFn({ method: "POST" })
  .validator((input: { token: string; answer: string; answeredBy?: string }) => input)
  .handler(async ({ data }) => {
    if (!isShareToken(data.token)) return { ok: false as const, error: "missing" as const };
    const answer = data.answer.trim().slice(0, 8000);
    if (!answer) return { ok: false as const, error: "empty" as const };
    const who = (data.answeredBy ?? "").trim().slice(0, 120);
    const sql = await getSql();
    const rows = await sql.query<ShareRow>(
      `update tf_shares
       set answer = $2, answered_by = $3, answered_at = now(), updated_at = now()
       where token = $1
       returning token, tf_id, payload, answer, answered_at, answered_by`,
      [data.token, answer, who],
    );
    const record = rows[0] ? toRecord(rows[0]) : null;
    if (!record) return { ok: false as const, error: "missing" as const };
    return { ok: true as const, share: record };
  });
