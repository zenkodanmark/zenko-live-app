/** Photo ids on an open report. Softr ids are kept, never rendered as images. */

export function isHttpPhotoUrl(value: string | undefined | null): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export function cleanPhotoIds(ids: string[] | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids ?? []) {
    const id = String(raw || "").trim();
    if (!id || /^(data|blob):/i.test(id)) continue;
    const key = isHttpPhotoUrl(id) ? id.split("?")[0].toLowerCase() : id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Untouched text-save keeps every id already on the row.
 * After the master adds or removes photos, the draft list is the list.
 * Empty only when that draft is empty.
 */
export function photoIdsForSave(previous: string[] | undefined | null, draft: string[] | undefined | null, touched: boolean): string[] {
  if (!touched) return cleanPhotoIds(previous);
  return cleanPhotoIds(draft);
}

export function visibleReportPhotos(ids: string[] | undefined | null): { id: string; src: string; video: boolean }[] {
  const out: { id: string; src: string; video: boolean }[] = [];
  const seen = new Set<string>();
  for (const raw of ids ?? []) {
    const id = String(raw || "").trim();
    if (!isHttpPhotoUrl(id) || /^softr-/i.test(id)) continue;
    const key = id.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, src: id, video: /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(id) });
  }
  return out;
}

export function photoFolderOf(kind: string): "as" | "er" | "tf" | "tb" | "todo" | null {
  if (kind === "slip" || kind === "as") return "as";
  if (kind === "offer" || kind === "tb") return "tb";
  if (kind === "tf") return "tf";
  if (kind === "ent" || kind === "er") return "er";
  if (kind === "todo") return "todo";
  return null;
}
