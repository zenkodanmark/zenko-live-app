import type { Tf } from "./types";
import { isSoftrTfNumber } from "./softr-tf-numbers.ts";
import { defaultLedelseStatus } from "./sag-ledelse-defaults.ts";
import manifest from "./softr-as-manifest.json" with { type: "json" };

type SoftrAsPhoto = { file: string; name: string; driveFileId?: string; driveUrl?: string };
type SoftrAsRow = {
  no: number;
  date: string;
  title: string;
  body: string;
  loc: string;
  solution: string;
  projectId: string;
  photos: SoftrAsPhoto[];
};

const ROWS = (manifest as SoftrAsRow[]).filter((r) => isSoftrTfNumber(r.no));

export function softrTfReports(): Tf[] {
  return ROWS.map((r) => ({
    id: `tf-softr-${r.no}`,
    number: `TF-${r.no}`,
    projectId: r.projectId,
    title: r.title || `Teknisk forespørgsel ${r.no}`,
    question: r.body || r.title || "",
    answer: r.solution || undefined,
    answered: Boolean(r.solution),
    createdAt: r.date || new Date().toISOString(),
    status: "issued" as const,
    photoIds: r.photos.map((_, i) => `softr-as-${r.no}-${i + 1}`),
    source: "softr",
    ledelseStatus: defaultLedelseStatus("tf", `TF-${r.no}`),
  }));
}

export function ensureSoftrTf(state: { tfs: Tf[] }) {
  if (!Array.isArray(state.tfs)) state.tfs = [];
  const fresh = softrTfReports();
  const byId = new Map(state.tfs.map((e) => [e.id, e]));
  for (const row of fresh) {
    const prev = byId.get(row.id);
    if (!prev) {
      state.tfs = [row, ...state.tfs];
      continue;
    }
    if (prev.trashedAt) continue;
    prev.photoIds = row.photoIds;
    prev.title = row.title;
    prev.question = row.question;
    prev.projectId = row.projectId;
    prev.source = "softr";
    prev.status = "issued";
    if (prev.ledelseStatus == null) prev.ledelseStatus = row.ledelseStatus;
  }
  for (const tf of state.tfs) {
    if (tf.ledelseStatus == null) tf.ledelseStatus = defaultLedelseStatus("tf", tf.number);
  }
  return state;
}

export function hydrateSoftrTf(tf: Tf): Tf {
  const fresh = softrTfReports().find((e) => e.id === tf.id);
  if (!fresh) return { ...tf, ledelseStatus: tf.ledelseStatus ?? defaultLedelseStatus("tf", tf.number) };
  return { ...tf, ...fresh, trashedAt: tf.trashedAt, answer: tf.answer, answered: tf.answered, shareToken: tf.shareToken, ledelseStatus: tf.ledelseStatus ?? fresh.ledelseStatus, ledelseReplies: tf.ledelseReplies, kundeStatus: tf.kundeStatus ?? fresh.kundeStatus };
}
