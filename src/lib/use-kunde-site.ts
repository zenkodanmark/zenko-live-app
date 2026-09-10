import { useEffect, useMemo, useState } from "react";
import { getKundeSite } from "./ks-customer.functions";
import {
  buildKundeSite,
  bundledKundeInputs,
  isPublished,
  projectIdFromSlug,
  type KundeReportView,
  type KundeSite,
} from "./ks-customer";
import { rememberUdbudPlan } from "./udbud-plan";
import { pullEnts, pullTfs } from "./sb-live";
import { useYard } from "./store";
import { mergeReports } from "./yard-slim";
import { softrAsFieldItems } from "./softr-as";
import type { KsPhoto, KsReport, Project } from "./types";

function mergeById<T extends { id: string }>(base: T[], extra: T[]) {
  const map = new Map<string, T>();
  for (const row of base) map.set(row.id, row);
  for (const row of extra) map.set(row.id, { ...map.get(row.id), ...row });
  return [...map.values()];
}

export function useKundeSite(slug: string): { site: KundeSite | null; missing: boolean; busy: boolean } {
  const projects = useYard((s) => s.projects) ?? [];
  const ksReports = useYard((s) => s.ksReports) ?? [];
  const drivePhotos = useYard((s) => s.drivePhotos) ?? [];
  const tfs = useYard((s) => s.tfs) ?? [];
  const ents = useYard((s) => s.ents) ?? [];
  const fieldItems = useYard((s) => s.fieldItems) ?? [];
  const employeeId = useYard((s) => s.employeeId);
  const [db, setDb] = useState<{ tracked: boolean; publishedIds: string[]; snapshots: KundeReportView[] } | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    async function pullReports() {
      try {
        const [cloudTfs, cloudEnts] = await Promise.all([pullTfs(), pullEnts()]);
        if (!live) return;
        const s = useYard.getState();
        useYard.setState({
          tfs: cloudTfs ? mergeReports(s.tfs, cloudTfs) : s.tfs,
          ents: cloudEnts ? mergeReports(s.ents, cloudEnts) : s.ents,
        });
      } catch {
        /* guest page still works from bundled + store */
      }
    }
    void pullReports();
    return () => {
      live = false;
    };
  }, [slug]);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void getKundeSite({ data: { slug } })
      .then((res) => {
        if (!live) return;
        if (!res.ok) setDb({ tracked: false, publishedIds: [], snapshots: [] });
        else {
          if (res.plan && res.projectId) {
            rememberUdbudPlan({
              projectId: res.projectId,
              fileName: res.fileName ?? "",
              found: Boolean(res.fileName),
              parts: res.plan,
              meta: res.meta ?? { name: "", client: "", address: "", scope: "" },
              scannedAt: res.scannedAt ?? "",
            });
          }
          setDb({ tracked: res.tracked, publishedIds: res.publishedIds, snapshots: res.snapshots });
        }
        setBusy(false);
      })
      .catch(() => {
        if (!live) return;
        setDb({ tracked: false, publishedIds: [], snapshots: [] });
        setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  return useMemo(() => {
    const bundled = bundledKundeInputs();
    const allProjects: Project[] = mergeById(bundled.projects, projects);
    const projectId = projectIdFromSlug(slug, allProjects);
    const project = allProjects.find((p) => p.id === projectId);
    if (!project) return { site: null, missing: !busy, busy };

    const localForJob = ksReports.filter((r) => r.projectId === project.id);
    const hasLocal = Boolean(employeeId) && localForJob.length > 0;
    const reports: KsReport[] = mergeById(bundled.reports, ksReports);
    const photos: KsPhoto[] = mergeById(bundled.photos, drivePhotos);

    const bundledPublishedIds = bundled.reports.filter((r) => r.projectId === project.id && isPublished(r)).map((r) => r.id);
    const publishedIds = !hasLocal && db?.tracked ? [...new Set([...bundledPublishedIds, ...db.publishedIds])] : undefined;
    const site = buildKundeSite({
      project,
      reports,
      photos,
      publishedIds,
      tfs,
      ents,
      fieldItems: mergeById(softrAsFieldItems(), fieldItems),
    });

    if (db?.snapshots.length) {
      const have = new Set(site.reports.map((r) => r.id));
      for (const snap of db.snapshots) {
        if (!have.has(snap.id)) site.reports.push(snap);
      }
      const seen = new Set(site.parts.map((p) => p.code));
      for (const r of site.reports) {
        if (!seen.has(r.part.code)) {
          seen.add(r.part.code);
          site.parts.push(r.part);
        }
      }
      site.published = site.reports.length;
    }

    return { site, missing: false, busy: busy && !site.reports.length && !site.parts.length };
  }, [slug, projects, ksReports, drivePhotos, tfs, ents, fieldItems, db, busy, employeeId]);
}
