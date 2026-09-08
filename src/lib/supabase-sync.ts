import { pushYardState, saveYardRow, uploadPladsFile } from "./supabase.functions";
import { sbPublicUrl } from "./supabase";

export async function pullYardState(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${sbPublicUrl("yard/state.json")}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json !== "object") return null;
    if (json.state && typeof json.state === "object") return json.state as Record<string, unknown>;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function publishYardState(json: string) {
  try {
    return await pushYardState({ data: { json } });
  } catch {
    return { ok: false as const, error: "kunne ikke gemme" };
  }
}

export async function publishYardRow(table: string, id: string, payload: unknown) {
  try {
    return await saveYardRow({ data: { table, id, payload } });
  } catch {
    return { ok: false as const, error: "kunne ikke gemme" };
  }
}

export async function publishPladsFile(path: string, contentBase64: string, mimeType?: string) {
  return uploadPladsFile({ data: { path, contentBase64, mimeType } });
}
