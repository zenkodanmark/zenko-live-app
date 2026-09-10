import { softrKsReports } from "./softr-ks.ts";
import type { KsReport } from "./types.ts";

/** Mester KS-liste: alle rækker til sagen. Intet id-prefix-filter. Kunde-hak skjuler ikke. Retter ikke project_id i tabellen. */
export function mesterKsForJob(storeRows: KsReport[], jobId: string, opts?: { allJobs?: boolean; trashed?: boolean }): KsReport[] {
  const bundled = softrKsReports();
  const map = new Map<string, KsReport>();
  for (const r of storeRows) map.set(r.id, r);
  for (const r of bundled) {
    const prev = map.get(r.id);
    if (!prev) {
      map.set(r.id, r);
      continue;
    }
    map.set(r.id, {
      ...r,
      ...prev,
      kundeStatus: prev.kundeStatus ?? r.kundeStatus,
      trashedAt: prev.trashedAt,
      ledelseStatus: prev.ledelseStatus ?? r.ledelseStatus,
    });
  }
  const wantTrash = Boolean(opts?.trashed);
  const allJobs = Boolean(opts?.allJobs);
  return [...map.values()].filter((r) => {
    if (Boolean(r.trashedAt) !== wantTrash) return false;
    if (allJobs) return true;
    if (r.projectId === jobId) return true;
    const fromBundle = bundled.find((x) => x.id === r.id);
    return fromBundle?.projectId === jobId;
  });
}
