import { isMasterRole } from "./seed.ts";
import { todoAssigneeIds } from "./todo-people.ts";
import type { Assignment, ChatMessage, Employee, KsReport, Notice, Todo } from "./types.ts";

export type NotifySnap = {
  ksReports: KsReport[];
  chats: ChatMessage[];
  todos: Todo[];
  employees: Employee[];
  assignments: Assignment[];
};

export function masterIds(employees: Employee[]) {
  return employees.filter((e) => isMasterRole(e.role)).map((e) => e.id);
}

export function chatRecipientIds(msg: ChatMessage, employees: Employee[], assignments: Assignment[]) {
  if (msg.to.kind === "employee") return [msg.to.id];
  if (msg.to.kind === "employees") return [...new Set(msg.to.ids.filter(Boolean))];
  if (msg.to.kind === "masters") return masterIds(employees);
  if (msg.to.kind === "crew") {
    const sag = msg.to.projectId;
    return assignments.filter((a) => a.projectId === sag).map((a) => a.employeeId);
  }
  return [];
}

export function noticesFor(notices: Notice[], employeeId: string) {
  return notices.filter((n) => n.toIds.includes(employeeId) && n.fromId !== employeeId);
}

export function unreadNotices(notices: Notice[], employeeId: string) {
  return noticesFor(notices, employeeId).filter((n) => !n.readBy.includes(employeeId));
}

export function noticesFromDiff(prev: NotifySnap, next: NotifySnap, since: string): Notice[] {
  const out: Notice[] = [];
  const people = next.employees;
  const masters = masterIds(people);
  const nameOf = (id?: string) => people.find((e) => e.id === id)?.name ?? "Ansat";

  const prevKs = new Set(prev.ksReports.map((r) => r.id));
  for (const row of next.ksReports) {
    if (prevKs.has(row.id)) continue;
    if (row.createdAt < since) continue;
    const fromId = row.employeeId ?? "";
    const toIds = masters.filter((id) => id && id !== fromId);
    if (!toIds.length) continue;
    out.push({
      id: `nt-ks-${row.id}`,
      at: row.createdAt,
      kind: "ks",
      title: "Ny KS",
      body: `${row.employeeName ?? nameOf(fromId)} har oprettet KS`,
      toIds,
      fromId,
      refId: row.id,
      projectId: row.projectId,
      readBy: [],
    });
  }

  const prevChat = new Set(prev.chats.map((c) => c.id));
  for (const msg of next.chats) {
    if (prevChat.has(msg.id)) continue;
    if (msg.at < since) continue;
    if (msg.fromAgent) continue;
    const toIds = chatRecipientIds(msg, people, next.assignments).filter((id) => id !== msg.fromId);
    if (!toIds.length) continue;
    const text = (msg.translations.da ?? msg.original).slice(0, 80);
    out.push({
      id: `nt-ch-${msg.id}`,
      at: msg.at,
      kind: "chat",
      title: "Ny chat",
      body: `${nameOf(msg.fromId)}: ${text}`,
      toIds,
      fromId: msg.fromId,
      refId: msg.id,
      projectId: msg.projectId,
      readBy: [],
    });
  }

  const prevTodo = new Map(prev.todos.map((t) => [t.id, t]));
  for (const td of next.todos) {
    const old = prevTodo.get(td.id);
    if (!old) {
      if (td.createdAt < since) continue;
      const toIds = todoAssigneeIds(td).filter((id) => id !== td.fromId);
      if (!toIds.length) continue;
      out.push({
        id: `nt-td-${td.id}`,
        at: td.createdAt,
        kind: "todo",
        title: "Ny to-do",
        body: td.title,
        toIds,
        fromId: td.fromId,
        refId: td.id,
        projectId: td.projectId,
        readBy: [],
      });
      continue;
    }
    if (!old.done && td.done) {
      const at = td.doneAt ?? new Date().toISOString();
      if (at < since) continue;
      const by = td.doneById ?? "";
      const toIds = [...new Set([td.fromId, ...masters])].filter((id) => id && id !== by);
      if (!toIds.length) continue;
      out.push({
        id: `nt-tdd-${td.id}-${at}`,
        at,
        kind: "todo-done",
        title: "To-do udført",
        body: `${nameOf(by)} har udført: ${td.title}`,
        toIds,
        fromId: by,
        refId: td.id,
        projectId: td.projectId,
        readBy: [],
      });
    }
  }

  return out;
}

export function noticeForKs(row: KsReport, employees: Employee[]) {
  return noticesFromDiff(
    { ksReports: [], chats: [], todos: [], employees, assignments: [] },
    { ksReports: [row], chats: [], todos: [], employees, assignments: [] },
    "1970-01-01",
  )[0] ?? null;
}

export function noticeForChat(msg: ChatMessage, employees: Employee[], assignments: Assignment[]) {
  return noticesFromDiff(
    { ksReports: [], chats: [], todos: [], employees, assignments },
    { ksReports: [], chats: [msg], todos: [], employees, assignments },
    "1970-01-01",
  )[0] ?? null;
}

export function noticeForTodo(td: Todo) {
  return noticesFromDiff(
    { ksReports: [], chats: [], todos: [], employees: [], assignments: [] },
    { ksReports: [], chats: [], todos: [td], employees: [], assignments: [] },
    "1970-01-01",
  )[0] ?? null;
}

export function noticeForPlanEdit(opts: {
  title: string;
  projectId: string;
  fromId: string;
  employees: Employee[];
}): Notice | null {
  const toIds = masterIds(opts.employees).filter((id) => id && id !== opts.fromId);
  if (!toIds.length) return null;
  return {
    id: `nt-plan-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    kind: "todo",
    title: "Plan ændret",
    body: opts.title,
    toIds,
    fromId: opts.fromId,
    refId: opts.projectId,
    projectId: opts.projectId,
    readBy: [],
  };
}

export function noticeForTodoDone(before: Todo, after: Todo, employees: Employee[]) {
  return noticesFromDiff(
    { ksReports: [], chats: [], todos: [before], employees, assignments: [] },
    { ksReports: [], chats: [], todos: [after], employees, assignments: [] },
    "1970-01-01",
  )[0] ?? null;
}

export function noticeForMaShare(opts: {
  orderId: string;
  projectId: string;
  fromId: string;
  number: string;
  mode: "send" | "draft" | "copy";
  link?: string;
  employees: Employee[];
}): Notice | null {
  const from = opts.employees.find((e) => e.id === opts.fromId);
  if (from && isMasterRole(from.role)) return null;
  const toIds = masterIds(opts.employees).filter((id) => id && id !== opts.fromId);
  if (!toIds.length) return null;
  const draft = opts.mode === "draft";
  const label = opts.number || "MA";
  return {
    id: `nt-ma-${opts.orderId}-${opts.mode}-${Date.now()}`,
    at: new Date().toISOString(),
    kind: "ma",
    title: draft ? "MA-kladde" : "MA sendt",
    body: draft ? `${label} · kladde klar, vælg leverandør` : `${label} · sendt, her er linket${opts.link ? ` · ${opts.link}` : ""}`,
    toIds,
    fromId: opts.fromId,
    refId: opts.orderId,
    projectId: opts.projectId,
    readBy: [],
  };
}

export function flashBrowser(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/zenko-logo.svg" });
  } catch {
    /* iframe / denied */
  }
}
