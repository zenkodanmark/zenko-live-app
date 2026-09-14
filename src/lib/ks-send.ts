import { ksFromRow, ksToRow } from "./sb-rows";
import { FIRM, copenhagenDate } from "./seed";
import { supabase } from "./supabase";
import { emitYard } from "./yard-bus";
import { holdRow, slimKs } from "./yard-slim";
import { saveYardKs } from "./yard-sync.functions";
import type { KsReport } from "./types";

function pad(n: number) {
  return String(Math.max(1, n)).padStart(3, "0");
}

type YardSnap = {
  serial: { ks: number };
  employeeId: string | null;
  employees: { id: string; name: string }[];
  days: Record<string, { projectId?: string; date?: string; checkInAt?: string | null; employeeId?: string }>;
};

export function makeKsDraft(
  s: YardSnap,
  projectId: string,
  point: string,
  extra?: { photoIds?: string[]; deviations?: string; location?: string; task?: string; workDate?: string },
): KsReport {
  const n = s.serial.ks;
  const number = `Z-KS-${new Date().getFullYear()}-${pad(n)}`;
  const emp = s.employees.find((e) => e.id === s.employeeId);
  const date = extra?.workDate || copenhagenDate();
  const crew = [
    ...new Set(
      Object.values(s.days)
        .filter((d) => d.projectId === projectId && d.date === date && d.checkInAt)
        .map((d) => s.employees.find((e) => e.id === d.employeeId)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].join(", ");
  return {
    id: `ksr-${crypto.randomUUID().slice(0, 8)}`,
    number,
    projectId,
    point,
    createdAt: extra?.workDate ? `${extra.workDate}T12:00:00.000+02:00` : new Date().toISOString(),
    status: "issued",
    deviations: extra?.deviations?.trim() || "Ingen afvigelser.",
    approved: true,
    employeeName: emp?.name ?? "Mester",
    employeeId: emp?.id,
    crew: crew || emp?.name || "Sjak",
    process: "Murerarbejde",
    trade: "Murer",
    company: FIRM,
    photoIds: extra?.photoIds ?? [],
    location: extra?.location,
    task: extra?.task,
    kundeStatus: "skjult",
  };
}

export async function insertKsReport(row: KsReport): Promise<{ ok: true; id: string; row: KsReport } | { ok: false }> {
  try {
    const payload = ksToRow(row);
    let saved: KsReport | null = null;
    const ins = await supabase().from("ks_reports").insert(payload).select("*").maybeSingle();
    if (!ins.error && ins.data) {
      saved = { ...row, ...ksFromRow(ins.data as Record<string, unknown>) };
    }
    if (!saved?.id) {
      const up = await supabase().from("ks_reports").upsert(payload).select("*").maybeSingle();
      if (!up.error && up.data) saved = { ...row, ...ksFromRow(up.data as Record<string, unknown>) };
    }
    const actor = row.employeeId ?? "ks";
    const admin = await saveYardKs({ data: { report: saved ?? row, isNew: true, actorId: actor } }).catch(() => ({ ok: false as const }));
    if (!saved?.id && admin?.ok) saved = row;
    if (!saved?.id) return { ok: false };
    holdRow(saved.id);
    emitYard({ kind: "ks", id: saved.id, payload: slimKs(saved), isNew: true, actorId: actor });
    return { ok: true, id: saved.id, row: saved };
  } catch {
    return { ok: false };
  }
}
