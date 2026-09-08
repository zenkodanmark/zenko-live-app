import { useEffect, useRef } from "react";
import { pullChats, publishChat } from "@/lib/chat-live";
import { pullTodos, publishTodo } from "@/lib/todo-live";
import { onYardEvent } from "@/lib/yard-bus";
import { mergeById, mergeChats, mergeDays, slimChat, slimDay, slimKs, slimNeed, slimOrder, slimTodo } from "@/lib/yard-slim";
import { pullYard, saveYardChat, saveYardDay, saveYardKs, saveYardNeed, saveYardOrder, saveYardTodo } from "@/lib/yard-sync.functions";
import { useYard } from "@/lib/store";
import type { ChatMessage, DayLog, KsReport, MaterialNeed, MaterialOrder, Todo } from "@/lib/types";

const DUMMY_CHAT = new Set(["ch-lang-ion", "ch-lang-osvaldo", "ch-mat-ion"]);
const DUMMY_TODO = new Set(["td-lang-ion"]);

async function applyPull() {
  const remote = await pullYard().catch(() => ({
    ok: false as const,
    todos: [] as Todo[],
    chats: [] as ChatMessage[],
    ksReports: [] as KsReport[],
    days: [] as DayLog[],
    needs: [] as MaterialNeed[],
    orders: [] as MaterialOrder[],
  }));
  const clientChats = await pullChats();
  const clientTodos = await pullTodos();
  const s = useYard.getState();
  const cloudChats = mergeChats(remote.ok ? remote.chats : [], clientChats ?? []);
  const cloudTodos = mergeById(remote.ok ? remote.todos : [], clientTodos ?? []);
  if (!remote.ok && !cloudChats.length && !cloudTodos.length) {
    const actor = "seed";
    await Promise.all([
      ...s.todos.filter((row) => !DUMMY_TODO.has(row.id)).slice(0, 40).map((row) => publishTodo(slimTodo(row))),
      ...s.chats.filter((row) => !DUMMY_CHAT.has(row.id)).slice(0, 40).map((row) => publishChat(slimChat(row))),
      ...s.ksReports.slice(0, 40).map((row) => saveYardKs({ data: { report: slimKs(row), isNew: false, actorId: actor } }).catch(() => {})),
      ...Object.values(s.days).slice(0, 20).map((row) =>
        saveYardDay({ data: { id: `${row.employeeId}:${row.date}`, day: slimDay(row), event: null, actorId: actor } }).catch(() => {}),
      ),
      ...(s.needs ?? []).slice(0, 40).map((row) => saveYardNeed({ data: { need: slimNeed(row), actorId: actor } }).catch(() => {})),
      ...(s.orders ?? []).slice(0, 40).map((row) => saveYardOrder({ data: { order: slimOrder(row), actorId: actor } }).catch(() => {})),
    ]);
    return;
  }
  useYard.setState({
    todos: mergeById(s.todos, cloudTodos),
    chats: mergeChats(s.chats, cloudChats),
    ksReports: remote.ok ? mergeById(s.ksReports, remote.ksReports) : s.ksReports,
    days: remote.ok ? mergeDays(s.days, remote.days) : s.days,
    needs: remote.ok ? mergeById(s.needs ?? [], remote.needs ?? []) : s.needs,
    orders: remote.ok ? mergeById(s.orders ?? [], remote.orders ?? []) : s.orders,
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
      if (ev.kind === "todo") {
        const row = ev.payload as Todo;
        void publishTodo(row);
        void saveYardTodo({ data: { todo: row, isNew: ev.isNew, actorId: actor } }).catch(() => {});
      }
      if (ev.kind === "chat") {
        const row = ev.payload as ChatMessage;
        void publishChat(row);
        void saveYardChat({ data: { chat: row, actorId: actor } }).catch(() => {});
      }
      if (ev.kind === "ks") void saveYardKs({ data: { report: ev.payload as KsReport, isNew: ev.isNew, actorId: actor } }).catch(() => {});
      if (ev.kind === "day") {
        void saveYardDay({
          data: {
            id: ev.id,
            day: ev.payload as DayLog,
            event: ev.event,
            actorId: actor,
            name: ev.name,
          },
        }).catch(() => {});
      }
      if (ev.kind === "need") void saveYardNeed({ data: { need: ev.payload as MaterialNeed, actorId: actor } }).catch(() => {});
      if (ev.kind === "order") void saveYardOrder({ data: { order: ev.payload as MaterialOrder, actorId: actor } }).catch(() => {});
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