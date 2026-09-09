import { useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ChatPane, UnreadChatBanner } from "@/components/chat-messenger";
import { ClientOnly } from "@/components/client-only";
import { CreateJobForm } from "@/components/create-job";
import { CrewSagBot } from "@/components/crew-sag-bot";
import { CrewTodos } from "@/components/crew-todos";
import { saveFieldFiles } from "@/components/field-drop";
import { MePane } from "@/components/me-pane";
import { NoticeBell } from "@/components/notice-bell";
import { PushBanner } from "@/components/push-setup";
import { LoginSplash } from "@/components/pin-login";
import { useYardReady } from "@/lib/use-yard-ready";
import { DrivePhoto } from "@/components/drive-photo";
import { KsCompose } from "@/components/ks-compose";
import { ToastHost } from "@/components/toast-host";
import { VoiceFab } from "@/components/voice-fab";
import { FacePhoto } from "@/components/face-photo";
import { JobCrewFaces } from "@/components/sag-header";
import { Card, GhostButton, Wordmark } from "@/components/zenko";
import { ActionPng, PlusRound, TabPng } from "@/components/sag-icons";
import { transcribeClip } from "@/lib/ai.functions";
import { t } from "@/lib/i18n";
import { readGps, siteFallback } from "@/lib/geo";
import { isOnSite } from "@/lib/on-site";
import { LogoutButton } from "@/components/logout-button";
import { useDeepOpen } from "@/lib/open-deep";
import { acceptPin } from "@/lib/pin-enter";
import { isLoggedOut, pathForRole, readDeviceUser } from "@/lib/device-auth";
import { setCrewSag } from "@/lib/crew-sag";
import { unreadChatCount } from "@/lib/chat";
import { copenhagenDate, copenhagenTime, findControlPoint, isMasterRole } from "@/lib/seed";
import { activeAssigned, todayLog, useSessionEmployee, useYard } from "@/lib/store";
import type { Employee, GpsFix, KsPhoto, KsReport, Lang, Project } from "@/lib/types";
import { browserListen, startRecording } from "@/lib/voice-client";

const CrewSagHome = lazy(() => import("@/components/crew-sag-home").then((m) => ({ default: m.CrewSagHome })));
const LiveDriveBootstrap = lazy(() => import("@/components/live-bootstrap").then((m) => ({ default: m.LiveDriveBootstrap })));
const CrewKsPrint = lazy(async () => {
  const { KsDoc, PrintChrome } = await import("@/components/print-docs");
  return {
    default: function CrewKsPrintView({
      report,
      photos,
      onClose,
    }: {
      report: KsReport;
      photos: KsPhoto[];
      onClose: () => void;
    }) {
      return (
        <PrintChrome docId={report.id} onClose={onClose} kind="ks">
          <KsDoc report={report} photos={photos} />
        </PrintChrome>
      );
    },
  };
});

type Tab = "today" | "case" | "ks" | "chat" | "me";

