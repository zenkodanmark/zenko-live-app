import { SB_BUCKET, isSupabaseFile, sbFileSrc, sbPublicUrl, sbSafeSegment, supabase } from "./supabase.ts";

export function isGoogleUrl(s: string) {
  return /drive\.google|googleusercontent|googleapis\.com\/drive|\bgoogle\.com\/uc\b/i.test(s);
}

/** Public file URL. Never returns a Google Drive link. */
export function fileHref(id?: string | null): string {
  if (!id) return "";
  const s = String(id).trim();
  if (!s || isGoogleUrl(s)) return "";
  const sb = sbFileSrc(s);
  if (sb) return sb;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.includes("/")) return sbPublicUrl(s.replace(new RegExp(`^${SB_BUCKET}/`), ""));
  return "";
}

export function pladsPath(projectId: string, kind: string, name: string) {
  const ext = (name.match(/\.[a-z0-9]{1,8}$/i)?.[0] || "").toLowerCase();
  const stem = sbSafeSegment(name.replace(/\.[^.]+$/, "")) || "fil";
  return `${sbSafeSegment(projectId)}/${sbSafeSegment(kind)}/${Date.now().toString(36)}-${stem}${ext}`;
}

function b64ToBlob(base64: string, mime: string) {
  const raw = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

export async function uploadPladsBytes(opts: {
  path: string;
  contentBase64: string;
  mimeType?: string;
  projectId?: string;
  kind?: string;
  name?: string;
}): Promise<{ ok: boolean; url: string; fileId: string; error: string }> {
  const path = String(opts.path || "").replace(/^\/+/, "").replace(/\.\./g, "");
  if (!path) return { ok: false, url: "", fileId: "", error: "Mangler sti" };
  const mime = opts.mimeType || "application/octet-stream";
  try {
    const blob = b64ToBlob(opts.contentBase64, mime);
    const { error } = await supabase().storage.from(SB_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    });
    if (error) return { ok: false, url: "", fileId: "", error: error.message };
    const url = sbPublicUrl(path);
    try {
      await supabase().from("files").upsert({
        id: url,
        project_id: opts.projectId ?? null,
        kind: opts.kind ?? "file",
        path,
        name: opts.name || path.split("/").pop() || path,
        mime,
        url,
      });
    } catch {
      /* listing still works from storage */
    }
    return { ok: true, url, fileId: url, error: "" };
  } catch (e) {
    return { ok: false, url: "", fileId: "", error: e instanceof Error ? e.message : "kunne ikke gemme" };
  }
}

export async function listPladsPrefix(prefix: string): Promise<{ name: string; url: string; path: string }[]> {
  const folder = prefix.replace(/^\/+|\/+$/g, "");
  if (!folder) return [];
  try {
    const { data, error } = await supabase().storage.from(SB_BUCKET).list(folder, {
      limit: 80,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !data?.length) return [];
    return data
      .filter((row) => row.name && !row.name.endsWith("/") && (row.metadata || row.id))
      .map((row) => {
        const path = `${folder}/${row.name}`;
        return { name: row.name, path, url: sbPublicUrl(path) };
      });
  } catch {
    return [];
  }
}
