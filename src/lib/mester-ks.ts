import { softrKsReports } from "./softr-ks.ts";
import { recalledKundePunkt } from "./ks-punkt.ts";
import type { KsReport } from "./types.ts";

/** Mester KS-liste: alle rækker med sagens project_id. Intet id-prefix-filter. Kunde-hak skjuler ikke. Retter ikke project_id. */
export function mesterKsForJob(storeRows: KsReport[], jobId: string, opts?: { allJobs?: boolean; trashed?: boolean }): KsReport[] {
  const bundled = softrKsReports();
  const map = new Map<string, KsReport>();
  for (const r of bundled) {
    const mem = recalledKundePunkt(r.id);
    map.set(r.id, mem && !r.kundePunkt ? { ...r, kundePunkt: mem } : r);
  }
  for (const r of storeRows) {
    const prev = map.get(r.id);
    if (!prev) {
      map.set(r.id, r);
      continue;
    }
    map.set(r.id, {
      ...prev,
      ...r,
      projectId: r.projectId || prev.projectId,
      kundeStatus: r.kundeStatus ?? prev.kundeStatus,
      trashedAt: r.trashedAt,
      ledelseStatus: r.ledelseStatus ?? prev.ledelseStatus,
      kundePunkt: r.kundePunkt || recalledKundePunkt(r.id) || prev.kundePunkt,
    });
  }
  const wantTrash = Boolean(opts?.trashed);
  const allJobs = Boolean(opts?.allJobs);
  return [...map.values()].map((r) => {
    const mem = recalledKundePunkt(r.id);
    return mem && !r.kundePunkt ? { ...r, kundePunkt: mem } : r;
  }).filter((r) => {
    if (Boolean(r.trashedAt) !== wantTrash) return false;
    if (allJobs) return true;
    return r.projectId === jobId;
  });
}
