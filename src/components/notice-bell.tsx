import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { BackArrow } from "@/components/sag-icons";
import { GhostButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { flashBrowser, noticesFor, noticesFromDiff, unreadNotices } from "@/lib/notify";
import { copenhagenTime } from "@/lib/seed";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { Lang, Notice } from "@/lib/types";

export function NotifyBridge() {
  useEffect(() => {
    const since = new Date(Date.now() - 2000).toISOString();
    let prev = useYard.getState();
    return useYard.subscribe((state) => {
      const p = prev;
      prev = state;
      if (state.ksReports === p.ksReports && state.chats === p.chats && state.todos === p.todos) return;
      const rows = noticesFromDiff(
        { ksReports: p.ksReports, chats: p.chats, todos: p.todos, employees: p.employees, assignments: p.assignments },
        { ksReports: state.ksReports, chats: state.chats, todos: state.todos, employees: state.employees, assignments: state.assignments },
        since,
      );
      const me = state.employeeId;
      for (const row of rows) {
        useYard.getState().pushNotice(row);
        if (me && row.toIds.includes(me) && row.fromId !== me) flashBrowser(row.title, row.body);
      }
    });
  }, []);
  return null;
}

export function NoticeBell({ lang, onOpen }: { lang: Lang; onOpen?: (n: Notice) => void }) {
  const emp = useSessionEmployee();
  const notices = useYard((s) => s.notices) ?? [];
  const markNoticeRead = useYard((s) => s.markNoticeRead);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState("default");
  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);
  if (!emp) return null;
  const mine = noticesFor(notices, emp.id).slice(0, 20);
  const unread = unreadNotices(notices, emp.id).length;

  async function allow() {
    if (typeof Notification === "undefined") return;
    try {
      const next = await Notification.requestPermission();
      setPerm(next);
    } catch {
      setPerm("denied");
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="notice-bell"
        aria-label={t(lang, "noticeBell")}
        onClick={() => setOpen(true)}
        className={`relative inline-flex size-11 items-center justify-center rounded-full ${unread ? "bg-brick text-sand" : "text-sand"}`}
      >
        <Bell className="size-5" strokeWidth={unread ? 2.4 : 1.8} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sand px-1 text-[11px] font-bold leading-none text-brick">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/50" role="dialog">
          <div className="mx-auto mt-12 max-w-lg rounded-[20px] bg-paper px-4 py-4 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <BackArrow onClick={() => setOpen(false)} label={t(lang, "back")} />
              <p className="font-display text-2xl text-navy">{t(lang, "noticeBell")}</p>
            </div>
            {perm !== "granted" && typeof Notification !== "undefined" ? (
              <button type="button" className="mb-3 w-full rounded-xl bg-sand px-3 py-2 text-left text-sm" onClick={() => void allow()}>
                <span className="block font-semibold">{t(lang, "noticeAllowBtn")}</span>
                <span className="text-muted">{t(lang, "noticeAllow")}</span>
              </button>
            ) : null}
            {mine.length === 0 ? <p className="text-sm text-muted">{t(lang, "noticeEmpty")}</p> : null}
            <ul className="space-y-1.5">
              {mine.map((n) => {
                const hot = !n.readBy.includes(emp.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`w-full rounded-2xl px-3 py-2.5 text-left ${hot ? "bg-brick text-sand" : "bg-sand text-ink"}`}
                      onClick={() => {
                        markNoticeRead(n.id, emp.id);
                        setOpen(false);
                        onOpen?.(n);
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{n.title}</span>
                        <span className={`text-[11px] ${hot ? "text-sand/80" : "text-muted"}`}>{copenhagenTime(n.at)}</span>
                      </span>
                      <span className={`mt-0.5 block text-sm ${hot ? "text-sand/90" : "text-muted"}`}>{n.body}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
