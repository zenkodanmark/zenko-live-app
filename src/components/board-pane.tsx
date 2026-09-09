import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Mail } from "lucide-react";
import { Card, Chip, GhostButton, SectionLabel } from "@/components/zenko";
import { OpenTodosCard } from "@/components/todo-board";
import { SagerPane, type ListKind } from "@/components/sager-pane";
import { SagPng, sagPngForPile } from "@/components/sag-icons";
import { FacePhoto } from "@/components/face-photo";
import { MasterOnSiteBar } from "@/components/master-on-site";
import { ensureAdminLog } from "@/lib/drive.functions";
import { t, localeFor } from "@/lib/i18n";
import { listBoardMail, type MailLive } from "@/lib/mail.functions";
import { boardHeadline, guessSag, mailKind, recentBoardFallback, type MailItem } from "@/lib/mail.snapshot";
import { BOARD_PILES, pileHasNewFromChat, pileLabelKey, type BoardPile } from "@/lib/board-piles";
import { boardedCount, isOnSite } from "@/lib/on-site";
import { copenhagenDate, copenhagenTime, projectById } from "@/lib/seed";
import { listYardCalendar } from "@/lib/calendar.functions";
import { todayLog, useSessionEmployee, useYard } from "@/lib/store";
import type { CalEvent, Lang } from "@/lib/types";

