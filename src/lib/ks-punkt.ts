import { planForProject, type UdbudPart } from "./udbud-plan.ts";
import type { KsReport } from "./types.ts";

export const KP_PREFIX = "__kp:";
export const PUNKT_NEW = "__new__";

const PUNKT_MEM = new Map<string, string>();

export function rememberKundePunkt(id: string, punkt: string | undefined) {
  const v = (punkt ?? "").trim();
  if (v) PUNKT_MEM.set(id, v);
  else PUNKT_MEM.delete(id);
}

export function recalledKundePunkt(id: string) {
  return PUNKT_MEM.get(id);
}

export type PunktChoice = { value: string; label: string; custom?: boolean };

export function encodeKundePunkt(value: string) {
  return `${KP_PREFIX}${value}`;
}

export function kundePunktFromPhotoIds(ids: string[] | undefined | null): string | undefined {
  const hit = (ids ?? []).find((id) => id.startsWith(KP_PREFIX));
  if (!hit) return undefined;
  return hit.slice(KP_PREFIX.length);
}

export function photoIdsWithoutPunkt(ids: string[] | undefined | null): string[] {
  return (ids ?? []).filter((id) => !id.startsWith(KP_PREFIX));
}

export function photoIdsWithPunkt(ids: string[] | undefined | null, punkt: string | undefined): string[] {
  const clean = photoIdsWithoutPunkt(ids);
  if (punkt) clean.push(encodeKundePunkt(punkt));
  return clean;
}

export function shortPunktTitle(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  return t
    .replace(/^\d+\.\d+(?:\.\d+)?\s+/, "")
    .replace(/\s+[–—-]\s+.*$/, "")
    .trim() || t;
}

export function udbudChoices(projectId: string): PunktChoice[] {
  const plan: UdbudPart[] = planForProject(projectId);
  const seen = new Set<string>();
  const out: PunktChoice[] = [];
  for (const p of plan) {
    if (seen.has(p.code)) continue;
    seen.add(p.code);
    out.push({ value: p.code, label: `${p.code} ${shortPunktTitle(p.title)}` });
  }
  return out;
}

export function customChoices(rows: Pick<KsReport, "kundePunkt" | "projectId">[], projectId: string): PunktChoice[] {
  const udbud = new Set(udbudChoices(projectId).map((c) => c.value));
  const seen = new Set<string>();
  const out: PunktChoice[] = [];
  for (const r of rows) {
    const v = (r.kundePunkt ?? "").trim();
    if (!v || udbud.has(v) || seen.has(v)) continue;
    seen.add(v);
    out.push({ value: v, label: shortPunktTitle(v), custom: true });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "da"));
}

export function punktChoices(projectId: string, rows: Pick<KsReport, "kundePunkt" | "projectId">[]): PunktChoice[] {
  return [...udbudChoices(projectId), ...customChoices(rows, projectId)];
}
