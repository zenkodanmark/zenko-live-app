import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Card, PrimaryButton, SectionLabel } from "@/components/zenko";
import { TabPng } from "@/components/sag-icons";
import { saveWeekPlan } from "@/lib/drive.functions";
import { t, localeFor } from "@/lib/i18n";
import {
  addDaysYmd,
  isoWeek,
  PLAN_PLACES,
  planCoversPerson,
  planPeopleIds,
  planPlaceLabel,
  projectBarClass,
  rangesFromDays,
  startOfIsoWeek,
  weekDays,
  weekdayLabel,
} from "@/lib/plan";
import { copenhagenDate } from "@/lib/seed";
import { useYard } from "@/lib/store";
import type { Lang, PlanBlock } from "@/lib/types";

export function PlanPane({ lang }: { lang: Lang }) {
  const plans = useYard((s) => s.plans) ?? [];
  const employees = useYard((s) => s.employees) ?? [];
  const projects = useYard((s) => s.projects) ?? [];
  const addPlan = useYard((s) => s.addPlan);
  const removePlan = useYard((s) => s.removePlan);
  const thisWeek = startOfIsoWeek(copenhagenDate());
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [work, setWork] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const week = weekDays(weekStart);
  const weekNo = isoWeek(weekStart);
  const jobs = projects.filter((p) => p.status === "active");
  const people = [...employees.filter((e) => e.role !== "mester"), ...employees.filter((e) => e.role === "mester")];

  function togglePerson(id: string) {
    setPersonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleDay(d: string) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  }

  function shiftWeek(next: string) {
    if (next === weekStart) return;
    const from = Date.parse(`${weekStart}T12:00:00Z`);
    const to = Date.parse(`${next}T12:00:00Z`);
    const delta = Math.round((to - from) / 86400000);
    setWeekStart(next);
    if (delta) setDays((cur) => cur.map((d) => addDaysYmd(d, delta)));
  }

  async function save() {
    if (!personIds.length || !days.length || !placeId || !work.trim()) {
      setNote(t(lang, "planNeedAll"));
      return;
    }
    setBusy(true);
    setNote("");
    const ranges = rangesFromDays(days);
    for (const r of ranges) {
      addPlan({
        employeeId: personIds[0],
        employeeIds: personIds,
        projectId: placeId,
        place: placeLabel || undefined,
        title: work.trim(),
        start: r.start,
        end: r.end,
        source: "manual",
      });
    }
    const after = useYard.getState().plans;
    const text = formatWeekFile(weekNo, weekStart, week[6]!, after, employees);
    try {
      const res = await saveWeekPlan({ data: { week: String(weekNo), weekStart, weekEnd: week[6]!, text } });
      setNote(res.ok ? t(lang, "planDriveOk") : t(lang, "planSaved"));
    } catch {
      setNote(t(lang, "planSaved"));
    }
    setDays([]);
    setWork("");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3" data-testid="plan-title">
          <TabPng name="plan" px={64} />
          <span className="text-sm font-semibold text-navy">{t(lang, "planTitle")}</span>
        </div>
        <p className="text-sm text-muted">{t(lang, "planHint")}</p>
      </div>

      <Card className="rounded-[20px]">
        <SectionLabel>
          {t(lang, "planWeek")} {weekNo}
        </SectionLabel>
        <p className="mb-2 text-xs text-muted">{t(lang, "planLongPress")}</p>
        <WeekSwipe weekStart={weekStart} onWeekStart={shiftWeek}>
          {(start, daysOf) => (
            <ul className="space-y-3">
              {people.map((e) => (
                <li key={e.id}>
                  <p className="mb-1 text-sm font-semibold text-navy">{e.name}</p>
                  <PlanWeekRow days={daysOf} blocks={plans.filter((p) => planCoversPerson(p, e.id))} onRemove={removePlan} />
                </li>
              ))}
            </ul>
          )}
        </WeekSwipe>
        {plans.length === 0 ? <p className="mt-2 text-sm text-muted">{t(lang, "planEmpty")}</p> : null}
      </Card>

      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "planStepPerson")}</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {people.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => togglePerson(e.id)}
              className={`min-h-14 min-w-20 flex-1 rounded-xl px-3 text-sm font-semibold ${personIds.includes(e.id) ? "bg-navy text-sand" : "bg-sand text-ink"}`}
            >
              {e.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[20px]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionLabel>{t(lang, "planStepDays")}</SectionLabel>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {weekStart > thisWeek ? t(lang, "planNextWeek") : t(lang, "planThisWeek")} · {t(lang, "planWeek")} {weekNo}
          </span>
        </div>
        <p className="mb-2 text-xs text-muted">{t(lang, "planLongPress")}</p>
        <WeekSwipe weekStart={weekStart} onWeekStart={shiftWeek}>
          {(_start, daysOf) => (
            <div className="flex gap-1">
              {daysOf.map((d) => (
                <DayBar key={d} date={d} lang={lang} selected={days.includes(d)} onToggle={() => toggleDay(d)} />
              ))}
            </div>
          )}
        </WeekSwipe>
      </Card>

      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "planStepPlace")}</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLAN_PLACES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlaceId(p.id);
                setPlaceLabel(p.label);
              }}
              className={`min-h-12 rounded-full px-4 text-sm font-semibold ${placeId === p.id ? "bg-navy text-sand" : "bg-sand text-ink"}`}
            >
              {p.label}
            </button>
          ))}
          {jobs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlaceId(p.id);
                setPlaceLabel(p.name);
              }}
              className={`min-h-12 rounded-full px-4 text-sm font-semibold ${placeId === p.id ? "bg-navy text-sand" : "bg-sand text-ink"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "planStepWork")}</SectionLabel>
        <input
          className="mt-2 min-h-14 w-full rounded-xl bg-sand px-3 text-base"
          placeholder={t(lang, "planWorkPh")}
          value={work}
          onChange={(e) => setWork(e.target.value)}
        />
        <PrimaryButton className="mt-3 min-h-14 text-base" disabled={busy} onClick={() => void save()}>
          {t(lang, "planSave")}
        </PrimaryButton>
        {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      </Card>
    </div>
  );
}

export function WeekSwipe({
  weekStart,
  onWeekStart,
  children,
}: {
  weekStart: string;
  onWeekStart: (w: string) => void;
  children: (start: string, days: string[]) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const user = useRef(false);
  const prev = addDaysYmd(weekStart, -7);
  const next = addDaysYmd(weekStart, 7);
  const pages = [prev, weekStart, next];

  useLayoutEffect(() => {
    user.current = false;
    const el = ref.current;
    if (!el) return;
    const go = () => {
      const mid = el.children[1] as HTMLElement | undefined;
      if (mid) el.scrollLeft = mid.offsetLeft;
    };
    go();
    const a = requestAnimationFrame(go);
    const t = window.setTimeout(go, 50);
    return () => {
      cancelAnimationFrame(a);
      window.clearTimeout(t);
    };
  }, [weekStart]);

  function onScroll() {
    if (!user.current) return;
    const el = ref.current;
    if (!el) return;
    const mid = el.children[1] as HTMLElement | undefined;
    if (!mid) return;
    const left = mid.offsetLeft;
    const w = mid.offsetWidth || el.clientWidth;
    if (!w) return;
    if (el.scrollLeft < left - w * 0.45) onWeekStart(prev);
    else if (el.scrollLeft > left + w * 0.45) onWeekStart(next);
  }

  return (
    <div
      ref={ref}
      onPointerDown={() => {
        user.current = true;
      }}
      onScroll={onScroll}
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {pages.map((start) => (
        <div key={start} className="w-full min-w-full shrink-0 snap-start" data-week-start={start}>
          {children(start, weekDays(start))}
        </div>
      ))}
    </div>
  );
}

function DayBar({ date, selected, onToggle, lang }: { date: string; selected: boolean; onToggle: () => void; lang: Lang }) {
  return (
    <button
      type="button"
      className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-xl ${selected ? "bg-navy text-sand" : "bg-sand text-ink"}`}
      onClick={onToggle}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{weekdayLabel(date, localeFor(lang))}</span>
      <span className="font-display text-2xl leading-none">{Number(date.slice(8))}</span>
    </button>
  );
}

