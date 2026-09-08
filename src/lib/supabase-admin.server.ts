import { readFileSync } from "node:fs";
import { env } from "./env.server";
import { SB_BUCKET, SB_URL, sbPublicUrl } from "./supabase";

/** Server-only. Never import this module from client components. Never log the value. */
export function sbSecret(): string {
  const fromEnv = env("SUPABASE_SECRET_KEY") || env("SB_SECRET") || "";
  if (fromEnv) return fromEnv;
  for (const file of ["/workspace/.local/supabase-secret", new URL("../../.local/supabase-secret", import.meta.url)]) {
    try {
      const v = readFileSync(file, "utf8").trim();
      if (v) return v;
    } catch {
      /* missing file is fine */
    }
  }
  return "";
}

export async function sbUpload(path: string, body: string | Uint8Array, mime: string) {
  const key = sbSecret();
  if (!key) return { ok: false as const, url: "", error: "Supabase-secret mangler på serveren" };
  const clean = path.replace(/^\/+/, "");
  const payload = typeof body === "string" ? body : Buffer.from(body);
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": mime || "application/octet-stream",
    "x-upsert": "true",
    "cache-control": mime.includes("json") ? "no-cache" : "public, max-age=3600",
  };
  const url = `${SB_URL}/storage/v1/object/${SB_BUCKET}/${clean}`;
  let res = await fetch(url, { method: "POST", headers, body: payload });
  if (!res.ok) {
    res = await fetch(url, { method: "PUT", headers, body: payload });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false as const, url: "", error: text.slice(0, 240) || `HTTP ${res.status}` };
  }
  return { ok: true as const, url: sbPublicUrl(clean), error: "" };
}

export async function sbUploadBase64(path: string, base64: string, mime: string) {
  const raw = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const buf = Buffer.from(raw, "base64");
  return sbUpload(path, buf, mime);
}