export function SvendDesk() {
  const nav = useNavigate();
  const ready = useYardReady();
  const search = useSearch({ strict: false }) as { e?: string; p?: string };
  const emp = useSessionEmployee();
  const lang: Lang = useYard((s) => s.langOverride) ?? emp?.language ?? "da";
  const days = useYard((s) => s.days) ?? {};
  const projects = useYard((s) => s.projects) ?? [];
  const assignments = useYard((s) => s.assignments) ?? [];
  const chats = useYard((s) => s.chats) ?? [];
  const chatSeenAt = useYard((s) => s.chatSeenAt) ?? {};
  const threadSeenAt = useYard((s) => s.threadSeenAt) ?? {};
  const markChatSeen = useYard((s) => s.markChatSeen);
  const login = useYard((s) => s.login);
  const [tab, setTab] = useState<Tab>("today");
  useDeepOpen(setTab as (id: string) => void, false);
  const openChatWith = useYard((s) => s.openChatWith);
  const chatJob = useYard((s) => s.openChatJobId);
  useEffect(() => {
    if (openChatWith) setTab("chat");
  }, [openChatWith]);
  const day = emp ? todayLog(emp.id, days) : null;
  const jobs = emp ? activeAssigned(emp.id, emp.role, projects, assignments) : [];

  useEffect(() => {
    if (search.e && search.p) {
      const ok = acceptPin(search.e, search.p);
      if (ok) {
        login(ok.id);
        void nav({ to: "/svend", replace: true });
        return;
      }
    }
    if (!ready) return;
    if (emp) {
      if (isMasterRole(emp.role)) return;
      return;
    }
    const who = isLoggedOut() ? null : readDeviceUser();
    if (who) {
      login(who.id);
      if (pathForRole(who.role) === "/mester") void nav({ to: "/mester" });
      return;
    }
    void nav({ to: "/" });
  }, [ready, emp, nav, login, search.e, search.p]);

  useEffect(() => {
    if (tab === "chat" && emp) markChatSeen(emp.id);
  }, [tab, emp, markChatSeen, chats.length]);

  if (!emp || !day) return <LoginSplash />;

  const unread = unreadChatCount(chats, emp, assignments, chatSeenAt[emp.id], threadSeenAt);
  const pick = chatJob || day.projectId || jobs[0]?.id || "job-hillerodsholm";
  const tabs = [
    { id: "today" as const, label: t(lang, "tabToday"), icon: "idag" as const },
    { id: "case" as const, label: t(lang, "tabCase"), icon: "sager" as const },
    { id: "chat" as const, label: t(lang, "tabChat"), icon: "chat" as const, badge: unread },
    { id: "me" as const, label: t(lang, "tabMe"), icon: "mig" as const },
  ];

  return (
    <main className="min-h-dvh bg-sand pb-32">
      <header className="relative overflow-visible bg-navy px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sand">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Wordmark light />
          <div className="flex shrink-0 items-center gap-1">
            <NoticeBell
              lang={lang}
              onOpen={(n) => {
                if (n.kind === "ks") setTab("case");
                else if (n.kind === "chat") setTab("chat");
                else setTab("today");
              }}
            />
            {isMasterRole(emp.role) ? (
              <GhostButton className="text-sand" onClick={() => void nav({ to: "/mester" })}>
                {t(lang, "masterDesk")}
              </GhostButton>
            ) : null}
            <LogoutButton lang={lang} className="shrink-0" link />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <FacePhoto employee={emp} px={40} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold">{emp.name}</p>
            <p className="text-xs text-sand/70">
              {day.checkInAt ? t(lang, "onSiteSince") + " " + copenhagenTime(day.checkInAt) : t(lang, "notCheckedIn")}
            </p>
          </div>
          {tab === "today" ? <VoiceFab lang={lang} placement="header" /> : null}
        </div>
      </header>
      <div className="h-1.5 bg-brick" />
      {unread > 0 && tab !== "chat" ? (
        <div className="mx-auto max-w-lg px-4 pt-3">
          <UnreadChatBanner lang={lang} count={unread} onOpen={() => setTab("chat")} />
        </div>
      ) : null}
      <PushBanner lang={lang} />
      <div className="mx-auto max-w-lg px-4 py-4">
        {tab === "today" ? <TodayTab lang={lang} /> : null}
        {tab === "case" ? <CaseTab lang={lang} jobs={jobs} /> : null}
        {tab === "ks" ? <KsTab lang={lang} /> : null}
        {tab === "chat" ? <ChatPane lang={lang} projectId={pick} /> : null}
        {tab === "me" ? <MePane lang={lang} /> : null}
      </div>
      <BottomNav items={tabs} value={tab} onChange={(id) => setTab(id as Tab)} iconPx={56} roomy />
      <ToastHost />
      <Suspense fallback={null}>
        <LiveDriveBootstrap />
      </Suspense>
    </main>
  );
}

