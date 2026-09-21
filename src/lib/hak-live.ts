import { entToRow, ksToRow, offerToRow, slipToRow, tfToRow, todoToRow } from "./sb-rows";
import { photoIdsWithPunkt, kundePunktFromPhotoIds } from "./ks-punkt";
import { supabase } from "./supabase";
import { isMissingTableError, updateKnown, upsertKnown } from "./sb-upsert";
import type { Entrepreneur, KsReport, KundeStatus, LedelseStatus, Offer, Slip, Tf, Todo } from "./types";

export type HakRowKind = "tf" | "slip" | "offer" | "ent" | "ks" | "todo";

export const KUNDE_SENTINEL = "__kunde";

function tablesOf(kind: HakRowKind) {
  if (kind === "tf") return ["tfs"];
  if (kind === "slip") return ["slips"];
  if (kind === "offer") return ["offers", "slips"];
  if (kind === "ent") return ["ents"];
  if (kind === "todo") return ["todos"];
  return ["ks_reports"];
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

function fullRow(kind: HakRowKind, row: Tf | Slip | Offer | Entrepreneur | KsReport | Todo) {
  if (kind === "tf") return tfToRow(row as Tf);
  if (kind === "ent") return entToRow(row as Entrepreneur);
  if (kind === "offer") return offerToRow(row as Offer);
  if (kind === "ks") return ksToRow(row as KsReport);
  if (kind === "todo") return todoToRow(row as Todo);
  return slipToRow(row as Slip);
}

export async function publishLedelseHak(
  kind: Exclude<HakRowKind, "ks">,
  id: string,
  status: LedelseStatus,
  row?: Tf | Slip | Offer | Entrepreneur | Todo,
): Promise<boolean> {
  const sb = supabase();
  const patch = { ledelse_status: status, updated_at: new Date().toISOString() };
  try {
    for (const table of tablesOf(kind)) {
      const upd = await updateKnown(
        async (r) => {
          const res = await sb.from(table).update(r).eq("id", id).select("ledelse_status").maybeSingle();
          return { error: res.error, data: res.data };
        },
        patch,
      );
      if (upd.missingTable) continue;
      if (upd.ok && (upd.data as { ledelse_status?: string } | null)?.ledelse_status === status) return true;
      if (!row) continue;
      const ok = await upsertKnown(
        async (r) => {
          const res = await sb.from(table).upsert(r);
          return { error: res.error };
        },
        { ...fullRow(kind, row), ledelse_status: status } as Record<string, unknown>,
      );
      if (!ok) continue;
      const read = await sb.from(table).select("ledelse_status").eq("id", id).maybeSingle();
      if (isMissingTableError(read.error)) continue;
      if ((read.data as { ledelse_status?: string } | null)?.ledelse_status === status) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function publishKundeHak(
  kind: "tf" | "ent" | "ks" | "slip" | "offer" | "todo",
  id: string,
  status: KundeStatus,
  row?: Tf | Entrepreneur | KsReport | Slip | Offer | Todo,
): Promise<boolean> {
  const sb = supabase();
  const patch: Record<string, unknown> = { kunde_status: status, updated_at: new Date().toISOString() };
  if (kind === "ent") {
    const replies = row && "ledelseReplies" in row ? (row as Entrepreneur).ledelseReplies : [];
    patch.ledelse_replies = entRepliesForKunde(replies, status);
  }
  try {
    for (const table of tablesOf(kind)) {
      const upd = await updateKnown(
        async (r) => {
          const res = await sb.from(table).update(r).eq("id", id).select("*").maybeSingle();
          return { error: res.error, data: res.data };
        },
        patch,
      );
      if (upd.missingTable) continue;
      if (upd.ok && upd.data) {
        const data = upd.data;
        if (data.kunde_status === status) return true;
        if (kind === "ent" && kundeFromEntReplies(data.ledelse_replies) === status) return true;
      }
      if (!row) continue;
      const payload = { ...fullRow(kind, row), kunde_status: status, ...patch } as Record<string, unknown>;
      const ok = await upsertKnown(
        async (r) => {
          const res = await sb.from(table).upsert(r);
          return { error: res.error };
        },
        payload,
      );
      if (!ok) continue;
      const read = await sb.from(table).select("*").eq("id", id).maybeSingle();
      if (isMissingTableError(read.error) || !read.data) continue;
      const data = read.data as Record<string, unknown>;
      if (data.kunde_status === status) return true;
      if (kind === "ent" && kundeFromEntReplies(data.ledelse_replies) === status) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function publishKsPunkt(row: KsReport, punkt: string): Promise<boolean> {
  const sb = supabase();
  const photo_ids = photoIdsWithPunkt(row.photoIds, punkt);
  const withCol = { kunde_punkt: punkt || null, photo_ids, updated_at: new Date().toISOString() };
  try {
    const upd = await updateKnown(
      async (r) => {
        const res = await sb.from("ks_reports").update(r).eq("id", row.id).select("*").maybeSingle();
        return { error: res.error, data: res.data };
      },
      withCol,
    );
    if (!upd.ok || !upd.data) return false;
    const data = upd.data;
    const col = typeof data.kunde_punkt === "string" ? data.kunde_punkt : "";
    const got = col || kundePunktFromPhotoIds(data.photo_ids as string[]) || "";
    return got === (punkt || "");
  } catch {
    return false;
  }
}
