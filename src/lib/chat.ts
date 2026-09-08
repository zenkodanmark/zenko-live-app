import { isMasterRole } from "./seed.ts";
import type { Assignment, ChatFile, ChatMessage, ChatPhoto, ChatTarget, ChatThread, Employee, Lang, Role, Todo } from "./types";
import { LANG_IDS } from "./i18n.ts";

export function targetEmployeeIds(to: ChatTarget): string[] {
  if (to.kind === "employee") return [to.id];
  if (to.kind === "employees") return [...new Set(to.ids.filter(Boolean))];
  return [];
}

export function chatVisible(msg: ChatMessage, viewer: Employee, assignments: Assignment[]) {
  if (msg.hiddenBy?.includes(viewer.id)) return false;
  if (msg.fromId === viewer.id) return true;
  if (msg.to.kind === "employee") return msg.to.id === viewer.id;
  if (msg.to.kind === "employees") return msg.to.ids.includes(viewer.id);
  if (msg.to.kind === "masters") return isMasterRole(viewer.role);
  if (msg.to.kind === "crew") {
    const sag = msg.to.projectId;
    return assignments.some((a) => a.employeeId === viewer.id && a.projectId === sag);
  }
  return false;
}

export function goesToMaster(to: ChatTarget, people: Employee[]) {
  if (to.kind === "masters") return true;
  const ids = targetEmployeeIds(to);
  return ids.some((id) => {
    const who = people.find((p) => p.id === id);
    return who ? isMasterRole(who.role) : false;
  });
}

export function chatTargetLabel(to: ChatTarget, people: Employee[], allLabel: string, masterLabel: string) {
  if (to.kind === "crew") return allLabel;
  if (to.kind === "masters") return masterLabel;
  const ids = targetEmployeeIds(to);
  const names = ids.map((id) => people.find((p) => p.id === id)?.name ?? "").filter(Boolean);
  return names.join(", ");
}

/** Each person sees their own language. Master sees Danish. */
export function shownText(msg: ChatMessage, lang: Lang, role?: Role) {
  if (role && isMasterRole(role)) return msg.translations.da ?? msg.original;
  return msg.translations[lang] ?? msg.translations.da ?? msg.original;
}

export function completeTranslations(
  original: string,
  from: Lang,
  got: Partial<Record<Lang, string>> = {},
): Partial<Record<Lang, string>> {
  const src = original.trim();
  const out: Partial<Record<Lang, string>> = {};
  for (const lang of LANG_IDS) {
    const v = got[lang]?.trim();
    if (v) out[lang] = v;
  }
  out[from] = (got[from] || src).trim() || src;
  if (from === "da" && !out.da) out.da = src;
  return out;
}

/** Prefer a real translation over a copy of the original (sync must not wipe da/ro/…). */
export function mergeLangMap(
  original: string,
  a?: Partial<Record<Lang, string>>,
  b?: Partial<Record<Lang, string>>,
): Partial<Record<Lang, string>> {
  const src = original.trim();
  const out: Partial<Record<Lang, string>> = { ...(a ?? {}), ...(b ?? {}) };
  for (const lang of LANG_IDS) {
    const av = a?.[lang]?.trim() || "";
    const bv = b?.[lang]?.trim() || "";
    const aReal = Boolean(av && av !== src);
    const bReal = Boolean(bv && bv !== src);
    if (aReal && !bReal) out[lang] = av;
    else if (bReal && !aReal) out[lang] = bv;
    else if (aReal && bReal) out[lang] = bv.length >= av.length ? bv : av;
    else out[lang] = av || bv || undefined;
  }
  return out;
}

export function driveOnlyPhotos(photos: ChatPhoto[] | undefined): ChatPhoto[] | undefined {
  if (!photos?.length) return undefined;
  return photos.map((p) => {
    const { dataUrl: _drop, ...rest } = p;
    return rest;
  });
}

export function driveOnlyFiles(files: ChatFile[] | undefined): ChatFile[] | undefined {
  if (!files?.length) return undefined;
  return files.map((f) => {
    const { dataUrl: _drop, ...rest } = f;
    return rest;
  });
}

export function shownTodoText(todo: Todo, lang: Lang, _role?: Role) {
  const original = todo.original ?? todo.body ?? todo.title;
  return todo.translations?.[lang] ?? todo.translations?.da ?? original;
}

