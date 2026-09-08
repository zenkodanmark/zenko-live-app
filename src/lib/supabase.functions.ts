import { createServerFn } from "@tanstack/react-start";
import { sbSecret, sbUpload, sbUploadBase64 } from "./supabase-admin.server";
import { sbPublicUrl } from "./supabase";

export const pushYardState = createServerFn({ method: "POST" })
  .validator((input: { json: string }) => input)
  .handler(async ({ data }) => {
    if (!sbSecret()) return { ok: false as const, error: "Supabase-secret mangler på serveren" };
    const wrote = await sbUpload("yard/state.json", data.json, "application/json");
    return wrote.ok ? { ok: true as const, error: "" } : { ok: false as const, error: wrote.error };
  });

export const saveYardRow = createServerFn({ method: "POST" })
  .validator((input: { table: string; id: string; payload: unknown }) => input)
  .handler(async ({ data }) => {
    const table = data.table.replace(/[^a-z0-9_]/gi, "");
    const id = data.id.replace(/[^a-z0-9._-]/gi, "");
    if (!table || !id) return { ok: false as const, url: "", error: "Ugyldig række" };
    const wrote = await sbUpload(`tables/${table}/${id}.json`, JSON.stringify(data.payload), "application/json");
    return wrote;
  });

export const uploadPladsFile = createServerFn({ method: "POST" })
  .validator((input: { path: string; contentBase64: string; mimeType?: string }) => input)
  .handler(async ({ data }) => {
    const path = String(data.path || "").replace(/^\/+/, "").replace(/\.\./g, "");
    if (!path) return { ok: false as const, url: "", fileId: "", error: "Mangler sti" };
    const mime = data.mimeType || "application/octet-stream";
    const wrote = await sbUploadBase64(path, data.contentBase64, mime);
    return {
      ok: wrote.ok,
      url: wrote.url,
      fileId: wrote.url || sbPublicUrl(path),
      error: wrote.error,
    };
  });