function TodayTab({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee()!;
  const days = useYard((s) => s.days);
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const fieldItems = useYard((s) => s.fieldItems) ?? [];
  const checkIn = useYard((s) => s.checkIn);
  const checkOut = useYard((s) => s.checkOut);
  const setDayNote = useYard((s) => s.setDayNote);
  const addPing = useYard((s) => s.addPing);
  const day = todayLog(emp.id, days);
  const jobs = activeAssigned(emp.id, emp.role, projects, assignments);
  const onSite = isOnSite(day);
  const job = onSite ? projects.find((p) => p.id === day.projectId) : undefined;
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState(day.workNote ?? "");
  const [rec, setRec] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);

  const tripMedia = fieldItems.filter(
    (f) =>
      f.employeeId === emp.id &&
      f.projectId === day.projectId &&
      (f.kind === "photo" || f.kind === "video") &&
      day.checkInAt &&
      f.takenAt >= day.checkInAt &&
      (!day.checkOutAt || f.takenAt <= day.checkOutAt),
  );

  useEffect(() => {
    setNote(day.workNote ?? "");
  }, [day.workNote, emp.id]);

  useEffect(() => {
    if (!onSite) return;
    const tmr = window.setInterval(() => {
      void readGps(4000).then((fix) => {
        if (fix) addPing(emp.id, fix);
      });
    }, 180000);
    return () => window.clearInterval(tmr);
  }, [addPing, onSite, emp.id]);

  async function arrive(projectId: string) {
    const chosen = jobs.find((p) => p.id === projectId) ?? jobs[0];
    if (!chosen) {
      useYard.setState({ toast: t(lang, "noAssigned") });
      return;
    }
    setBusy(true);
    setPicking(false);
    const gps = await readGps(8000);
    const fix: GpsFix = gps ?? siteFallback(chosen);
    checkIn(emp.id, chosen.id, fix, !gps);
    setBusy(false);
  }

  function tapOnSite() {
    if (busy) return;
    if (jobs.length === 0) {
      useYard.setState({ toast: t(lang, "noAssigned") });
      return;
    }
    if (jobs.length === 1) void arrive(jobs[0]!.id);
    else setPicking(true);
  }

  async function tapEnd() {
    if (!onSite || busy) return;
    if (tripMedia.length === 0) {
      camRef.current?.click();
      return;
    }
    setBusy(true);
    const gps = (await readGps(6000)) ?? (job ? siteFallback(job) : null);
    if (gps) checkOut(emp.id, gps);
    setBusy(false);
  }

  function needJob() {
    useYard.setState({ toast: t(lang, "pickSite") });
    tapOnSite();
  }

  async function addMedia(files: File[]) {
    if (!job) return needJob();
    if (!files.length) return;
    setBusy(true);
    await saveFieldFiles({ files, kind: "photo", lang, emp, job });
    setBusy(false);
  }

  async function tapMic() {
    if (busy) return;
    if (!onSite) return needJob();
    if (rec && recRef.current) {
      setRec(false);
      setBusy(true);
      try {
        const clip = await recRef.current.stop();
        recRef.current = null;
        const stt = await transcribeClip({ data: { audioBase64: clip.base64, mime: clip.mime, language: lang } });
        const spoken = stt.ok ? stt.text : (await browserListen(lang)) || "";
        if (spoken) setNote((n) => (n ? `${n} ${spoken}` : spoken));
      } catch {
        recRef.current = null;
      }
      setBusy(false);
      return;
    }
    try {
      recRef.current = await startRecording();
      setRec(true);
    } catch {
      const spoken = await browserListen(lang);
      if (spoken) setNote((n) => (n ? `${n} ${spoken}` : spoken));
    }
  }

  function tapSend() {
    const text = note.trim();
    if (!text) return;
    if (!onSite) return needJob();
    setDayNote(emp.id, text);
    useYard.setState({ toast: t(lang, "dayNoteSaved") });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[20px]" data-testid="today-card">
        <div className="flex items-start justify-center gap-10">
          <button type="button" className={`inline-flex min-h-[3.25rem] min-w-[3.25rem] flex-col items-center gap-2 ${onSite ? "rounded-2xl p-1 ring-[3px] ring-brick" : ""}`} aria-label={t(lang, "onSiteHere")} data-testid="today-onsite" data-onsite={onSite ? "1" : "0"} disabled={busy} onClick={tapOnSite}>
            <ActionPng name="onSite" px={152} />
            <span className="text-center text-base font-semibold uppercase tracking-wide text-navy">{t(lang, "onSiteHere")}</span>
          </button>
          <button type="button" className="inline-flex min-h-[3.25rem] min-w-[3.25rem] flex-col items-center gap-2" aria-label={t(lang, "dayEnd")} data-testid="today-end" disabled={busy} onClick={() => void tapEnd()}>
            <ActionPng name="dayEnd" px={152} />
            <span className="text-center text-base font-semibold uppercase tracking-wide text-navy">{t(lang, "dayEnd")}</span>
          </button>
        </div>
        {onSite && job && day.checkInAt ? (
          <p className="mt-3 text-center text-base text-ink" data-testid="today-status">
            {job.name} · {t(lang, "onSiteSince")} {copenhagenTime(day.checkInAt)}
          </p>
        ) : null}
        <p className="mt-6 text-base font-semibold text-navy">{t(lang, "dayPhotos")}</p>
        <div className="mt-3 flex items-center justify-center gap-8">
          <button
            type="button"
            aria-label={t(lang, "fieldPhoto")}
            data-testid="today-foto"
            className="inline-flex min-h-[3.25rem] min-w-[3.25rem] items-center justify-center"
            disabled={busy}
            onClick={() => {
              if (!onSite) return needJob();
              camRef.current?.click();
            }}
          >
            <ActionPng name="camCompact" px={96} />
          </button>
          <button
            type="button"
            aria-label={t(lang, "gallery")}
            data-testid="today-gallery"
            className="inline-flex min-h-[3.25rem] min-w-[3.25rem] items-center justify-center"
            disabled={busy}
            onClick={() => {
              if (!onSite) return needJob();
              galRef.current?.click();
            }}
          >
            <ActionPng name="gallery" px={96} />
          </button>
        </div>
        <div className="mt-4 flex items-stretch gap-2">
          <textarea
            className="min-h-[7.5rem] flex-1 rounded-[20px] bg-sand px-3 py-3 text-lg outline-none"
            style={{ border: "2px solid #1c2428" }}
            placeholder={t(lang, "dayNotePh")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="today-note"
          />
          <div className="flex flex-col justify-between gap-2">
            <button type="button" aria-label={t(lang, "fieldSpeak")} data-testid="today-mic" className={`inline-flex min-h-[3.25rem] min-w-[3.25rem] items-center justify-center ${rec ? "rounded-xl ring-2 ring-brick" : ""}`} onClick={() => void tapMic()}>
              <ActionPng name="mic" px={72} />
            </button>
            <button type="button" aria-label={t(lang, "chatSend")} data-testid="today-send" className="inline-flex min-h-[3.25rem] min-w-[3.25rem] items-center justify-center" disabled={busy} onClick={tapSend}>
              <ActionPng name="send" px={72} />
            </button>
          </div>
        </div>
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            void addMedia([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={galRef}
          type="file"
          accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => {
            void addMedia([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </Card>
      <CrewTodos lang={lang} />
      {picking ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/50 p-4 sm:items-center" role="dialog" data-testid="today-pick-job">
          <div className="w-full max-w-sm rounded-[20px] bg-paper px-4 py-5 shadow-card">
            <p className="font-display text-xl text-navy">{t(lang, "pickSite")}</p>
            <div className="mt-3 space-y-1.5">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  data-testid={`today-pick-${j.id}`}
                  onClick={() => void arrive(j.id)}
                  className="flex min-h-12 w-full items-center rounded-xl bg-sand px-3 text-left text-sm"
                >
                  <span>
                    {j.name}
                    {j.address ? <span className="mt-0.5 block text-xs text-muted">{j.address}</span> : null}
                  </span>
                </button>
              ))}
            </div>
            <GhostButton className="mt-3 w-full bg-sand" onClick={() => setPicking(false)}>
              {t(lang, "cancel")}
            </GhostButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CaseTab({ lang, jobs }: { lang: Lang; jobs: Project[] }) {
  const emp = useSessionEmployee()!;
  const days = useYard((s) => s.days);
  const day = todayLog(emp.id, days);
  const [pick, setPick] = useState(jobs.find((j) => j.id === "job-hillerodsholm")?.id || day.projectId || jobs[0]?.id || "");
  const [creating, setCreating] = useState(false);
  const job = jobs.find((j) => j.id === pick) ?? jobs[0];
  useEffect(() => {
    if (job?.id) setCrewSag(job.id);
  }, [job?.id]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2" data-testid="sager-title">
          <TabPng name="sager" px={80} />
          <span className="text-xl font-semibold text-navy">{t(lang, "sagerTitle")}</span>
        </div>
        <button type="button" aria-label={t(lang, "newJob")} data-testid="sager-new" className="inline-flex min-h-[3.25rem] min-w-[3.25rem] shrink-0 items-center justify-center" onClick={() => setCreating((v) => !v)}>
          <ActionPng name="sagerPlus" px={64} />
        </button>
      </div>
      {creating ? (
        <CreateJobForm
          simple
          lang={lang}
          createdBy={emp.id}
          onDone={(id) => {
            setCreating(false);
            setPick(id);
          }}
        />
      ) : null}
      {jobs.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setPick(j.id)}
              className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-medium ${j.id === job?.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
            >
              {j.name}
            </button>
          ))}
        </div>
      ) : null}
      {job ? (
        <>
          <Card className="rounded-[20px]">
            <p className="font-display text-3xl text-navy">{job.name}</p>
            <p className="text-base text-muted">{job.address}</p>
            <JobCrewFaces projectId={job.id} />
            <p className="mt-2 text-xs leading-relaxed text-muted">{t(lang, "crewSagOnly")}</p>
          </Card>
          <Suspense fallback={null}>
            <CrewSagHome project={job} lang={lang} />
          </Suspense>
          <CrewSagBot project={job} lang={lang} />
        </>
      ) : (
        <Card>
          <p className="text-sm">{t(lang, "noAssigned")}</p>
        </Card>
      )}
    </div>
  );
}

function KsTab({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee()!;
  const days = useYard((s) => s.days);
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const ksReports = useYard((s) => s.ksReports);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const day = todayLog(emp.id, days);
  const jobs = activeAssigned(emp.id, emp.role, projects, assignments);
  const [jobId, setJobId] = useState(day.projectId || jobs[0]?.id || jobs[0]?.id || "");
  const [compose, setCompose] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const photos = ksPhotoPool(days, drivePhotos);
  const reports = mineKs(ksReports, emp);
  const job = projects.find((p) => p.id === jobId) ?? jobs[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TabPng name="ks" px={64} />
          <span className="text-sm font-semibold text-navy">{t(lang, "tabKs")}</span>
        </div>
        {job ? <PlusRound label={t(lang, "ksComposeTitle")} testId="ks-new" onClick={() => setCompose(true)} /> : null}
      </div>
      {jobs.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJobId(j.id)}
              className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${j.id === job?.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
            >
              {j.name}
            </button>
          ))}
        </div>
      ) : null}
      <MyKsList lang={lang} emp={emp} title={t(lang, "myKsReports")} reports={reports} photos={photos} onOpen={setViewId} />
      {compose && job ? (
        <KsCompose
          projectId={job.id}
          lang={lang}
          onClose={() => setCompose(false)}
          onCreated={(id) => {
            setCompose(false);
            setViewId(id);
          }}
        />
      ) : null}
      {viewId ? <CrewKsView id={viewId} reports={ksReports} photos={photos} onClose={() => setViewId(null)} /> : null}
    </div>
  );
}