export function hasOriginal(shown: string, original: string) {
  return Boolean(original.trim()) && original.trim() !== shown.trim();
}

export function unreadChatCount(
  chats: ChatMessage[],
  viewer: Employee,
  assignments: Assignment[],
  seenAt: string | undefined,
  threadSeenAt?: Record<string, string>,
) {
  return chats.filter((m) => {
    if (!chatVisible(m, viewer, assignments)) return false;
    if (m.fromId === viewer.id) return false;
    const key = `${viewer.id}::${m.threadId || `msg-${m.id}`}`;
    const since = threadSeenAt?.[key] ?? seenAt ?? "";
    return !since || m.at > since;
  }).length;
}

export function threadSeenKey(viewerId: string, threadId: string) {
  return `${viewerId}::${threadId}`;
}


export function threadPeopleIds(msgs: ChatMessage[]): string[] {
  const ids = new Set<string>();
  for (const m of msgs) {
    ids.add(m.fromId);
    for (const id of targetEmployeeIds(m.to)) ids.add(id);
  }
  return [...ids];
}

export function threadPeopleLabel(msgs: ChatMessage[], people: Employee[], exceptId?: string) {
  return threadPeopleIds(msgs)
    .filter((id) => id !== exceptId)
    .map((id) => people.find((p) => p.id === id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

export function lastMessageAt(msgs: ChatMessage[]) {
  return msgs.reduce((max, m) => (m.at > max ? m.at : max), "");
}

export type ChatListRow = {
  id: string;
  title: string;
  peopleLabel: string;
  peopleIds: string[];
  at: string;
  saved: boolean;
  rootId: string;
  unread: number;
};

export function listChatRows(
  chats: ChatMessage[],
  threads: ChatThread[],
  people: Employee[],
  viewer: Employee,
  assignments: Assignment[],
  threadSeenAt: Record<string, string> = {},
): { active: ChatListRow[]; saved: ChatListRow[] } {
  const visible = chats.filter((m) => chatVisible(m, viewer, assignments));
  const byKey = new Map<string, ChatMessage[]>();
  for (const m of visible) {
    const key = m.threadId || `msg-${m.id}`;
    const list = byKey.get(key) ?? [];
    list.push(m);
    byKey.set(key, list);
  }
  const rows: ChatListRow[] = [];
  for (const [key, msgs] of byKey) {
    const last = [...msgs].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    if (!last) continue;
    const th = threads.find((t) => t.id === key || t.rootId === last.id || msgs.some((m) => m.id === t.rootId));
    const rowId = th?.id ?? key;
    const seen = threadSeenAt[`${viewer.id}::${rowId}`] ?? threadSeenAt[`${viewer.id}::${key}`] ?? "";
    const unread = msgs.filter((m) => m.fromId !== viewer.id && (!seen || m.at > seen)).length;
    const others = threadPeopleIds(msgs).filter((id) => id !== viewer.id);
    rows.push({
      id: rowId,
      title: th?.title ?? shownText(last, viewer.language, viewer.role).slice(0, 72),
      peopleLabel: others.map((id) => people.find((p) => p.id === id)?.name ?? "").filter(Boolean).join(", "),
      peopleIds: others,
      at: lastMessageAt(msgs),
      saved: Boolean(th?.savedAt),
      rootId: th?.rootId ?? last.id,
      unread,
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return { active: rows.filter((r) => !r.saved), saved: rows.filter((r) => r.saved) };
}

export function unsavedOnNewMessage(threads: ChatThread[], threadId?: string): ChatThread[] {
  if (!threadId) return threads;
  return threads.map((th) => (th.id === threadId && th.savedAt ? { ...th, savedAt: undefined } : th));
}

export function findChatWith(
  chats: ChatMessage[],
  threads: ChatThread[],
  people: Employee[],
  viewer: Employee,
  assignments: Assignment[],
  otherId: string,
  threadSeenAt: Record<string, string> = {},
): ChatListRow | null {
  const { active, saved } = listChatRows(chats, threads, people, viewer, assignments, threadSeenAt);
  for (const row of [...active, ...saved]) {
    const msgs = chats.filter((m) => m.threadId === row.id || m.id === row.rootId || `msg-${m.id}` === row.id);
    const ids = threadPeopleIds(msgs).filter((id) => id !== viewer.id);
    if (ids.length === 1 && ids[0] === otherId) return row;
  }
  return null;
}
