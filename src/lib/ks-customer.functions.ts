import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { isKundeSlug, type KundeReportPayload } from "./ks-customer";
import { rememberUdbudPlan, type UdbudPart } from "./udbud-plan";

type JobRow = { slug: string; project_id: string; payload: unknown };
type ReportRow = { project_id: string; report_id: string; status: string; payload: unknown };

function asPayload(raw: unknown): KundeReportPayload | null {
  if (!raw) return null;
  const obj = typeof raw === "string" ? (JSON.parse(raw) as KundeReportPayload) : (raw as KundeReportPayload);
  if (!obj || typeof obj !== "object" || typeof obj.id !== "string") return null;
  return obj;
}

export const getKundeSite = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug)) return { ok: false as const, error: "missing" as const };
    try {
      const sql = await getSql();
      const jobs = await sql.query<JobRow>("select slug, project_id, payload from ks_customer_jobs where slug = $1 limit 1", [data.slug]);
      const job = jobs[0];
      const projectId = job?.project_id ?? "";
      const rows = projectId
        ? await sql.query<ReportRow>(
            "select project_id, report_id, status, payload from ks_customer_reports where project_id = $1",
            [projectId],
          )
        : await sql.query<ReportRow>(
            "select r.project_id, r.report_id, r.status, r.payload from ks_customer_reports r join ks_customer_jobs j on j.project_id = r.project_id where j.slug = $1",
            [data.slug],
          );
      const publishedIds = rows.filter((r) => r.status === "med_til_kunden").map((r) => r.report_id);
      const snapshots = rows
        .filter((r) => r.status === "med_til_kunden")
        .map((r) => asPayload(r.payload))
        .filter((p): p is KundeReportPayload => Boolean(p));
      const raw = job?.payload && typeof job.payload === "object" ? (job.payload as { plan?: UdbudPart[]; fileName?: string; scannedAt?: string; meta?: { name: string; client: string; address: string; scope: string } }) : null;
      if (raw?.plan && job?.project_id) {
        rememberUdbudPlan({
          projectId: job.project_id,
          fileName: raw.fileName ?? "",
          found: Boolean(raw.fileName),
          parts: raw.plan,
          meta: raw.meta ?? { name: "", client: "", address: "", scope: "" },
          scannedAt: raw.scannedAt ?? "",
        });
      }
      return {
        ok: true as const,
        slug: data.slug,
        projectId: projectId || rows[0]?.project_id || "",
        publishedIds,
        snapshots,
        tracked: rows.length > 0,
        plan: raw?.plan ?? null,
        fileName: raw?.fileName ?? "",
        meta: raw?.meta ?? null,
        scannedAt: raw?.scannedAt ?? "",
      };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });

export const setKundeReportStatus = createServerFn({ method: "POST" })
  .validator((input: { slug: string; projectId: string; reportId: string; status: "skjult" | "med_til_kunden"; payload?: KundeReportPayload | null }) => input)
  .handler(async ({ data }) => {
    if (!isKundeSlug(data.slug) || !data.projectId.trim() || !data.reportId.trim()) return { ok: false as const, error: "bad-key" as const };
    const status = data.status === "med_til_kunden" ? "med_til_kunden" : "skjult";
    try {
      const sql = await getSql();
      await sql.query(
        `insert into ks_customer_jobs (slug, project_id, payload, updated_at)
         values ($1, $2, '{}'::jsonb, now())
         on conflict (slug) do update set project_id = excluded.project_id, updated_at = now()`,
        [data.slug, data.projectId],
      );
      await sql.query(
        `insert into ks_customer_reports (project_id, report_id, status, payload, updated_at)
         values ($1, $2, $3, $4::jsonb, now())
         on conflict (project_id, report_id) do update set
           status = excluded.status,
           payload = coalesce(excluded.payload, ks_customer_reports.payload),
           updated_at = now()`,
        [data.projectId, data.reportId, status, data.payload ? JSON.stringify(data.payload) : null],
      );
      return { ok: true as const, status };
    } catch {
      return { ok: false as const, error: "db" as const };
    }
  });
