import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PrimaryButton } from "@/components/zenko";
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
  const addTodo = useYard((s) => s.addTodo);
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = scroller.current?.querySelector('[data-week="37"]');
    el?.scrollIntoView({ inline: "start", block: "nearest", behavior: "instant" as ScrollBehavior });
  }, []);

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

  function addRow(todo: Todo) {
    if (plans.some((p) => p.todoId === todo.id || p.title === todo.title)) {
      setOpen(false);
      return;
    }
    const day = copenhagenDate();
    addPlan({
      projectId,
      title: todo.title,
      start: day,
      end: day,
      days: [],
      todoId: todo.id,
      employeeId: firstMasterId(employees),
      source: "plan-grid",
    });
    setOpen(false);
    pingMaster(`${todo.title} · valgt`);
  }

  function saveComment(row: PlanBlock) {
    const comment = (comments[row.id] ?? row.comment ?? "").trim();
    if (comment === (row.comment ?? "").trim()) return;
    patchPlan(row.id, { comment });
    pingMaster(`${row.title} · kommentar`);
  }

  function createTodo() {
    const title = draft.trim();
    if (!title) return;
    addTodo({
      projectId,
      assigneeId: firstMasterId(employees),
      title,
      body: title,
      due: "",
      fromId: "ledelse",
      ledelseStatus: "med_til_ledelse",
    });
    setDraft("");
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

      <div className="no-print relative shrink-0 border-b border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-h-10 min-w-[9rem] flex-1 rounded-xl bg-sand px-3 text-sm outline-none"
            placeholder="Opret to-do"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createTodo();
            }}
            data-testid="plan-create"
          />
          <PrimaryButton className="min-h-10 w-auto shrink-0 px-4 text-sm" disabled={!draft.trim()} onClick={createTodo}>
            Opret
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-10 min-w-[12rem] flex-1 items-center gap-2 rounded-xl bg-sand px-3 text-left"
            data-testid="plan-drop-draft"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">Vælg to-do</span>
            <ChevronDown className={`size-6 shrink-0 text-navy ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
        {open ? (
          <ul
            className="absolute inset-x-3 z-30 mt-1 max-h-56 overflow-auto rounded-2xl bg-paper py-1 shadow-card ring-1 ring-line"
            data-testid="plan-dropdown"
          >
            {dropdownTodos.length ? (
              dropdownTodos.map((td) => {
                const used = usedIds.has(td.id);
                return (
                  <li key={td.id}>
                    <button
                      type="button"
                      onClick={() => addRow(td)}
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
          </ul>
        ) : null}
      </div>

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
                    className={`w-9 border-b border-line py-0.5 text-[10px] font-semibold text-muted ${i === 0 ? "border-l border-line" : ""} ${w.days[i] === today ? "plan-today" : ""}`}
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
                comment={comments[row.id] ?? row.comment ?? ""}
                onComment={(v) => setComments((c) => ({ ...c, [row.id]: v }))}
                onSaveComment={() => saveComment(row)}
                onDay={(ymd) => saveDays(row, ymd)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlanGridRow({
  row,
  weeks,
  printWeeks,
  today,
  zebra,
  comment,
  onComment,
  onSaveComment,
  onDay,
}: {
  row: PlanBlock;
  weeks: { week: number; start: string; days: string[] }[];
  printWeeks: Set<number>;
  today: string;
  zebra: boolean;
  comment: string;
  onComment: (v: string) => void;
  onSaveComment: () => void;
  onDay: (ymd: string) => void;
}) {
  const days = new Set(planDaysOf(row));
  const bg = zebra ? "bg-sand-deep" : "bg-paper";
  const line = "border-b border-navy/20";
  return (
    <tr data-testid={`plan-row-${row.id}`} data-zebra={zebra ? "1" : "0"} className={bg}>
      <td
        className={`sticky left-0 z-10 w-64 min-w-64 px-2 py-1.5 text-left align-top ${bg} ${line} shadow-[2px_0_0_0_var(--color-line)]`}
      >
        <p className="text-sm font-semibold leading-snug break-words text-navy" data-testid={`plan-row-title-${row.id}`}>
          {row.title}
        </p>
        <input
          className="no-print mt-0.5 h-7 w-full bg-transparent text-xs text-muted outline-none"
          placeholder="Kommentar"
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          onBlur={onSaveComment}
          data-testid={`plan-comment-${row.id}`}
        />
        {comment ? <p className="print-only text-xs text-muted">{comment}</p> : null}
      </td>
      {weeks.map((w) =>
        w.days.map((ymd, i) => {
          const on = days.has(ymd);
          return (
            <td
              key={ymd}
              data-print-week={printWeeks.has(w.week) ? "1" : "0"}
              className={`p-0 ${bg} ${line} ${i === 0 ? "border-l border-line" : ""} ${ymd === today ? "plan-today" : ""}`}
            >
              <button
                type="button"
                onClick={() => onDay(ymd)}
                aria-pressed={on}
                data-testid={`plan-cell-${row.id}-${ymd}`}
                className={`block h-full min-h-12 w-9 ${on ? "bg-brick" : "bg-transparent"}`}
              />
            </td>
          );
        }),
      )}
    </tr>
  );
}
