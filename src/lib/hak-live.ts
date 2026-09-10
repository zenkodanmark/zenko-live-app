import { entToRow, ksToRow, offerToRow, slipToRow, tfToRow } from "./sb-rows";
import { supabase } from "./supabase";
import type { Entrepreneur, KsReport, KundeStatus, LedelseStatus, Offer, Slip, Tf } from "./types";

export type HakRowKind = "tf" | "slip" | "offer" | "ent" | "ks";

export const KUNDE_SENTINEL = "__kunde";

function tableOf(kind: HakRowKind) {
  if (kind === "tf") return "tfs";
  if (kind === "slip") return "slips";
  if (kind === "offer") return "offers";
  if (kind === "ent") return "ents";
  return "ks_reports";
}

export function entRepliesForKunde(
  replies: { id: string; text: string; at: string }[] | undefined,
  status: KundeStatus | undefined,
) {
  const out = (replies ?? []).filter((r) => r.id !== KUNDE_SENTINEL);
  if (status === "med_til_kunden" || status === "skjult") {
    out.push({ id: KUNDE_SENTINEL, text: status, at: new Date().toISOString() });
  }
  return out;
}

export function kundeFromEntReplies(replies: unknown): KundeStatus | undefined {
  if (!Array.isArray(replies)) return undefined;
  const hit = replies.find((r) => r && typeof r === "object" && (r as { id?: string }).id === KUNDE_SENTINEL) as { text?: string } | undefined;
  if (hit?.text === "med_til_kunden" || hit?.text === "skjult") return hit.text;
  return undefined;
}

export function stripKundeSentinel<T extends { id: string }>(replies: T[] | undefined): T[] {
  return (replies ?? []).filter((r) => r.id !== KUNDE_SENTINEL);
}

function fullRow(kind: HakRowKind, row: Tf | Slip | Offer | Entrepreneur | KsReport) {
  if (kind === "tf") return tfToRow(row as Tf);
  if (kind === "ent") return entToRow(row as Entrepreneur);
  if (kind === "offer") return offerToRow(row as Offer);
  if (kind === "ks") return ksToRow(row as KsReport);
  return slipToRow(row as Slip);
}

export async function publishLedelseHak(
  kind: Exclude<HakRowKind, "ks">,
  id: string,
  status: LedelseStatus,
  row?: Tf | Slip | Offer | Entrepreneur,
): Promise<boolean> {
  const sb = supabase();
  const table = tableOf(kind);
  const patch = { ledelse_status: status, updated_at: new Date().toISOString() };
  try {
    const upd = await sb.from(table).update(patch).eq("id", id).select("ledelse_status").maybeSingle();
    if (!upd.error && (upd.data as { ledelse_status?: string } | null)?.ledelse_status === status) return true;
    if (!row) return false;
    const up = await sb.from(table).upsert({ ...fullRow(kind, row), ledelse_status: status });
    if (up.error) return false;
    const read = await sb.from(table).select("ledelse_status").eq("id", id).maybeSingle();
    return (read.data as { ledelse_status?: string } | null)?.ledelse_status === status;
  } catch {
    return false;
  }
}

export async function publishKundeHak(
  kind: "tf" | "ent" | "ks",
  id: string,
  status: KundeStatus,
  row?: Tf | Entrepreneur | KsReport,
): Promise<boolean> {
  const sb = supabase();
  const table = tableOf(kind);
  const patch: Record<string, unknown> = { kunde_status: status, updated_at: new Date().toISOString() };
  if (kind === "ent") {
    const replies = row && "ledelseReplies" in row ? (row as Entrepreneur).ledelseReplies : [];
    patch.ledelse_replies = entRepliesForKunde(replies, status);
  }
  try {
    let upd = await sb.from(table).update(patch).eq("id", id).select("*").maybeSingle();
    if (upd.error) {
      const { kunde_status: _drop, ...rest } = patch;
      upd = await sb.from(table).update(rest).eq("id", id).select("*").maybeSingle();
    }
    if (upd.error || !upd.data) return false;
    const data = upd.data as unknown as Record<string, unknown>;
    if (data.kunde_status === status) return true;
    if (kind === "ent" && kundeFromEntReplies(data.ledelse_replies) === status) return true;
    return false;
  } catch {
    return false;
  }
}
