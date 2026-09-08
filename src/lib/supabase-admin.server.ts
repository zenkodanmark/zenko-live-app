import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { env } from "./env.server";
import { SB_ANON, SB_BUCKET, SB_URL, sbPublicUrl } from "./supabase";

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

let admin: SupabaseClient | null = null;

/** Service client. Uses secret on the server, never shipped to the browser. */
export function sbAdmin(): SupabaseClient {
  if (!admin) {
    const key = sbSecret() || SB_ANON;
    admin = createClient(SB_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}

export function tablesMissing(err?: { code?: string; message?: string } | null) {
  if (!err) return false;
  const msg = `${err.code ?? ""} ${err.message ?? ""}`;
  return /PGRST205|42P01|schema cache|does not exist/i.test(msg);
}

export async function sbUpsert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (!list.length) return { ok: true as const, error: "" };
  const { error } = await sbAdmin().from(table).upsert(list);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, error: "" };
}

export async function sbSelect<T = Record<string, unknown>>(table: string, limit = 500) {
  const { data, error } = await sbAdmin().from(table).select("*").limit(limit);
  if (error) return { ok: false as const, rows: [] as T[], error: error.message, missing: tablesMissing(error) };
  return { ok: true as const, rows: (data ?? []) as T[], error: "", missing: false };
}

export async function sbUpload(path: string, body: string | Uint8Array, mime: string) {
  const clean = path.replace(/^\/+/, "");
  const payload = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
  const { error } = await sbAdmin().storage.from(SB_BUCKET).upload(clean, payload, {
    upsert: true,
    contentType: mime || "application/octet-stream",
    cacheControl: mime.includes("json") ? "0" : "3600",
  });
  if (error) return { ok: false as const, url: "", error: error.message };
  return { ok: true as const, url: sbPublicUrl(clean), error: "" };
}

export async function sbUploadBase64(path: string, base64: string, mime: string) {
  const raw = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const buf = Buffer.from(raw, "base64");
  return sbUpload(path, buf, mime);
}
