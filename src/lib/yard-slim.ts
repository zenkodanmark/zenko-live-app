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
