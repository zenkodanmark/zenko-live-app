import { createServerFn } from "@tanstack/react-start";
import { ASSIGNMENTS, EMPLOYEES } from "./seed.ts";
import { masterEmployeeIds, sendPush } from "./push-send.ts";
import { sendSlack } from "./slack-send.ts";
import { sbSecret, sbUpload } from "./supabase-admin.server.ts";
import { SB_BUCKET, SB_URL, sbPublicUrl } from "./supabase.ts";
import type { ChatMessage, DayLog, KsReport, MaterialNeed, MaterialOrder, Todo } from "./types.ts";

function nameOf(id?: string) {
  return EMPLOYEES.find((e) => e.id === id)?.name ?? "Ansat";
}

const TABLES = { todos: "todos", chats: "chats", ks: "ks_reports", days: "day_logs", needs: "needs", orders: "orders" } as const;

async function upsert(table: keyof typeof TABLES, id: string, payload: unknown) {
  const name = TABLES[table];
  const wrote = await sbUpload(`tables/${name}/${id}.json`, JSON.stringify(payload), "application/json");
  if (!wrote.ok) throw new Error(wrote.error || "supabase write failed");
  return true;
}

async function pullTable<T>(name: string): Promise<T[]> {
  const key = sbSecret();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) {
    headers.apikey = key;
    headers.Authorization = `Bearer ${key}`;
  }
  try {
    const list = await fetch(`${SB_URL}/storage/v1/object/list/${SB_BUCKET}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prefix: `tables/${name}/`, limit: 200 }),
    });
    if (!list.ok) return [];
    const rows = (await list.json()) as { name?: string }[];
    const files = Array.isArray(rows) ? rows.map((r) => r.name).filter((n): n is string => Boolean(n) && n.endsWith(".json")) : [];
    const items = await Promise.all(
      files.slice(0, 120).map(async (file) => {
        const res = await fetch(`${sbPublicUrl(`tables/${name}/${file}`)}?t=${Date.now()}`);
        if (!res.ok) return null;
        return (await res.json()) as T;
      }),
    );
    return items.filter(Boolean) as T[];
  } catch {
    return [];
  }
}

export const pullYard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const stateRes = await fetch(`${sbPublicUrl("yard/state.json")}?t=${Date.now()}`, { cache: "no-store" });
    if (stateRes.ok) {
      const raw = await stateRes.json();
      const state = (raw?.state && typeof raw.state === "object" ? raw.state : raw) as Record<string, unknown>;
      const daysArr = state.days && typeof state.days === "object" && !Array.isArray(state.days)
        ? Object.values(state.days as Record<string, DayLog>)
        : Array.isArray(state.days) ? state.days as DayLog[] : [];
      return {
        ok: true as const,
        todos: Array.isArray(state.todos) ? state.todos as Todo[] : [],
        chats: Array.isArray(state.chats) ? state.chats as ChatMessage[] : [],
        ksReports: Array.isArray(state.ksReports) ? state.ksReports as KsReport[] : [],
        days: daysArr as DayLog[],
        needs: Array.isArray(state.needs) ? state.needs as MaterialNeed[] : [],
        orders: Array.isArray(state.orders) ? state.orders as MaterialOrder[] : [],
      };
    }
    const [todos, chats, ks, days, needs, orders] = await Promise.all([
      pullTable<Todo>("todos"),
      pullTable<ChatMessage>("chats"),
      pullTable<KsReport>("ks_reports"),
      pullTable<DayLog>("day_logs"),
      pullTable<MaterialNeed>("needs"),
      pullTable<MaterialOrder>("orders"),
    ]);
    return { ok: true as const, todos, chats, ksReports: ks, days, needs, orders };
  } catch {
    return { ok: false as const, todos: [] as Todo[], chats: [] as ChatMessage[], ksReports: [] as KsReport[], days: [] as DayLog[], needs: [] as MaterialNeed[], orders: [] as MaterialOrder[] };
  }
});

export const saveYardTodo = createServerFn({ method: "POST" })
  .validator((input: { todo: Todo; isNew: boolean; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const isNew = (await upsert("todos", data.todo.id, data.todo)) || data.isNew;
      if (isNew && data.actorId !== "seed") {
        const toIds = [...new Set([data.todo.assigneeId, ...(data.todo.assigneeIds ?? [])])].filter(Boolean);
        const title = "Ny to-do";
        const body = [data.todo.title, nameOf(data.todo.fromId)].filter(Boolean).join(" · ");
        await sendPush({
          kind: "todo",
          title,
          body,
          url: "/svend?open=todo",
          toIds,
          actorId: data.actorId,
        });
        await sendSlack({ title, body });
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardChat = createServerFn({ method: "POST" })
  .validator((input: { chat: ChatMessage; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const isNew = await upsert("chats", data.chat.id, data.chat);
      if (!isNew || data.chat.fromAgent || data.actorId === "seed") return { ok: true as const };
      const to = data.chat.to;
      let toIds: string[] = [];
      if (to.kind === "employee") toIds = [to.id];
      else if (to.kind === "employees") toIds = to.ids;
      else if (to.kind === "masters") toIds = masterEmployeeIds();
      else if (to.kind === "crew") toIds = ASSIGNMENTS.filter((a) => a.projectId === to.projectId).map((a) => a.employeeId);
      const text = (data.chat.translations?.da ?? data.chat.original ?? "").slice(0, 80);
      const title = "Ny chatbesked";
      const body = `${nameOf(data.chat.fromId)}: ${text}`;
      await sendPush({
        kind: "chat",
        title,
        body,
        url: "/svend?open=chat",
        toIds,
        actorId: data.actorId,
      });
      await sendSlack({ title, body });
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardKs = createServerFn({ method: "POST" })
  .validator((input: { report: KsReport; isNew: boolean; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const isNew = (await upsert("ks", data.report.id, data.report)) || data.isNew;
      if (isNew && data.actorId !== "seed") {
        const title = "Mester: Ny KS-rapport";
        const body = `${data.report.employeeName || nameOf(data.report.employeeId)} · ${data.report.number}`;
        await sendPush({
          kind: "ks",
          title: "Ny KS-rapport",
          body,
          url: `/mester?open=ks&id=${encodeURIComponent(data.report.id)}`,
          toIds: masterEmployeeIds(),
          actorId: data.actorId,
        });
        await sendSlack({ title, body });
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardDay = createServerFn({ method: "POST" })
  .validator((input: { id: string; day: DayLog; event: "checkin" | "checkout" | null; actorId: string; name?: string }) => input)
  .handler(async ({ data }) => {
    try {
      await upsert("days", data.id, data.day);
      if ((data.event === "checkin" || data.event === "checkout") && data.actorId !== "seed") {
        const when = (data.event === "checkin" ? data.day.checkInAt : data.day.checkOutAt) ?? "";
        const clock = when ? when.slice(11, 16) : "";
        const title = data.event === "checkin" ? "Mester: Mødt ind" : "Mester: Gået hjem";
        const body = [data.name || nameOf(data.actorId), clock].filter(Boolean).join(" · ");
        await sendPush({
          kind: data.event,
          title: data.event === "checkin" ? "Mødt ind" : "Gået hjem",
          body,
          url: "/mester?open=folk",
          toIds: masterEmployeeIds(),
          actorId: data.actorId,
        });
        await sendSlack({ title, body });
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardNeed = createServerFn({ method: "POST" })
  .validator((input: { need: MaterialNeed; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      await upsert("needs", data.need.id, data.need);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardOrder = createServerFn({ method: "POST" })
  .validator((input: { order: MaterialOrder; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      await upsert("orders", data.order.id, data.order);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
