import { createServerFn } from "@tanstack/react-start";
import { sbAdmin, sbSecret, sbUploadBase64, sbUpsert } from "./supabase-admin.server";
import { sbPublicUrl } from "./supabase";
import {
  assignmentToRow,
  chatToRow,
  dayToRow,
  empToRow,
  entToRow,
  fieldToRow,
  issueToRow,
  ksToRow,
  needToRow,
  noticeToRow,
  orderToRow,
  planToRow,
  projectToRow,
  receiptToRow,
  slipToRow,
  tfToRow,
  todoToRow,
} from "./sb-rows";
import type {
  Assignment,
  ChatMessage,
  DayLog,
  Employee,
  Entrepreneur,
  FieldItem,
  Issue,
  KsReport,
  MaterialNeed,
  MaterialOrder,
  MaterialReceipt,
  Notice,
  PlanBlock,
  Project,
  Slip,
  Tf,
  Todo,
} from "./types";

function take<T>(rows: unknown, n: number): T[] {
  return Array.isArray(rows) ? (rows as T[]).slice(0, n) : [];
}

async function chunked(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 80) {
    const wrote = await sbUpsert(table, rows.slice(i, i + 80));
    if (!wrote.ok) return wrote;
  }
  return { ok: true as const, error: "" };
}

export const pushYardState = createServerFn({ method: "POST" })
  .validator((input: { json: string }) => input)
  .handler(async ({ data }) => {
    if (!sbSecret()) return { ok: false as const, error: "Supabase-secret mangler på serveren" };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.json) as Record<string, unknown>;
    } catch {
      return { ok: false as const, error: "ugyldig json" };
    }
    const state = (parsed.state && typeof parsed.state === "object" ? parsed.state : parsed) as Record<string, unknown>;
    const daysObj = state.days && typeof state.days === "object" && !Array.isArray(state.days)
      ? Object.values(state.days as Record<string, DayLog>)
      : take<DayLog>(state.days, 80);

    const employees = take<Employee>(state.employees, 40).map(empToRow);
    const projects = take<Project>(state.projects, 40).map(projectToRow);
    const assignments = take<Assignment>(state.assignments, 80).map(assignmentToRow);
    const emp = await chunked("employees", employees);
    if (!emp.ok) return emp;
    const proj = await chunked("projects", projects);
    if (!proj.ok) return proj;
    const asg = await chunked("assignments", assignments);
    if (!asg.ok) return asg;

    const results = await Promise.all([
      chunked("todos", take<Todo>(state.todos, 120).map(todoToRow)),
      chunked("messages", take<ChatMessage>(state.chats, 120).map(chatToRow)),
      chunked("ks_reports", take<KsReport>(state.ksReports, 80).map(ksToRow)),
      chunked("day_logs", daysObj.slice(0, 80).map((d) => dayToRow(d))),
      chunked("needs", take<MaterialNeed>(state.needs, 80).map(needToRow)),
      chunked("orders", take<MaterialOrder>(state.orders, 80).map(orderToRow)),
      chunked("tfs", take<Tf>(state.tfs, 80).map(tfToRow)),
      chunked("slips", take<Slip>(state.slips, 80).map(slipToRow)),
      chunked("ents", take<Entrepreneur>(state.ents, 80).map(entToRow)),
      chunked("issues", take<Issue>(state.issues, 80).map(issueToRow)),
      chunked("plan_blocks", take<PlanBlock>(state.plans, 80).map(planToRow)),
      chunked("notices", take<Notice>(state.notices, 80).map(noticeToRow)),
      chunked("field_items", take<FieldItem>(state.fieldItems, 80).map(fieldToRow)),
      chunked("receipts", take<MaterialReceipt>(state.receipts, 80).map(receiptToRow)),
    ]);

    const serial = state.serial as Record<string, number> | undefined;
    if (serial && typeof serial === "object") {
      const rows = Object.entries(serial).map(([kind, next]) => ({ kind, next: Number(next) || 1, year: 2026 }));
      if (rows.length) await chunked("serials", rows);
    }

    const failed = results.find((r) => !r.ok);
    return failed ?? { ok: true as const, error: "" };
  });

export const saveYardRow = createServerFn({ method: "POST" })
  .validator((input: { table: string; id: string; payload: unknown }) => input)
  .handler(async ({ data }) => {
    const table = data.table.replace(/[^a-z0-9_]/gi, "");
    if (!table) return { ok: false as const, url: "", error: "Ugyldig tabel" };
    const payload = data.payload && typeof data.payload === "object" ? (data.payload as Record<string, unknown>) : { id: data.id };
    const wrote = await sbUpsert(table, { id: data.id, ...payload });
    return { ok: wrote.ok, url: "", error: wrote.error };
  });

export const uploadPladsFile = createServerFn({ method: "POST" })
  .validator((input: { path: string; contentBase64: string; mimeType?: string; projectId?: string; kind?: string; name?: string }) => input)
  .handler(async ({ data }) => {
    const path = String(data.path || "").replace(/^\/+/, "").replace(/\.\./g, "");
    if (!path) return { ok: false as const, url: "", fileId: "", error: "Mangler sti" };
    const mime = data.mimeType || "application/octet-stream";
    const wrote = await sbUploadBase64(path, data.contentBase64, mime);
    if (wrote.ok) {
      const url = wrote.url || sbPublicUrl(path);
      await sbAdmin().from("files").upsert({
        id: url,
        project_id: data.projectId ?? null,
        kind: data.kind ?? "file",
        path,
        name: data.name || path.split("/").pop() || path,
        mime,
        url,
      });
    }
    return {
      ok: wrote.ok,
      url: wrote.url,
      fileId: wrote.url || sbPublicUrl(path),
      error: wrote.error,
    };
  });
