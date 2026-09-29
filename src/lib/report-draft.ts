/** Open report is a draft. Nothing hits the database until Gem. */

export function draftDirty(baseline: Record<string, string>, draft: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(draft)]);
  for (const key of keys) {
    if ((baseline[key] ?? "") !== (draft[key] ?? "")) return true;
  }
  return false;
}

export type ServerCue = "keep" | "adopt" | "ask";

/**
 * Poll / realtime while a report is open.
 * Not dirty → take the server row.
 * Dirty and the server stamp moved → ask. Default is keep the draft.
 * Dirty and the stamp did not move → keep, do not touch the fields.
 */
export function serverCue(opts: { dirty: boolean; baseStamp: string; serverStamp: string }): ServerCue {
  if (!opts.dirty) return "adopt";
  const server = opts.serverStamp || "";
  const base = opts.baseStamp || "";
  if (server && server !== base && server > base) return "ask";
  return "keep";
}

export function reportStamp(row: { updatedAt?: string; fixAt?: string } | null | undefined): string {
  if (!row) return "";
  return String(row.updatedAt || row.fixAt || "");
}
