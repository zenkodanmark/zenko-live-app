import { useEffect, useRef } from "react";
import { onYardEvent } from "@/lib/yard-bus";
import { mergeById, mergeChats, mergeDays, slimChat, slimDay, slimKs, slimNeed, slimOrder, slimTodo } from "@/lib/yard-slim";
import { pullYard, saveYardChat, saveYardDay, saveYardKs, saveYardNeed, saveYardOrder, saveYardTodo } from "@/lib/yard-sync.functions";
import { useYard } from "@/lib/store";
import type { ChatMessage, DayLog, KsReport, MaterialNeed, MaterialOrder, Todo } from "@/lib/types";

const DUMMY_CHAT = new Set(["ch-lang-ion", "ch-lang-osvaldo", "ch-mat-ion"]);
const DUMMY_TODO = new Set(["td-lang-ion"]);

async function applyPull() {
  const remote = await pullYard();
  if (!remote.ok) return;
  const s = useYard.getState();
  if (!remote.todos.length && !remote.chats.length && !remote.ksReports.length && !remote.days.length && !remote.needs.length && !remote.orders.length) {
    const actor = "seed";
    await Promise.all([
      ...s.todos.filter((row) => !DUMMY_TODO.has(row.id)).slice(0, 40).map((row) => saveYardTodo({ data: { todo: slimTodo(row), isNew: false, actorId: actor } })),
      ...s.chats.filter((row) => !DUMMY_CHAT.has(row.id)).slice(0, 40).map((row) => saveYardChat({ data: { chat: slimChat(row), actorId: actor } })),
      ...s.ksReports.slice(0, 40).map((row) => saveYardKs({ data: { report: slimKs(row), isNew: false, actorId: actor } })),
      ...Object.values(s.days).slice(0, 20).map((row) =>
        saveYardDay({ data: { id: `${row.employeeId}:${row.date}`, day: slimDay(row), event: null, actorId: actor } }),
      ),
      ...(s.needs ?? []).slice(0, 40).map((row) => saveYardNeed({ data: { need: slimNeed(row), actorId: actor } })),
      ...(s.orders ?? []).slice(0, 40).map((row) => saveYardOrder({ data: { order: slimOrder(row), actorId: actor } })),
    ]);
    return;
  }
  useYard.setState({
    todos: mergeById(s.todos, remote.todos),
    chats: mergeChats(s.chats, remote.chats),
    ksReports: mergeById(s.ksReports, remote.ksReports),
    days: mergeDays(s.days, remote.days),
    needs: mergeById(s.needs ?? [], remote.needs ?? []),
    orders: mergeById(s.orders ?? [], remote.orders ?? []),
  });
}

export function YardSyncHost() {
  const seeded = useRef(false);
  useEffect(() => {
    let live = true;
    void applyPull().catch(() => {});
    const unsub = onYardEvent((ev) => {
      if (!live) return;
      const actor = ev.actorId;
      if (ev.kind === "todo") void saveYardTodo({ data: { todo: ev.payload as Todo, isNew: ev.isNew, actorId: actor } });
      if (ev.kind === "chat") void saveYardChat({ data: { chat: ev.payload as ChatMessage, actorId: actor } });
      if (ev.kind === "ks") void saveYardKs({ data: { report: ev.payload as KsReport, isNew: ev.isNew, actorId: actor } });
      if (ev.kind === "day") {
        void saveYardDay({
          data: {
            id: ev.id,
            day: ev.payload as DayLog,
            event: ev.event,
            actorId: actor,
            name: ev.name,
          },
        });
      }
      if (ev.kind === "need") void saveYardNeed({ data: { need: ev.payload as MaterialNeed, actorId: actor } });
      if (ev.kind === "order") void saveYardOrder({ data: { order: ev.payload as MaterialOrder, actorId: actor } });
    });
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void applyPull().catch(() => {});
    }, 8000);
    const onVis = () => {
      if (document.visibilityState === "visible") void applyPull().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    seeded.current = true;
    return () => {
      live = false;
      unsub();
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
