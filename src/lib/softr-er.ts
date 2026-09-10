import type { Entrepreneur } from "./types";
import { isSoftrEtNumber } from "./softr-et-numbers.ts";
import { defaultLedelseStatus } from "./sag-ledelse-defaults.ts";
import manifest from "./softr-as-manifest.json" with { type: "json" };

type SoftrAsPhoto = { file: string; name: string; driveFileId?: string; driveUrl?: string };
type SoftrAsRow = {
  id: string;
  no: number;
  date: string;
  title: string;
  body: string;
  loc: string;
  solution: string;
  projectId: string;
  projectName: string;
  photos: SoftrAsPhoto[];
};

const ROWS = (manifest as SoftrAsRow[]).filter((r) => isSoftrEtNumber(r.no));

export function softrErReports(): Entrepreneur[] {
  return ROWS.map((r) => ({
    id: `ent-softr-${r.no}`,
    number: `ER-${r.no}`,
    projectId: r.projectId,
    title: r.title || `Entreprenørrapport ${r.no}`,
    location: r.loc || "",
    body: r.body || r.title || "",
    noteHe: r.solution || "",
    createdAt: r.date || new Date().toISOString(),
    status: "issued" as const,
    photoIds: r.photos.map((_, i) => `softr-as-${r.no}-${i + 1}`),
    source: "softr",
    ledelseStatus: defaultLedelseStatus("er", `ER-${r.no}`),
  }));
}

export function ensureSoftrEr(state: { ents: Entrepreneur[] }) {
  if (!Array.isArray(state.ents)) state.ents = [];
  const fresh = softrErReports();
  const byId = new Map(state.ents.map((e) => [e.id, e]));
  for (const row of fresh) {
    const prev = byId.get(row.id);
    if (!prev) {
      state.ents = [row, ...state.ents];
      continue;
    }
    if (prev.trashedAt) continue;
    prev.photoIds = row.photoIds;
    prev.title = row.title;
    prev.body = row.body;
    prev.location = row.location;
    prev.noteHe = row.noteHe;
    prev.projectId = row.projectId;
    prev.source = "softr";
    prev.status = "issued";
    if (prev.ledelseStatus == null) prev.ledelseStatus = row.ledelseStatus;
  }
  for (const ent of state.ents) {
    if (ent.ledelseStatus == null) ent.ledelseStatus = defaultLedelseStatus("er", ent.number);
  }
  return state;
}

export function hydrateSoftrEnt(ent: Entrepreneur): Entrepreneur {
  const fresh = softrErReports().find((e) => e.id === ent.id);
  if (!fresh) return { ...ent, ledelseStatus: ent.ledelseStatus ?? defaultLedelseStatus("er", ent.number) };
  return { ...ent, ...fresh, trashedAt: ent.trashedAt, ledelseStatus: ent.ledelseStatus ?? fresh.ledelseStatus, kundeStatus: ent.kundeStatus ?? fresh.kundeStatus, ledelseReplies: ent.ledelseReplies };
}
