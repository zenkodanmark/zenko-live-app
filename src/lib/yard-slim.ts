import { mergeLangMap } from "./chat.ts";
import { dayKey } from "./seed.ts";
import type { ChatFile, ChatMessage, ChatPhoto, DayLog, KsPhoto, KsReport, Lang, MaterialNeed, MaterialOrder, Todo } from "./types.ts";

function slimMedia<T extends { dataUrl?: string; driveFileId?: string }>(row: T): T {
  if (row.driveFileId) return { ...row, dataUrl: "" };
  return row;
}

export function slimTodo(row: Todo): Todo {
  return { ...row };
}

export function slimChat(row: ChatMessage): ChatMessage {
  return {
    ...row,
    photos: (row.photos ?? []).map(slimMedia),
    files: (row.files ?? []).map(slimMedia),
  };
}

export function slimKs(row: KsReport): KsReport {
  return { ...row };
}

export function slimNeed(row: MaterialNeed): MaterialNeed {
  return { ...row };
}

export function slimOrder(row: MaterialOrder): MaterialOrder {
  return { ...row };
}

export function slimDay(row: DayLog): DayLog {
  return {
    ...row,
    photos: (row.photos ?? []).map(slimMedia) as KsPhoto[],
  };
}

export function dayRowId(row: Pick<DayLog, "employeeId" | "date">) {
  return `${row.employeeId}:${row.date || ""}`;
}

export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of local) map.set(row.id, row);
  for (const row of remote) {
    const prev = map.get(row.id);
    map.set(row.id, prev ? { ...prev, ...row } : row);
  }
  return [...map.values()];
}

const held = new Map<string, number>();
const HOLD_KEY = "zenko-row-hold";

function heldAt(id: string): number {
  let t = held.get(id) ?? 0;
  try {
    if (typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem(HOLD_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, number>;
        t = Math.max(t, Number(obj[id] || 0));
      }
    }
  } catch {
    /* private mode */
  }
  return t;
}

export function holdRow(id: string) {
  if (!id) return;
  const t = Date.now();
  held.set(id, t);
  try {
    if (typeof sessionStorage !== "undefined") {
      const obj = JSON.parse(sessionStorage.getItem(HOLD_KEY) || "{}") as Record<string, number>;
      obj[id] = t;
      const cutoff = t - 60_000;
      for (const [k, v] of Object.entries(obj)) if (Number(v) < cutoff) delete obj[k];
      sessionStorage.setItem(HOLD_KEY, JSON.stringify(obj));
    }
  } catch {
    /* private mode */
  }
}

export function mergeSkippingHeld<T extends { id: string }>(local: T[], remote: T[], ms = 8000): T[] {
  const now = Date.now();
  return mergeById(
    local,
    remote.filter((row) => heldAt(row.id) + ms < now),
  );
}

function stamp(row: { updatedAt?: string }) {
  const n = Date.parse(row.updatedAt || "");
  return Number.isFinite(n) ? n : 0;
}

/** Cloud merge for TF/AS/TB/ER — keep a just-toggled hak across refresh until cloud catches up. */
export function mergeReports<T extends { id: string; ledelseStatus?: string; updatedAt?: string }>(local: T[], remote: T[], ms = 12000): T[] {
  const now = Date.now();
  const map = new Map<string, T>();
  for (const row of local) map.set(row.id, row);
  for (const row of remote) {
    if (heldAt(row.id) + ms >= now) continue;
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const remoteStatus = row.ledelseStatus;
    const localStatus = prev.ledelseStatus;
    let ledelseStatus = remoteStatus || localStatus;
    if (remoteStatus && localStatus && remoteStatus !== localStatus) {
      const rs = stamp(row);
      const ls = stamp(prev);
      ledelseStatus = rs || ls ? (rs >= ls ? remoteStatus : localStatus) : remoteStatus;
    }
    const updatedAt = stamp(row) >= stamp(prev) ? row.updatedAt || prev.updatedAt : prev.updatedAt || row.updatedAt;
    map.set(row.id, { ...prev, ...row, ...(ledelseStatus ? { ledelseStatus } : {}), ...(updatedAt ? { updatedAt } : {}) });
  }
  return [...map.values()];
}

function mergeMedia<T extends { id?: string; dataUrl?: string; driveFileId?: string }>(local?: T[], remote?: T[]): T[] | undefined {
  if (!local?.length && !remote?.length) return local ?? remote;
  const map = new Map<string, T>();
  let i = 0;
  for (const row of [...(remote ?? []), ...(local ?? [])]) {
    const key = row.driveFileId || row.id || `m-${i++}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    map.set(key, {
      ...prev,
      ...row,
      dataUrl: row.dataUrl || prev.dataUrl,
      driveFileId: row.driveFileId || prev.driveFileId,
    });
  }
  return [...map.values()];
}

export function mergeChats(local: ChatMessage[], remote: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const row of local) map.set(row.id, row);
  for (const row of remote) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const translations = mergeLangMap(prev.original || row.original, prev.translations, row.translations);
    map.set(row.id, {
      ...row,
      ...prev,
      translations,
      photos: mergeMedia(prev.photos as ChatPhoto[] | undefined, row.photos as ChatPhoto[] | undefined) as ChatPhoto[] | undefined,
      files: mergeMedia(prev.files as ChatFile[] | undefined, row.files as ChatFile[] | undefined) as ChatFile[] | undefined,
      classifiedAs: prev.classifiedAs ?? row.classifiedAs,
      classifiedAt: prev.classifiedAt ?? row.classifiedAt,
      original: prev.original || row.original,
    });
  }
  return [...map.values()];
}

export function mergeDays(local: Record<string, DayLog>, remote: DayLog[]): Record<string, DayLog> {
  const next = { ...local };
  for (const row of remote) {
    const key = dayKey(row.employeeId, row.date);
    const prev = next[key];
    next[key] = prev
      ? {
          ...prev,
          ...row,
          photos: row.photos?.length ? row.photos : prev.photos,
        }
      : row;
  }
  return next;
}

void dayRowId;
