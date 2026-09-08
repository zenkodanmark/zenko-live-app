/** Public Supabase config. The secret key never lives in this file or anywhere in the client bundle. */
export const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
export const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
export const SB_BUCKET = "plads";

export function sbPublicUrl(path: string) {
  return `${SB_URL}/storage/v1/object/public/${SB_BUCKET}/${String(path).replace(/^\/+/, "")}`;
}

export function sbSafeSegment(s: string) {
  return String(s || "x")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "x";
}

export function isSupabaseFile(id?: string | null) {
  if (!id) return false;
  return id.includes("supabase.co") || id.startsWith("sb:") || id.startsWith(`${SB_BUCKET}/`);
}

export function sbFileSrc(id?: string | null) {
  if (!id) return "";
  if (id.startsWith("http://") || id.startsWith("https://")) return id;
  if (id.startsWith("sb:")) return sbPublicUrl(id.slice(3));
  if (id.startsWith(`${SB_BUCKET}/`)) return sbPublicUrl(id.slice(SB_BUCKET.length + 1));
  return "";
}