export function BoardPane({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee();
  const [pile, setPile] = useState<BoardPile | null>(null);
  const markBoardPileSeen = useYard((s) => s.markBoardPileSeen);
  const boardSeenAt = useYard((s) => s.boardSeenAt) ?? {};
  const todos = useYard((s) => s.todos) ?? [];
  const ents = useYard((s) => s.ents) ?? [];
  const tfs = useYard((s) => s.tfs) ?? [];
  const slips = useYard((s) => s.slips) ?? [];
  const offers = useYard((s) => s.offers) ?? [];
  const ks = useYard((s) => s.ksReports) ?? [];
  const needs = useYard((s) => s.needs) ?? [];
  const chats = useYard((s) => s.chats) ?? [];

  useEffect(() => {
    const dump = useYard
      .getState()
      .logs.slice(0, 80)
      .map((l) => `${l.at} ${l.kind} ${l.text}`)
      .join("\n");
    void ensureAdminLog({ data: { text: dump || "Zenko Plads log.", date: copenhagenDate() } }).then((r) => {
      if (r.ok && r.folderId) useYard.getState().setAdminFolder(r.folderId);
    });
  }, []);

  const dots = useMemo(() => {
    if (!emp) return {} as Record<BoardPile, boolean>;
    const args = { employeeId: emp.id, seenAt: boardSeenAt, todos, ents, tfs, slips, offers, ks, needs, chats };
    return Object.fromEntries(BOARD_PILES.map((p) => [p, pileHasNewFromChat({ ...args, pile: p })])) as Record<BoardPile, boolean>;
  }, [emp, boardSeenAt, todos, ents, tfs, slips, offers, ks, needs, chats]);

  function pickPile(p: BoardPile) {
    if (pile === p) {
      setPile(null);
      return;
    }
    setPile(p);
    if (emp) markBoardPileSeen(emp.id, p);
  }

  return (
    <div className="space-y-4">
      <CrewStrip lang={lang} />
      <BoardPileBar lang={lang} value={pile} dots={dots} onPick={pickPile} />
      <MasterOnSiteBar lang={lang} />
      {pile && emp ? (
        <SagerPane lang={lang} masterId={emp.id} embedKind={PILE_TO_LIST[pile]} onEmbedClose={() => setPile(null)} />
      ) : (
        <>
          <OpenTodosCard lang={lang} />
          <NextMeeting lang={lang} />
          <BriefPane lang={lang} />
        </>
      )}
    </div>
  );
}

const PILE_TO_LIST: Record<BoardPile, ListKind> = {
  todo: "todo",
  ent: "ent",
  tf: "tf",
  extra: "slip",
  offer: "offer",
  ks: "ks",
  materials: "material",
};

function PileGlyph({ pile }: { pile: BoardPile }) {
  return <SagPng name={sagPngForPile(pile)} px={56} />;
}

function BoardPileBar({
  lang,
  value,
  dots,
  onPick,
}: {
  lang: Lang;
  value: BoardPile | null;
  dots: Record<BoardPile, boolean>;
  onPick: (p: BoardPile) => void;
}) {
  return (
    <div>
      <ul className="grid grid-cols-7 gap-1">
        {BOARD_PILES.map((p) => {
          const on = value === p;
          const hot = dots[p];
          return (
            <li key={p}>
              <button
                type="button"
                data-testid={`board-pile-${p}`}
                onClick={() => onPick(p)}
                className={`relative flex min-h-[6.25rem] w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[12px] font-bold leading-tight ${on ? "bg-navy text-sand" : hot ? "bg-brick/10 text-navy" : "bg-paper text-navy"}`}
              >
                <PileGlyph pile={p} />
                <span>{t(lang, pileLabelKey(p))}</span>
                {hot ? <span className="absolute right-1 top-1 size-2.5 rounded-full bg-brick" data-testid={`board-dot-${p}`} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CrewStrip({ lang }: { lang: Lang }) {
  const employees = useYard((s) => s.employees);
  const days = useYard((s) => s.days);
  const { met, total } = boardedCount(employees, days);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "crewStrip")}</p>
        <p className="text-[11px] text-muted" data-testid="board-crew-count">
          {met}/{total} {t(lang, "metYes")}
        </p>
      </div>
      <ul className="flex gap-1 overflow-x-auto pb-1">
        {employees.map((e) => {
          const d = todayLog(e.id, days);
          const arrived = isOnSite(d);
          const job = arrived && d.projectId ? projectById(d.projectId).name : "";
          return (
            <li
              key={e.id}
              data-testid={`board-crew-${e.id}`}
              data-onsite={arrived ? "1" : "0"}
              className={`min-w-[4.8rem] shrink-0 rounded-lg px-1.5 py-1 text-center ${arrived ? "bg-paper ring-[3px] ring-brick" : "bg-paper/70"}`}
            >
              <FacePhoto employee={e} px={40} />
              <p className="mt-1 truncate text-list font-medium leading-[1.4] text-ink">{e.name.split(" ")[0]}</p>
              {arrived ? (
                <p className="text-action leading-[1.4] text-moss">
                  {t(lang, "metYes")}
                  {job ? ` · ${job}` : ""}
                </p>
              ) : (
                <p className="text-action leading-[1.4] text-brick">{t(lang, "metNo")}</p>
              )}
              {d.checkInAt ? <p className="text-action text-ink">{copenhagenTime(d.checkInAt)}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function calSag(event: CalEvent, names: string[]) {
  const blob = `${event.title} ${event.where ?? ""}`.toLowerCase();
  const ranked = [...names].filter((n) => n.trim().length >= 4).sort((a, b) => b.length - a.length);
  for (const n of ranked) {
    if (blob.includes(n.trim().toLowerCase())) return n;
  }
  if (/islev|fortvej|rødovre|rodovre|02304/.test(blob)) return "Islevvænge";
  if (/kærhuset|kaerhuset|kær bygade|kaer bygade/.test(blob)) return "Kærhuset";
  if (/solbakke|snogbæk|snogbaek/.test(blob)) return "Solbakkegård";
  if (/klostergård|klostergaard|klostervej/.test(blob)) return "Klostergården Hillerød";
  if (/hillerødsholm|hillerodsholm|selskov/.test(blob)) return "Hillerødsholm";
  return "";
}

function NextMeeting({ lang }: { lang: Lang }) {
  const projects = useYard((s) => s.projects) ?? [];
  const names = projects.map((p) => p.name).filter((n) => n.trim().length >= 4 && !/^skole$/i.test(n.trim()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loginUrl, setLoginUrl] = useState<string | undefined>();
  const [loginRequired, setLoginRequired] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = start.toISOString();
    const to = new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    void listYardCalendar({ data: { from, to } }).then((res) => {
      setEvents(res.events ?? []);
      setLive(Boolean(res.live));
      setLoginUrl(res.loginUrl);
      setLoginRequired(Boolean(res.loginRequired) || Boolean(res.loginUrl));
    });
  }, []);

  const now = Date.now() - 30 * 60 * 1000;
  const upcoming = events
    .filter((e) => Date.parse(e.at) >= now)
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, 20);

  return (
    <Card className="rounded-[20px]" data-testid="board-cal">
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="size-4 text-navy" />
        <SectionLabel>{t(lang, "nextMeeting")}</SectionLabel>
        {live ? <Chip tone="ok">{t(lang, "calLive")}</Chip> : <Chip tone="sand">{t(lang, "opsLive")}</Chip>}
      </div>
      <p className="mb-2 text-xs text-muted">{t(lang, "calHint")}</p>
      {loginRequired ? (
        <GhostButton className="mb-2 bg-sand" onClick={() => loginUrl && window.open(loginUrl, "_blank")}>
          {t(lang, "calLogin")}
        </GhostButton>
      ) : null}
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">{t(lang, "noMeeting")}</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((e) => {
            const job = calSag(e, names);
            return (
              <li key={e.id} className="rounded-xl bg-sand px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{e.title}</p>
                  {job ? <Chip tone="navy">{job}</Chip> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {new Date(e.at).toLocaleString(localeFor(lang), {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {e.where ? ` · ${e.where}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function mailFitsJob(item: MailItem, names: string[]) {
  if (guessSag(item, names)) return true;
  const blob = `${item.subject} ${item.snippet} ${item.from}`.toLowerCase();
  return names.some((n) => n.trim().length >= 4 && blob.includes(n.trim().toLowerCase()));
}

function jobChip(item: MailItem, names: string[]) {
  return guessSag(item, names);
}

function BriefPane({ lang }: { lang: Lang }) {
  const projects = useYard((s) => s.projects) ?? [];
  const names = projects.map((p) => p.name).filter((n) => n.trim().length >= 4 && !/^skole$/i.test(n.trim()));
  const fallback = recentBoardFallback().filter((m) => mailFitsJob(m, names));
  const [snap, setSnap] = useState<MailLive>({
    count: fallback.length,
    headline: boardHeadline(fallback),
    live: false,
    items: fallback,
    brief: boardHeadline(fallback),
  });

  useEffect(() => {
    void listBoardMail({ data: { days: 10, names } }).then((res) => {
      if (res) setSnap(res);
    });
  }, [names.join("|")]);

  const items = (snap.items ?? []).filter((m) => mailFitsJob(m, names)).slice(0, 20);
  const headline = items.length ? boardHeadline(items) : t(lang, "briefEmpty");

  return (
    <Card className="rounded-[20px]" data-testid="board-mail">
      <div className="mb-2 flex items-center gap-2">
        <Mail className="size-4 text-navy" />
        <SectionLabel>{t(lang, "briefTitle")}</SectionLabel>
        {snap.live ? <Chip tone="ok">{t(lang, "opsGmail")}</Chip> : <Chip tone="sand">{t(lang, "opsLive")}</Chip>}
      </div>
      <p className="mb-2 text-xs text-muted">{t(lang, "briefHint")}</p>
      {snap.loginRequired ? (
        <GhostButton className="mb-2 bg-sand" onClick={() => snap.loginUrl && window.open(snap.loginUrl, "_blank")}>
          {t(lang, "mailLogin")}
        </GhostButton>
      ) : null}
      <p className="text-sm leading-relaxed">{headline}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t(lang, "briefEmpty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((m) => {
            const kind = mailKind(m);
            const job = jobChip(m, names);
            return (
              <li key={m.id} className="rounded-xl bg-sand px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{m.subject.replace(/^Hillerødsholm\s*-\s*/i, "")}</p>
                  {job ? <Chip tone={kind === "lin" || kind === "meet" ? "navy" : "sand"}>{job}</Chip> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {m.date} · {m.from}
                </p>
                {m.snippet ? <p className="mt-1 text-xs leading-relaxed">{m.snippet}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

