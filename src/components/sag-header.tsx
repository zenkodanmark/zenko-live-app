import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { FacePhoto } from "@/components/face-photo";
import { MasterOnSiteBar } from "@/components/master-on-site";
import { GhostButton, PrimaryButton } from "@/components/zenko";
import { CloseX } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { fiveYearDate, fmtDaDate, handoverDate, oneYearDate, reviewUrgency } from "@/lib/job-archive";
import { isMasterRole } from "@/lib/seed";
import { todayLog, useSessionEmployee, useYard } from "@/lib/store";
import type { Lang, Project, ReopenReason } from "@/lib/types";

export function SagHeader({
  project,
  lang,
  onFolders,
  onArchive,
  onReopen,
}: {
  project: Project;
  lang: Lang;
  onFolders?: () => void;
  onArchive?: (archived: boolean) => void;
  onReopen?: (reason: ReopenReason) => void;
}) {
  const [why, setWhy] = useState(false);
  const status = statusLine(project, lang);
  const handed = handoverDate(project);
  const one = oneYearDate(project);
  const five = fiveYearDate(project);
  return (
    <div className="rounded-[20px] bg-paper px-4 py-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-3xl leading-tight text-navy">{project.name}</p>
          {project.address ? <p className="mt-0.5 truncate text-base text-muted">{project.address}</p> : null}
          <JobCrewFaces projectId={project.id} />
          <MasterOnSiteSlot lang={lang} projectId={project.id} />
          <p className="mt-1 text-sm text-muted">{status}</p>
          {project.status === "archived" && one && five ? (
            <p className="mt-1 text-xs text-muted">{t(lang, "yearReviews", { one: fmtDaDate(one), five: fmtDaDate(five) })}</p>
          ) : null}
          {project.status === "archived" ? <DueChips lang={lang} one={one} five={five} /> : null}
        </div>
        {onArchive || onReopen ? (
          project.status === "active" ? (
            <GhostButton className="min-h-11 shrink-0 rounded-full bg-sand px-3 text-sm" onClick={() => onArchive?.(true)}>
              <Archive className="mr-1 size-3.5" />
              {t(lang, "archiveJob")}
            </GhostButton>
          ) : (
            <GhostButton className="min-h-11 shrink-0 rounded-full bg-sand px-3 text-sm" onClick={() => setWhy(true)}>
              <RotateCcw className="mr-1 size-3.5" />
              {t(lang, "reopenJob")}
            </GhostButton>
          )
        ) : null}
      </div>
      {handed && project.status === "active" && project.reopenReason ? (
        <p className="mt-2 text-xs text-muted">{t(lang, "handedOver", { date: fmtDaDate(handed) })}</p>
      ) : null}
      {onFolders ? (
        <GhostButton className="mt-2 bg-sand" onClick={onFolders}>
          {t(lang, "sagFolders")}
        </GhostButton>
      ) : null}
      {why ? (
        <ReopenPicker
          lang={lang}
          onClose={() => setWhy(false)}
          onPick={(reason) => {
            setWhy(false);
            onReopen?.(reason);
          }}
        />
      ) : null}
    </div>
  );
}