export function PlanWeekRow({
  days,
  blocks,
  onRemove,
  onOpen,
}: {
  days: string[];
  blocks: PlanBlock[];
  onRemove?: (id: string) => void;
  onOpen?: (block: PlanBlock, date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {days.map((d) => {
        const hit = blocks.find((b) => b.start <= d && b.end >= d);
        if (!hit) return <div key={d} className="min-h-14 rounded-lg bg-sand" />;
        return (
          <button
            key={d}
            type="button"
            title={`${planPlaceLabel(hit)} · ${hit.title}`}
            onClick={() => (onOpen ? onOpen(hit, d) : onRemove?.(hit.id))}
            className={`min-h-14 overflow-hidden rounded-lg px-0.5 py-0.5 text-left ${projectBarClass(hit.projectId)}`}
          >
            <span className="block truncate text-[10px] font-semibold leading-tight">{planPlaceLabel(hit)}</span>
            <span className="block truncate text-[10px] leading-tight opacity-80">{hit.title}</span>
            {hit.comment ? <span className="block truncate text-[10px] leading-tight opacity-70">{hit.comment}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function formatWeekFile(
  weekNo: number,
  weekStart: string,
  weekEnd: string,
  plans: PlanBlock[],
  employees: { id: string; name: string }[],
) {
  const rows = plans
    .filter((p) => !(p.end < weekStart || p.start > weekEnd))
    .map((p) => {
      const who = planPeopleIds(p)
        .map((id) => employees.find((e) => e.id === id)?.name ?? id)
        .join(", ");
      return `${who} | ${p.start}${p.end !== p.start ? "–" + p.end : ""} | ${planPlaceLabel(p)} | ${p.title}`;
    });
  return [`UGE ${weekNo} · ${weekStart}–${weekEnd}`, ...rows].join("\n");
}