function mineKs(reports: KsReport[], emp: Employee) {
  return reports.filter((r) => {
    if (r.trashedAt) return false;
    if (r.employeeName === emp.name) return true;
    if (r.crew?.split(/[,&/]/).some((n) => n.trim() === emp.name)) return true;
    return false;
  });
}

function ksPhotoPool(days: Record<string, { photos: KsPhoto[] }>, drivePhotos: KsPhoto[]) {
  return [...Object.values(days).flatMap((d) => d.photos), ...drivePhotos];
}

function MyKsList({
  lang,
  emp,
  title,
  reports,
  photos,
  onOpen,
}: {
  lang: Lang;
  emp: Employee;
  title: string;
  reports: KsReport[];
  photos: KsPhoto[];
  onOpen: (id: string) => void;
}) {
  const mine = mineKs(reports, emp);
  if (!mine.length) {
    return (
      <Card className="rounded-[20px]">
        <p className="text-sm font-semibold text-navy">{title}</p>
        <p className="mt-1 text-sm text-muted">{t(lang, "noKsYet")}</p>
      </Card>
    );
  }
  return (
    <Card className="rounded-[20px]">
      <p className="text-sm font-semibold text-navy">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {mine.map((row) => {
          const live = row;
          const thumb = photos.find((p) => live.photoIds?.includes(p.id) || live.photoIds?.includes(p.driveFileId ?? ""));
          return (
            <li key={row.id}>
              <button type="button" className="flex w-full items-center gap-3 rounded-xl bg-sand px-3 py-2.5 text-left" onClick={() => onOpen(row.id)}>
                {thumb ? (
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper">
                    <DrivePhoto photo={thumb} className="h-12 w-12 object-cover" />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper text-xs text-muted">{live.photoIds?.length || "—"}</span>
                )}
                <span className="min-w-0">
                  <span className="font-medium">Nr. {live.number}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {live.point} {findControlPoint(live.point, live.projectId)?.title ?? ""}
                    {live.photoIds?.length ? ` · ${live.photoIds.length} foto` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CrewKsView({ id, reports, photos, onClose }: { id: string; reports: KsReport[]; photos: KsPhoto[]; onClose: () => void }) {
  const row = reports.find((r) => r.id === id);
  if (!row) return null;
  return (
    <Suspense fallback={null}>
      <CrewKsPrint report={row} photos={photos} onClose={onClose} />
    </Suspense>
  );
}