export function ReopenPicker({
  lang,
  onPick,
  onClose,
}: {
  lang: Lang;
  onPick: (reason: ReopenReason) => void;
  onClose: () => void;
}) {
  const options: { id: ReopenReason; label: string }[] = [
    { id: "mangler", label: t(lang, "reopenMangler") },
    { id: "1aar", label: t(lang, "reopen1y") },
    { id: "5aar", label: t(lang, "reopen5y") },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/40 px-4">
      <div className="relative w-full max-w-md rounded-[20px] bg-paper p-4 shadow-card">
        <div className="mb-2 flex items-start gap-2">
          <p className="font-display text-title text-ink">{t(lang, "reopenWhy")}</p>
          <CloseX onClick={onClose} label={t(lang, "close")} />
        </div>
        <p className="mt-1 text-sm text-muted">{t(lang, "reopenHint")}</p>
        <div className="mt-3 grid gap-2">
          {options.map((o) => (
            <PrimaryButton key={o.id} tone="navy" onClick={() => onPick(o.id)}>
              {o.label}
            </PrimaryButton>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DueChips({ lang, one, five }: { lang: Lang; one: string | null; five: string | null }) {
  const u1 = reviewUrgency(one);
  const u5 = reviewUrgency(five);
  if (u1 !== "now" && u1 !== "soon" && u5 !== "now" && u5 !== "soon") return null;
  return (
    <p className="mt-2 flex flex-wrap gap-1.5">
      {u1 === "now" || u1 === "soon" ? (
        <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium ${u1 === "now" ? "bg-brick text-sand" : "bg-sand text-navy"}`}>
          {t(lang, "year1Due", { date: one ? fmtDaDate(one) : "" })} · {t(lang, u1 === "now" ? "dueNow" : "dueSoon")}
        </span>
      ) : null}
      {u5 === "now" || u5 === "soon" ? (
        <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium ${u5 === "now" ? "bg-brick text-sand" : "bg-sand text-navy"}`}>
          {t(lang, "year5Due", { date: five ? fmtDaDate(five) : "" })} · {t(lang, u5 === "now" ? "dueNow" : "dueSoon")}
        </span>
      ) : null}
    </p>
  );
}

function MasterOnSiteSlot({ lang, projectId }: { lang: Lang; projectId: string }) {
  const emp = useSessionEmployee();
  if (!emp || !isMasterRole(emp.role)) return null;
  return (
    <div className="mt-2">
      <MasterOnSiteBar lang={lang} projectId={projectId} />
    </div>
  );
}

function statusLine(project: Project, lang: Lang) {
  if (project.status === "archived") {
    const h = handoverDate(project);
    return h ? `${t(lang, "jobStatusArchived")} · ${t(lang, "handedOver", { date: fmtDaDate(h) })}` : t(lang, "jobStatusArchived");
  }
  if (project.reopenReason === "mangler") return t(lang, "jobStatusMangler");
  if (project.reopenReason === "1aar") return t(lang, "jobStatus1y");
  if (project.reopenReason === "5aar") return t(lang, "jobStatus5y");
  return [t(lang, "jobStatusActive"), project.trade].filter((x) => x && String(x).trim()).join(" · ");
}

export function JobCrewFaces({ projectId }: { projectId: string }) {
  const employees = useYard((s) => s.employees);
  const days = useYard((s) => s.days);
  const setOpenChatWith = useYard((s) => s.setOpenChatWith);
  const me = useSessionEmployee();
  const crew = employees
    .filter((e) => {
      const d = todayLog(e.id, days);
      return Boolean(d.checkInAt && !d.checkOutAt && d.projectId === projectId);
    })
    .sort((a, b) => {
      const rank = (id: string) => (id === "emp-ole" ? 0 : id === "emp-federico" ? 1 : 100);
      const ra = rank(a.id);
      const rb = rank(b.id);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "da");
    });
  if (!crew.length) return null;
  const meId = me?.id;
  let shown = crew.slice(0, 5);
  const extra = Math.max(0, crew.length - 5);
  if (meId && extra > 0 && !shown.some((e) => e.id === meId)) {
    const self = crew.find((e) => e.id === meId);
    if (self) shown = [...shown.slice(0, 4), self];
  }
  return (
    <ul className="mt-2 flex flex-wrap items-start gap-2" data-testid="job-crew">
      {shown.map((e) => {
        const self = e.id === meId;
        const fore = e.name.trim().split(/\s+/)[0] || e.name;
        const face = (
          <>
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: 42,
                height: 42,
                border: self ? "3px solid #c45c3e" : "3px solid transparent",
              }}
            >
              <FacePhoto employee={e} px={36} />
            </span>
            <span className="max-w-[3.5rem] truncate text-center text-[12px] font-medium leading-tight text-ink">{fore}</span>
          </>
        );
        if (self) {
          return (
            <li key={e.id} className="flex w-[42px] flex-col items-center gap-0.5" data-testid={`job-crew-${e.id}`}>
              {face}
            </li>
          );
        }
        return (
          <li key={e.id}>
            <button
              type="button"
              aria-label={e.name}
              data-testid={`job-crew-${e.id}`}
              onClick={() => setOpenChatWith(e.id)}
              className="flex w-[42px] flex-col items-center gap-0.5"
            >
              {face}
            </button>
          </li>
        );
      })}
      {extra > 0 ? (
        <li
          className="inline-flex items-center justify-center rounded-full bg-sand text-sm font-semibold text-navy"
          style={{ width: 42, height: 42 }}
          data-testid="job-crew-more"
        >
          +{extra}
        </li>
      ) : null}
    </ul>
  );
}
