import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { QuickCompose } from "@/components/quick-compose";
import { TabPng } from "@/components/sag-icons";
import { noticeForPlanEdit } from "@/lib/notify";
import {
  DAY_LETTERS,
  daysToRange,
  firstMasterId,
  gridWeeks,
  isGridPlan,
  isLedelseTodo,
  planDaysOf,
  printWeekNums,
  sortTodosForDropdown,
  toggleDay,
  visibleGridPlans,
} from "@/lib/plan-grid";
import { copenhagenDate } from "@/lib/seed";
import { useYard } from "@/lib/store";
import type { PlanBlock, Todo } from "@/lib/types";

export function PlanGrid({
  projectId,
  mode,
  jobName = "",
}: {
  projectId: string;
  mode: "ledelse" | "mester";
  jobName?: string;
}) {
  const allPlans = useYard((s) => s.plans) ?? [];
  const allTodos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const addPlan = useYard((s) => s.addPlan);
  const patchPlan = useYard((s) => s.patchPlan);
  const pushNotice = useYard((s) => s.pushNotice);
  const jobTodos = allTodos.filter((t) => t.projectId === projectId && !t.done);
  const hakked = jobTodos.filter(isLedelseTodo);
  const plans = visibleGridPlans(
    allPlans.filter((p) => p.projectId === projectId && isGridPlan(p)),
    hakked,
  );
  const weeks = useMemo(() => gridWeeks("2026-08-03", 12), []);
  const today = copenhagenDate();
  const printWeeks = useMemo(() => printWeekNums(weeks, today, 4), [weeks, today]);
  const printLabel = [...printWeeks].sort((a, b) => a - b);
  const scroller = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const [compose, setCompose] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const masterId = firstMasterId(employees);

  useEffect(() => {
    const el = scroller.current?.querySelector('[data-week="37"]');
    el?.scrollIntoView({ inline: "start", block: "nearest", behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    if (!openId) return;
    const close = () => {
      setOpenId(null);
      setDropAt(null);
    };
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-testid='plan-dropdown']")) return;
      if (el?.closest?.("[data-testid^='plan-drop-']")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const el = scroller.current;
    el?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const usedIds = new Set(plans.map((p) => p.todoId).filter(Boolean) as string[]);
  const dropdownTodos = sortTodosForDropdown(hakked, usedIds);

  function pingMaster(title: string) {
    if (mode !== "ledelse") return;
    const n = noticeForPlanEdit({
      title,
      projectId,
      fromId: "ledelse",
      employees,
    });
    if (n) pushNotice(n);
  }

  function saveDays(row: PlanBlock, ymd: string) {
    const next = toggleDay(planDaysOf(row), ymd);
    const range = daysToRange(next);
    patchPlan(row.id, { days: next, start: range.start || row.start, end: range.end || row.end });
    pingMaster(`${row.title} · dage`);
  }

  function toggleDrop(id: string, el: HTMLButtonElement | null) {
    if (openId === id) {
      setOpenId(null);
      setDropAt(null);
      return;
    }
    setOpenId(id);
    setDropAt(dropBoxOf(el));
  }

  function pickTodo(row: PlanBlock | null, todo: Todo) {
    if (plans.some((p) => p.todoId === todo.id || p.title === todo.title)) {
      setOpenId(null);
      setDropAt(null);
      return;
    }
    if (!row) {
      const day = copenhagenDate();
      addPlan({
        projectId,
        title: todo.title,
        start: day,
        end: day,
        days: [],
        todoId: todo.id,
        employeeId: masterId,
        source: "plan-grid",
      });
    } else {
      patchPlan(row.id, { todoId: todo.id, title: todo.title });
    }
    setOpenId(null);
    setDropAt(null);
    pingMaster(`${todo.title} · valgt`);
  }

  function saveComment(row: PlanBlock) {
    const comment = (comments[row.id] ?? row.comment ?? "").trim();
    if (comment === (row.comment ?? "").trim()) return;
    patchPlan(row.id, { comment });
    pingMaster(`${row.title} · kommentar`);
  }

  function printPdf() {
    document.documentElement.classList.add("plan-print-a3");
    const onAfter = () => {
      document.documentElement.classList.remove("plan-print-a3");
      window.removeEventListener("afterprint", onAfter);
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }

  return (
    <section className="plan-a3-print flex min-h-0 flex-1 flex-col bg-paper" data-testid="plan-grid">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-3 py-2">
        <TabPng name="plan" px={40} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Plan</p>
          <h1 className="font-display text-3xl leading-none text-navy" data-testid="plan-job-name">
            {jobName || "Plan"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
            setDropAt(null);
            setCompose(true);
          }}
          className="no-print min-h-11 rounded-full bg-navy px-4 text-sm font-semibold text-sand"
          data-testid="plan-create"
        >
          Opret
        </button>
        <button
          type="button"
          onClick={printPdf}
          className="no-print min-h-11 rounded-full bg-navy px-4 text-sm font-semibold text-sand"
          data-testid="plan-pdf"
        >
          PDF
        </button>
      </header>

      <div className="print-only px-3 py-2 text-sm text-navy">
        {jobName} · uge {printLabel.join("–")}
      </div>

      {compose ? (
        <div className="no-print fixed inset-0 z-[100] overflow-y-auto bg-sand/95 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-lg">
            <QuickCompose
              kind="todo"
              projectId={projectId}
              lang="da"
              assigneeId={masterId}
              lockAssignee
              fromId="ledelse"
              ledelseStatus="med_til_ledelse"
              onClose={() => setCompose(false)}
              onCreated={() => setCompose(false)}
            />
          </div>
        </div>
      ) : null}

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto overscroll-x-contain touch-pan-x bg-paper">
        <table className="w-max min-w-full border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-64 min-w-64 bg-paper px-2 py-1 text-left text-xs font-semibold tracking-wide text-muted uppercase shadow-[2px_0_0_0_var(--color-line)]">
                Opgave
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  colSpan={7}
                  data-week={w.week}
                  data-print-week={printWeeks.has(w.week) ? "1" : "0"}
                  className="border-b border-line border-l border-line px-0 py-1 text-sm font-semibold text-navy"
                >
                  uge {w.week}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-paper shadow-[2px_0_0_0_var(--color-line)]" />
              {weeks.map((w) =>
                DAY_LETTERS.map((letter, i) => (
                  <th
                    key={`${w.week}-${i}`}
                    data-print-week={printWeeks.has(w.week) ? "1" : "0"}
                    data-today={w.days[i] === today ? "1" : undefined}
                    className={`plan-day border-b border-line py-0.5 text-[10px] font-semibold text-muted ${w.days[i] === today ? "plan-today" : ""}`}
                  >
                    {letter}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {plans.map((row, i) => (
              <PlanGridRow
                key={row.id}
                row={row}
                weeks={weeks}
                printWeeks={printWeeks}
                today={today}
                zebra={i % 2 === 1}
                open={openId === row.id}
                onOpen={(el) => toggleDrop(row.id, el)}
                comment={comments[row.id] ?? row.comment ?? ""}
                onComment={(v) => setComments((c) => ({ ...c, [row.id]: v }))}
                onSaveComment={() => saveComment(row)}
                onDay={(ymd) => saveDays(row, ymd)}
              />
            ))}
            <PlanGridRow
              row={null}
              weeks={weeks}
              printWeeks={printWeeks}
              today={today}
              zebra={plans.length % 2 === 1}
              open={openId === "draft"}
              onOpen={(el) => toggleDrop("draft", el)}
              comment=""
              onComment={() => {}}
              onSaveComment={() => {}}
              onDay={() => {}}
            />
          </tbody>
        </table>
      </div>
      {openId && dropAt ? (
        <TodoDropList
          todos={dropdownTodos}
          usedIds={usedIds}
          at={dropAt}
          onPick={(td) => pickTodo(openId === "draft" ? null : (plans.find((p) => p.id === openId) ?? null), td)}
        />
      ) : null}
    </section>
  );
}

function dropBoxOf(el: HTMLButtonElement | null) {
  const r = el?.getBoundingClientRect();
  const width = Math.max(r?.width ?? 240, 256);
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(r?.left ?? 16, vw - width - 8));
  const below = (r?.bottom ?? 120) + 4;
  const listH = 224;
  const top = below + listH > vh - 8 && (r?.top ?? 0) > listH + 8 ? (r?.top ?? listH) - listH - 4 : Math.min(below, vh - listH - 8);
  return { top, left, width };
}

function TodoDropList({
  todos,
  usedIds,
  onPick,
  at,
}: {
  todos: Todo[];
  usedIds: Set<string>;
  onPick: (td: Todo) => void;
  at: { top: number; left: number; width: number };
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ul
      className="fixed z-[90] max-h-56 overflow-auto rounded-2xl bg-paper py-1 shadow-card ring-1 ring-line"
      style={{ top: at.top, left: at.left, width: at.width }}
      data-testid="plan-dropdown"
    >
      {todos.length ? (
        todos.map((td) => {
          const used = usedIds.has(td.id);
          return (
            <li key={td.id}>
              <button
                type="button"
                onClick={() => onPick(td)}
                className={`min-h-11 w-full px-3 py-2 text-left text-sm ${used ? "bg-brick text-sand" : "text-navy"}`}
                data-testid={`plan-todo-${td.id}`}
                data-used={used ? "1" : "0"}
              >
                {td.title}
              </button>
            </li>
          );
        })
      ) : (
        <li className="px-3 py-3 text-sm text-muted">Ingen to-do med hak til byggeledelse.</li>
      )}
    </ul>,
    document.body,
  );
}

function PlanGridRow({
  row,
  weeks,
  printWeeks,
  today,
  zebra,
  open,
  onOpen,
  comment,
  onComment,
  onSaveComment,
  onDay,
}: {
  row: PlanBlock | null;
  weeks: { week: number; start: string; days: string[] }[];
  printWeeks: Set<number>;
  today: string;
  zebra: boolean;
  open: boolean;
  onOpen: (el: HTMLButtonElement | null) => void;
  comment: string;
  onComment: (v: string) => void;
  onSaveComment: () => void;
  onDay: (ymd: string) => void;
}) {
  const days = row ? new Set(planDaysOf(row)) : new Set<string>();
  const bg = zebra ? "bg-sand-deep" : "bg-paper";
  const line = "border-b border-navy/20";
  const title = row?.title || "Vælg to-do";
  return (
    <tr
      data-testid={row ? `plan-row-${row.id}` : "plan-row-draft"}
      data-zebra={zebra ? "1" : "0"}
      className={`${bg} ${row ? "" : "no-print"}`}
    >
      <td
        className={`sticky left-0 z-10 w-64 min-w-64 px-2 py-1.5 text-left align-top ${bg} ${line} shadow-[2px_0_0_0_var(--color-line)]`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(e.currentTarget);
          }}
          aria-expanded={open}
          className="no-print flex w-full items-start gap-1 text-left"
          data-testid={row ? `plan-drop-${row.id}` : "plan-drop-draft"}
        >
          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug break-words text-navy" data-testid={row ? `plan-row-title-${row.id}` : "plan-row-title-draft"}>
            {title}
          </span>
          <ChevronDown className={`mt-0.5 size-5 shrink-0 text-navy ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <p className="print-only text-sm font-semibold text-navy">{row ? title : ""}</p>
        {row ? (
          <>
            <input
              className="no-print mt-0.5 h-7 w-full bg-transparent text-xs text-muted outline-none"
              placeholder="Kommentar"
              value={comment}
              onChange={(e) => onComment(e.target.value)}
              onBlur={onSaveComment}
              data-testid={`plan-comment-${row.id}`}
            />
            {comment ? <p className="print-only text-xs text-muted">{comment}</p> : null}
          </>
        ) : null}
      </td>
      {weeks.map((w) =>
        w.days.map((ymd) => {
          const on = days.has(ymd);
          return (
            <td
              key={ymd}
              data-print-week={printWeeks.has(w.week) ? "1" : "0"}
              className={`plan-day p-0 ${bg} ${line} ${ymd === today ? "plan-today" : ""}`}
            >
              <button
                type="button"
                disabled={!row}
                onClick={() => onDay(ymd)}
                aria-pressed={on}
                data-testid={row ? `plan-cell-${row.id}-${ymd}` : undefined}
                className={`block h-full min-h-12 w-full ${on ? "bg-brick" : "bg-transparent"} ${!row ? "opacity-30" : ""}`}
              />
            </td>
          );
        }),
      )}
    </tr>
  );
}
