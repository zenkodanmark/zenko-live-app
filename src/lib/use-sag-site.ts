import { useEffect, useMemo, useState } from "react";
import { getSagLedelse } from "./sag-ledelse.functions";
import { pullEnts, pullOffers, pullSlips, pullTfs } from "./sb-live";
import { pullTodos } from "./todo-live";
import {
  buildSagSite,
  bundledSagInputs,
  projectIdFromSlug,
  type SagJobMeta,
  type SagSite,
} from "./sag-ledelse";
import { softrKsPhotos, softrKsReports } from "./softr-ks";
import { defaultLedelseStatus } from "./sag-ledelse-defaults";
import { useYard } from "./store";
import type { Entrepreneur, FieldItem, KsPhoto, KsReport, LedelseReply, LedelseStatus, Offer, Project, Slip, Tf } from "./types";
import { mergeById, mergeReports, mergeSkippingHeld } from "./yard-slim";

type DbState = {
  tracked: boolean;
  items: { id: string; kind: string; status: string }[];
  replies: { id: string; tfId: string; text: string; at: string }[];
  jobExtra: Partial<SagJobMeta> | null;
};

function applyStatus<T extends { id: string; number: string; ledelseStatus?: LedelseStatus }>(
  rows: T[],
  kind: "tf" | "as" | "tb" | "er",
  db: DbState | null,
): T[] {
  const byId = new Map((db?.items ?? []).filter((i) => i.kind === kind).map((i) => [i.id, i.status]));
  return rows.map((r) => {
    if (r.ledelseStatus === "med_til_ledelse" || r.ledelseStatus === "skjult") return r;
    const dbStatus = byId.get(r.id);
    if (dbStatus === "med_til_ledelse" || dbStatus === "skjult") return { ...r, ledelseStatus: dbStatus };
    return { ...r, ledelseStatus: defaultLedelseStatus(kind, r.number) };
  });
}

export function useSagSite(slug: string): { site: SagSite | null; missing: boolean; busy: boolean; reload: () => void } {
  const projects = useYard((s) => s.projects) ?? [];
  const tfs = useYard((s) => s.tfs) ?? [];
  const slips = useYard((s) => s.slips) ?? [];
  const offers = useYard((s) => s.offers) ?? [];
  const ents = useYard((s) => s.ents) ?? [];
  const ksReports = useYard((s) => s.ksReports) ?? [];
  const drivePhotos = useYard((s) => s.drivePhotos) ?? [];
  const fieldItems = useYard((s) => s.fieldItems) ?? [];
  const [db, setDb] = useState<DbState | null>(null);
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    async function pullReports() {
      try {
        const [cloudTfs, cloudSlips, cloudEnts, cloudOffers, cloudTodos] = await Promise.all([
          pullTfs(),
          pullSlips(),
          pullEnts(),
          pullOffers(),
          pullTodos(),
        ]);
        if (!live) return;
        const s = useYard.getState();
        useYard.setState({
          tfs: cloudTfs ? mergeReports(s.tfs, cloudTfs) : s.tfs,
          slips: cloudSlips ? mergeReports(s.slips, cloudSlips) : s.slips,
          ents: cloudEnts ? mergeReports(s.ents, cloudEnts) : s.ents,
          offers: cloudOffers ? mergeReports(s.offers ?? [], cloudOffers) : s.offers ?? [],
          todos: cloudTodos ? mergeSkippingHeld(s.todos, cloudTodos) : s.todos,
        });
      } catch {
        /* guest page still works from bundled + store */
      }
    }
    void pullReports();
    const timer = setInterval(() => void pullReports(), 6000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [slug]);

  useEffect(() => {
    let live = true;
    setBusy(true);
    try {
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
              const current = useYard.getState().tfs;
              const next = current.map((tf) => {
                const extra = byTf.get(tf.id);
                if (!extra?.length) return tf;
                const have = new Set((tf.ledelseReplies ?? []).map((x) => x.id));
                const merged = [...(tf.ledelseReplies ?? [])];
                for (const r of extra) if (!have.has(r.id)) merged.push(r);
                if (merged.length === (tf.ledelseReplies ?? []).length) return tf;
                return { ...tf, ledelseReplies: merged, answered: true };
              });
              if (next.some((row, i) => row !== current[i])) useYard.setState({ tfs: next });
            }
          }
          setBusy(false);
        })
        .catch(() => {
          if (!live) return;
          setDb({ tracked: false, items: [], replies: [], jobExtra: null });
          setBusy(false);
        });
    } catch {
      setDb({ tracked: false, items: [], replies: [], jobExtra: null });
      setBusy(false);
    }
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

    const allTf: Tf[] = applyStatus(mergeById(bundled.tfs, tfs), "tf", db);
    const allAs: Slip[] = applyStatus(mergeById(bundled.slips, slips), "as", db);
    const allTb: Offer[] = applyStatus(offers as Offer[], "tb", db);
    const allEr: Entrepreneur[] = applyStatus(mergeById(bundled.ents, ents), "er", db);
    const allKs: KsReport[] = mergeById(softrKsReports(), ksReports);
    const ksPhotos: KsPhoto[] = mergeById(softrKsPhotos(), drivePhotos);
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
      tbs: allTb,
      ents: allEr,
      kss: allKs,
      ksPhotos,
      fieldItems: fields,
      jobExtra: db?.jobExtra ?? undefined,
    });
    return { site, missing: false, busy: busy && !site.tfs.length && !site.slips.length && !site.ents.length && !site.kss.length };
  }, [slug, projects, tfs, slips, offers, ents, ksReports, drivePhotos, fieldItems, db, busy]);

  return { ...value, reload: () => setTick((n) => n + 1) };
}
