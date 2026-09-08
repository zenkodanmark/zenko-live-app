import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { unreadChatCount } from "@/lib/chat";
import { BoardPane } from "@/components/board-pane";
import { BottomNav } from "@/components/bottom-nav";
import { ChatPane, UnreadChatBanner } from "@/components/chat-messenger";
import { ClientOnly } from "@/components/client-only";
import { FolkPane } from "@/components/folk-pane";
import { LiveDriveBootstrap } from "@/components/live-bootstrap";
import { LogoutButton } from "@/components/logout-button";
import { OpenMaSheet } from "@/components/material-pane";
import { NoticeBell } from "@/components/notice-bell";
import { PushBanner } from "@/components/push-setup";
import { PlanPane } from "@/components/plan-pane";
import { LoginSplash, useYardReady } from "@/components/pin-login";
import { ReportsPane } from "@/components/reports-pane";
import { SagerPane } from "@/components/sager-pane";
import { ToastHost } from "@/components/toast-host";
import { VoiceFab } from "@/components/voice-fab";
import { Wordmark } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { isLoggedOut, pathForRole, readDeviceUser } from "@/lib/device-auth";
import { useDeepOpen } from "@/lib/open-deep";
import { acceptPin } from "@/lib/pin-enter";
import { isMasterRole } from "@/lib/seed";
import { todayLog, useSessionEmployee, useYard } from "@/lib/store";
import type { Lang } from "@/lib/types";

export const Route = createFileRoute("/mester")({
  validateSearch: (raw: Record<string, unknown>) => ({
    e: raw.e == null ? "" : String(raw.e),
    p: raw.p == null ? "" : String(raw.p),
  }),
  component: MesterPage,
});

type Tab = "board" | "sager" | "folk" | "reports" | "chat" | "plan";

function MesterPage() {
  return (
    <ClientOnly fallback={<LoginSplash />}>
      <MesterInner />
    </ClientOnly>
  );
}

function MesterInner() {
  const nav = useNavigate();
  const ready = useYardReady();
  const search = Route.useSearch();
  const emp = useSessionEmployee();
  const lang: Lang = useYard((s) => s.langOverride) ?? emp?.language ?? "da";
  const days = useYard((s) => s.days) ?? {};
  const projects = useYard((s) => s.projects) ?? [];
  const chats = useYard((s) => s.chats) ?? [];
  const assignments = useYard((s) => s.assignments) ?? [];
  const chatSeenAt = useYard((s) => s.chatSeenAt) ?? {};
  const threadSeenAt = useYard((s) => s.threadSeenAt) ?? {};
  const login = useYard((s) => s.login);
  const [tab, setTab] = useState<Tab>("board");
  useDeepOpen(setTab as (id: string) => void, true);
  const openChatWith = useYard((s) => s.openChatWith);
  useEffect(() => {
    if (openChatWith) setTab("chat");
  }, [openChatWith]);

  useEffect(() => {
    if (search.e && search.p) {
      const ok = acceptPin(search.e, search.p);
      if (ok) return;
      void nav({ to: "/", search: { e: search.e } });
      return;
    }
    if (search.e && !search.p) {
      void nav({ to: "/", search: { e: search.e } });
      return;
    }
    if (!ready) return;
    if (emp) {
      if (!isMasterRole(emp.role)) void nav({ to: "/svend" });
      return;
    }
    const who = isLoggedOut() ? null : readDeviceUser();
    if (who) {
      login(who.id);
      if (pathForRole(who.role) !== "/mester") void nav({ to: "/svend" });
      return;
    }
    const t = window.setTimeout(() => {
      if (!useYard.getState().employeeId) void nav({ to: "/" });
    }, 800);
    return () => window.clearTimeout(t);
  }, [ready, emp, nav, login, search.e, search.p]);

  if (!emp || !isMasterRole(emp.role)) return <LoginSplash />;

  const unread = unreadChatCount(chats, emp, assignments, chatSeenAt[emp.id], threadSeenAt);
  const pick = useYard.getState().projects.find((p) => p.status === "active")?.id ?? "job-hillerodsholm";
  const day = todayLog(emp.id, days);
  const onJob = day.checkInAt && !day.checkOutAt ? projects.find((p) => p.id === day.projectId) : null;

  const tabs = [
    { id: "board" as const, label: t(lang, "tabBoard"), icon: "tavle" as const },
    { id: "sager" as const, label: t(lang, "tabProjects"), icon: "sager" as const },
    { id: "folk" as const, label: t(lang, "tabPeople"), icon: "folk" as const },
    { id: "chat" as const, label: t(lang, "tabChat"), icon: "chat" as const, badge: unread },
    { id: "plan" as const, label: t(lang, "tabPlan"), icon: "plan" as const },
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
                if (n.kind === "ks") setTab("reports");
                else if (n.kind === "chat") setTab("chat");
                else if (n.kind === "ma") {
                  setTab("sager");
                  useYard.getState().setOpenMa(n.refId);
                } else setTab("board");
              }}
            />
            <LogoutButton lang={lang} className="shrink-0" link />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-sand/70">
            {emp.name} · {onJob ? onJob.name : t(lang, "masterDesk")}
          </p>
          <VoiceFab lang={lang} placement="header" />
        </div>
      </header>
      <div className="h-1.5 bg-brick" />
      {unread > 0 && tab !== "chat" ? (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <UnreadChatBanner lang={lang} count={unread} onOpen={() => setTab("chat")} />
        </div>
      ) : null}
      <PushBanner lang={lang} />
      <div className="mx-auto max-w-2xl px-4 py-4">
        {tab === "board" ? <BoardPane lang={lang} /> : null}
        {tab === "sager" ? <SagerPane lang={lang} masterId={emp.id} /> : null}
        {tab === "folk" ? <FolkPane lang={lang} /> : null}
        {tab === "reports" ? <ReportsPane lang={lang} /> : null}
        {tab === "chat" ? <ChatPane lang={lang} projectId={pick} /> : null}
        {tab === "plan" ? <PlanPane lang={lang} /> : null}
      </div>
      <BottomNav items={tabs} value={tab} onChange={(id) => setTab(id as Tab)} iconPx={56} roomy />
      <OpenMaSheet lang={lang} />
      <ToastHost />
      <LiveDriveBootstrap />
    </main>
  );
}
