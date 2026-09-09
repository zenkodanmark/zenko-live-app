import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { isKundeSlug } from "./ks-customer";
import type { LedelseReply, LedelseStatus } from "./types";
import type { SagJobMeta } from "./sag-ledelse";

type ItemRow = { project_id: string; kind: string; report_id: string; status: string };
type ReplyRow = { id: string; project_id: string; tf_id: string; body: string; created_at: string | Date };
type JobRow = { slug: string; project_id: string; payload: unknown };

function iso(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export const getSagLedelse = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug)) return { ok: false as const, error: "missing" as const };
    try {
      const sql = await getSql();
      const jobs = await sql.query<JobRow>("select slug, project_id, payload from sag_ledelse_jobs where slug = $1 limit 1", [data.slug]);
      const job = jobs[0];
      const projectId = job?.project_id ?? "";
      const items = projectId
        ? await sql.query<ItemRow>("select project_id, kind, report_id, status from sag_ledelse_items where project_id = $1", [projectId])
        : [];
      const replies = projectId
        ? await sql.query<ReplyRow>("select id, project_id, tf_id, body, created_at from sag_ledelse_replies where project_id = $1 order by created_at asc", [projectId])
        : [];
      const raw = job?.payload && typeof job.payload === "object" ? (job.payload as Partial<SagJobMeta>) : null;
      return {
        ok: true as const,
        slug: data.slug,
        projectId,
        tracked: items.length > 0 || Boolean(job),
        items: items.map((r) => ({ id: r.report_id, kind: r.kind, status: r.status })),
        replies: replies.map((r) => ({ id: r.id, tfId: r.tf_id, text: r.body, at: iso(r.created_at) })),
        jobExtra: raw,
      };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });

export const setSagLedelseItem = createServerFn({ method: "POST" })
  .validator((input: { slug: string; projectId: string; kind: "tf" | "as" | "tb" | "er"; reportId: string; status: LedelseStatus }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug) || !data.projectId.trim() || !data.reportId.trim()) return { ok: false as const, error: "bad-key" as const };
    const status = data.status === "med_til_ledelse" ? "med_til_ledelse" : "skjult";
    try {
      const sql = await getSql();
      await sql.query(
        `insert into sag_ledelse_jobs (slug, project_id, payload, updated_at)
         values ($1, $2, '{}'::jsonb, now())
         on conflict (slug) do update set project_id = excluded.project_id, updated_at = now()`,
        [data.slug, data.projectId],
      );
      await sql.query(
        `insert into sag_ledelse_items (project_id, kind, report_id, status, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (project_id, kind, report_id) do update set status = excluded.status, updated_at = now()`,
        [data.projectId, data.kind, data.reportId, status],
      );
      return { ok: true as const, status };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });

export const saveSagFields = createServerFn({ method: "POST" })
  .validator((input: { slug: string; projectId: string; fields: Partial<SagJobMeta> }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug) || !data.projectId.trim()) return { ok: false as const, error: "bad-key" as const };
    try {
      const sql = await getSql();
      await sql.query(
        `insert into sag_ledelse_jobs (slug, project_id, payload, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (slug) do update set
           project_id = excluded.project_id,
           payload = sag_ledelse_jobs.payload || excluded.payload,
           updated_at = now()`,
        [data.slug, data.projectId, JSON.stringify(data.fields)],
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });

export const addSagTfReply = createServerFn({ method: "POST" })
  .validator((input: { slug: string; projectId: string; tfId: string; text: string }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug) || !data.projectId.trim() || !data.tfId.trim()) return { ok: false as const, error: "bad-key" as const };
    const text = data.text.trim().slice(0, 8000);
    if (!text) return { ok: false as const, error: "empty" as const };
    const id = `rpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const at = new Date().toISOString();
    try {
      const sql = await getSql();
      await sql.query(
        `insert into sag_ledelse_jobs (slug, project_id, payload, updated_at)
         values ($1, $2, '{}'::jsonb, now())
         on conflict (slug) do update set project_id = excluded.project_id, updated_at = now()`,
        [data.slug, data.projectId],
      );
      await sql.query("insert into sag_ledelse_replies (id, project_id, tf_id, body, created_at) values ($1, $2, $3, $4, $5)", [id, data.projectId, data.tfId, text, at]);
      const rows = await sql.query<ReplyRow>("select id, project_id, tf_id, body, created_at from sag_ledelse_replies where tf_id = $1 order by created_at asc", [data.tfId]);
      const replies: LedelseReply[] = rows.map((r) => ({ id: r.id, text: r.body, at: iso(r.created_at) }));
      return { ok: true as const, reply: { id, text, at }, replies };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });
