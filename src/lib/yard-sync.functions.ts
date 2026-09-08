import { createServerFn } from "@tanstack/react-start";
import { ASSIGNMENTS, EMPLOYEES } from "./seed.ts";
import { masterEmployeeIds, sendPush } from "./push-send.ts";
import { sendSlack } from "./slack-send.ts";
import { sbSelect, sbUpsert } from "./supabase-admin.server.ts";
import {
  chatFromRow,
  chatToRow,
  dayFromRow,
  dayToRow,
  ksFromRow,
  ksToRow,
  needFromRow,
  needToRow,
  orderFromRow,
  orderToRow,
  todoFromRow,
  todoToRow,
} from "./sb-rows.ts";
import type { ChatMessage, DayLog, KsReport, MaterialNeed, MaterialOrder, Todo } from "./types.ts";

function nameOf(id?: string) {
  return EMPLOYEES.find((e) => e.id === id)?.name ?? "Ansat";
}

const empty = {
  ok: false as const,
  todos: [] as Todo[],
  chats: [] as ChatMessage[],
  ksReports: [] as KsReport[],
  days: [] as DayLog[],
  needs: [] as MaterialNeed[],
  orders: [] as MaterialOrder[],
};

export const pullYard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [todos, chats, ks, days, needs, orders] = await Promise.all([
      sbSelect("todos"),
      sbSelect("messages"),
      sbSelect("ks_reports"),
      sbSelect("day_logs"),
      sbSelect("needs"),
      sbSelect("orders"),
    ]);
    if (todos.missing || chats.missing) return empty;
    return {
      ok: true as const,
      todos: todos.rows.map((r) => todoFromRow(r)),
      chats: chats.rows.map((r) => chatFromRow(r)),
      ksReports: ks.rows.map((r) => ksFromRow(r)),
      days: days.rows.map((r) => dayFromRow(r)),
      needs: needs.rows.map((r) => needFromRow(r)),
      orders: orders.rows.map((r) => orderFromRow(r)),
    };
  } catch {
    return empty;
  }
});

export const saveYardTodo = createServerFn({ method: "POST" })
  .validator((input: { todo: Todo; isNew: boolean; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const wrote = await sbUpsert("todos", todoToRow(data.todo));
      if (!wrote.ok) return { ok: false as const };
      if (data.isNew && data.actorId !== "seed") {
        const toIds = [...new Set([data.todo.assigneeId, ...(data.todo.assigneeIds ?? [])])].filter(Boolean);
        const title = "Ny to-do";
        const body = [data.todo.title, nameOf(data.todo.fromId)].filter(Boolean).join(" · ");
        await sendPush({ kind: "todo", title, body, url: "/svend?open=todo", toIds, actorId: data.actorId });
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
      const wrote = await sbUpsert("messages", chatToRow(data.chat));
      if (!wrote.ok) return { ok: false as const };
      if (data.chat.fromAgent || data.actorId === "seed") return { ok: true as const };
      const to = data.chat.to;
      let toIds: string[] = [];
      if (to.kind === "employee") toIds = [to.id];
      else if (to.kind === "employees") toIds = to.ids;
      else if (to.kind === "masters") toIds = masterEmployeeIds();
      else if (to.kind === "crew") toIds = ASSIGNMENTS.filter((a) => a.projectId === to.projectId).map((a) => a.employeeId);
      const text = (data.chat.translations?.da ?? data.chat.original ?? "").slice(0, 80);
      const title = "Ny chatbesked";
      const body = `${nameOf(data.chat.fromId)}: ${text}`;
      await sendPush({ kind: "chat", title, body, url: "/svend?open=chat", toIds, actorId: data.actorId });
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
      const wrote = await sbUpsert("ks_reports", ksToRow(data.report));
      if (!wrote.ok) return { ok: false as const };
      if (data.isNew && data.actorId !== "seed") {
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
      const wrote = await sbUpsert("day_logs", dayToRow(data.day, data.id));
      if (!wrote.ok) return { ok: false as const };
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
      const wrote = await sbUpsert("needs", needToRow(data.need));
      return { ok: wrote.ok };
    } catch {
      return { ok: false as const };
    }
  });

export const saveYardOrder = createServerFn({ method: "POST" })
  .validator((input: { order: MaterialOrder; actorId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const wrote = await sbUpsert("orders", orderToRow(data.order));
      return { ok: wrote.ok };
    } catch {
      return { ok: false as const };
    }
  });
