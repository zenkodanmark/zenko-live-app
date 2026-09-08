import { useEffect, useMemo, useState } from "react";
import { getSagLedelse } from "./sag-ledelse.functions";
import {
  buildSagSite,
  bundledSagInputs,
  isLedelseOn,
  projectIdFromSlug,
  type SagJobMeta,
  type SagSite,
} from "./sag-ledelse";
import { defaultLedelseStatus } from "./sag-ledelse-defaults";
import { useYard } from "./store";
import type { Entrepreneur, FieldItem, LedelseReply, LedelseStatus, Project, Slip, Tf } from "./types";

function mergeById<T extends { id: string }>(base: T[], extra: T[]) {
  const map = new Map<string, T>();
  for (const row of base) map.set(row.id, row);
  for (const row of extra) map.set(row.id, { ...map.get(row.id), ...row });
  return [...map.values()];
}

type DbState = {
  tracked: boolean;
  items: { id: string; kind: string; status: string }[];
  replies: { id: string; tfId: string; text: string; at: string }[];
  jobExtra: Partial<SagJobMeta> | null;
};

function applyStatus<T extends { id: string; number: string; ledelseStatus?: LedelseStatus }>(rows: T[], kind: "tf" | "as" | "er", db: DbState | null, hasLocal: boolean): T[] {
  const byId = new Map((db?.items ?? []).filter((i) => i.kind === kind).map((i) => [i.id, i.status]));
  return rows.map((r) => {
    if (hasLocal && r.ledelseStatus) return r;
    const dbStatus = byId.get(r.id);
    if (dbStatus === "med_til_ledelse" || dbStatus === "skjult") return { ...r, ledelseStatus: dbStatus };
    if (r.ledelseStatus) return r;
    return { ...r, ledelseStatus: defaultLedelseStatus(kind, r.number) };
  });
}

export function useSagSite(slug: string): { site: SagSite | null; missing: boolean; busy: boolean; reload: () => void } {
  const projects = useYard((s) => s.projects) ?? [];
  const tfs = useYard((s) => s.tfs) ?? [];
  const slips = useYard((s) => s.slips) ?? [];
  const ents = useYard((s) => s.ents) ?? [];
  const fieldItems = useYard((s) => s.fieldItems) ?? [];
  const employeeId = useYard((s) => s.employeeId);
  const [db, setDb] = useState<DbState | null>(null);
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void getSagLedelse({ data: { slug } })
      .then((res) => {
        if (!live) return;
        if (!res.ok) setDb({ tracked: false, items: [], replies: [], jobExtra: null });
        else {
          setDb({ tracked: res.tracked, items: res.items, replies: res.replies, jobExtra: res.jobExtra });
          if (res.replies.length) {
            const byTf = new Map<string, { id: string; text: string; at: string }[]>();
            for (const r of res.replies) {
              const list = byTf.get(r.tfId) ?? [];
              list.push({ id: r.id, text: r.text, at: r.at });
              byTf.set(r.tfId, list);
            }
            const tfs = useYard.getState().tfs;
            for (const tf of tfs) {
              const extra = byTf.get(tf.id);
              if (!extra?.length) continue;
              const have = new Set((tf.ledelseReplies ?? []).map((x) => x.id));
              const merged = [...(tf.ledelseReplies ?? [])];
              for (const r of extra) if (!have.has(r.id)) merged.push(r);
              if (merged.length !== (tf.ledelseReplies ?? []).length) {
                useYard.getState().patchReport("tf", tf.id, { ledelseReplies: merged, answered: true });
              }
            }
          }
        }
        setBusy(false);
      })
      .catch(() => {
        if (!live) return;
        setDb({ tracked: false, items: [], replies: [], jobExtra: null });
        setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [slug, tick]);

  const value = useMemo(() => {
    const bundled = bundledSagInputs();
    const allProjects: Project[] = mergeById(bundled.projects, projects);
    const projectId = projectIdFromSlug(slug, allProjects);
    const project = allProjects.find((p) => p.id === projectId);
    if (!project) return { site: null as SagSite | null, missing: !busy, busy };

    const hasLocal = Boolean(employeeId);
    const allTf: Tf[] = applyStatus(mergeById(bundled.tfs, tfs), "tf", db, hasLocal);
    const allAs: Slip[] = applyStatus(mergeById(bundled.slips, slips), "as", db, hasLocal);
    const allEr: Entrepreneur[] = applyStatus(mergeById(bundled.ents, ents), "er", db, hasLocal);
    const fields: FieldItem[] = mergeById(bundled.fieldItems, fieldItems);

    const repliesByTf = new Map<string, LedelseReply[]>();
    for (const r of db?.replies ?? []) {
      const list = repliesByTf.get(r.tfId) ?? [];
      list.push({ id: r.id, text: r.text, at: r.at });
      repliesByTf.set(r.tfId, list);
    }
    const tfsWithReplies = allTf.map((tf) => {
      const extra = repliesByTf.get(tf.id) ?? [];
      if (!extra.length) return tf;
      const have = new Set((tf.ledelseReplies ?? []).map((x) => x.id));
      const merged = [...(tf.ledelseReplies ?? [])];
      for (const r of extra) if (!have.has(r.id)) merged.push(r);
      return { ...tf, ledelseReplies: merged, answered: true };
    });

    const site = buildSagSite({
      project,
      tfs: tfsWithReplies,
      slips: allAs,
      ents: allEr,
      fieldItems: fields,
      jobExtra: db?.jobExtra ?? undefined,
    });
    return { site, missing: false, busy: busy && !site.tfs.length && !site.slips.length && !site.ents.length };
  }, [slug, projects, tfs, slips, ents, fieldItems, db, busy, employeeId]);

  return { ...value, reload: () => setTick((n) => n + 1) };
}

void isLedelseOn;
