import { useEffect, useState } from "react";
import { ActionPng } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { readGps, siteFallback } from "@/lib/geo";
import { todayLog, useSessionEmployee, useYard } from "@/lib/store";
import type { Lang } from "@/lib/types";

export function MasterOnSiteBar({ lang, projectId }: { lang: Lang; projectId?: string }) {
  const emp = useSessionEmployee();
  const projects = useYard((s) => s.projects);
  const days = useYard((s) => s.days);
  const checkIn = useYard((s) => s.checkIn);
  const checkOut = useYard((s) => s.checkOut);
  const openPick = useYard((s) => s.openOnSitePick);
  const setOpenPick = useYard((s) => s.setOpenOnSitePick);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const day = emp ? todayLog(emp.id, days) : null;
  const onSite = Boolean(day?.checkInAt && !day?.checkOutAt && day.projectId);
  const activeJob = onSite ? projects.find((p) => p.id === day?.projectId) : null;
  const jobs = projects.filter((p) => p.status === "active");

  useEffect(() => {
    if (!openPick) return;
    setPicking(true);
    setOpenPick(false);
  }, [openPick, setOpenPick]);

  async function arrive(id: string) {
    if (!emp || busy) return;
    const job = projects.find((p) => p.id === id);
    if (!job) return;
    setBusy(true);
    const gps = await readGps(8000);
    const fix = gps ?? siteFallback(job);
    checkIn(emp.id, job.id, fix, !gps);
    setPicking(false);
    setBusy(false);
  }

  async function leave() {
    if (!emp || busy || !onSite) return;
    const job = activeJob ?? jobs[0];
    if (!job) return;
    setBusy(true);
    const gps = (await readGps(6000)) ?? siteFallback(job);
    checkOut(emp.id, gps);
    setPicking(false);
    setBusy(false);
  }

  function onPlads() {
    if (projectId) {
      void arrive(projectId);
      return;
    }
    if (jobs.length === 1 && jobs[0]) {
      void arrive(jobs[0].id);
      return;
    }
    setPicking((v) => !v);
  }

  if (!emp) return null;

  return (
    <div data-testid="master-on-site-bar">
      <div className="flex items-start justify-center gap-10">
        <button
          type="button"
          data-testid="master-on-site"
          disabled={busy}
          onClick={onPlads}
          className="inline-flex min-h-[52px] min-w-[52px] flex-col items-center gap-1 disabled:opacity-50"
        >
          <ActionPng name="onSite" px={152} />
          <span className="text-sm font-semibold text-navy">{t(lang, "onSiteHere")}</span>
        </button>
        <button
          type="button"
          data-testid="master-gone"
          disabled={busy || !onSite}
          onClick={() => void leave()}
          className="inline-flex min-h-[52px] min-w-[52px] flex-col items-center gap-1 disabled:opacity-50"
        >
          <ActionPng name="dayEnd" px={152} />
          <span className="text-sm font-semibold text-navy">{t(lang, "onSiteGone")}</span>
        </button>
      </div>
      {activeJob ? (
        <p className="mt-1 text-center text-sm text-muted" data-testid="master-on-site-job">
          {activeJob.name}
        </p>
      ) : null}
      {picking && !projectId ? (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {jobs.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`master-on-site-chip-${p.id}`}
              onClick={() => void arrive(p.id)}
              className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-medium ${
                activeJob?.id === p.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
