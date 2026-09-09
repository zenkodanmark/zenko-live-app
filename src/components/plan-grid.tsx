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
} from "@/lib/plan-grid";
import { copenhagenDate } from "@/lib/seed";
import { useYard } from "@/lib/store";
import type { PlanBlock, Todo } from "@/lib/types";

function uniqueGridRows(rows: PlanBlock[]) {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .filter((row) => {
      const keys = [row.todoId ? `todo:${row.todoId}` : "", `title:${row.title}`].filter(Boolean);
      if (keys.some((k) => seen.has(k))) return false;
      for (const k of keys) seen.add(k);
      return true;
    });
}

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
  const patchTodo = useYard((s) => s.patchTodo);
  const pushNotice = useYard((s) => s.pushNotice);
  const plans = uniqueGridRows(allPlans.filter((p) => p.projectId === projectId && isGridPlan(p)));
  const jobTodos = allTodos.filter((t) => t.projectId === projectId && !t.done);
  const weeks = useMemo(() => gridWeeks("2026-08-03", 12), []);
  const today = copenhagenDate();
  const printWeeks = useMemo(() => printWeekNums(weeks, today, 4), [weeks, today]);
  const printLabel = [...printWeeks].sort((a, b) => a - b);
  const scroller = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = scroller.current?.querySelector('[data-week="37"]');
    el?.scrollIntoView({ inline: "start", block: "nearest", behavior: "instant" as ScrollBehavior });
  }, []);

  const usedIds = new Set(plans.map((p) => p.todoId).filter(Boolean) as string[]);
  const dropdownTodos = sortTodosForDropdown(
    mode === "ledelse" ? jobTodos.filter(isLedelseTodo) : jobTodos,
    usedIds,
  );
  const openRow = openId && openId !== "draft" ? (plans.find((p) => p.id === openId) ?? null) : null;

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

  function assignTodo(row: PlanBlock | null, todo: Todo) {
    const title = todo.title;
    const existing = plans.find((p) => p.todoId === todo.id);
    if (!row) {
      if (existing) {
        setOpenId(null);
        return;
      }
      const day = copenhagenDate();
      addPlan({
        projectId,
        title,
        start: day,
        end: day,
        days: [],
        todoId: todo.id,
        employeeId: firstMasterId(employees),
        source: "plan-grid",
      });
    } else {
      patchPlan(row.id, { todoId: todo.id, title });
    }
    setOpenId(null);
    pingMaster(`${title} · valgt`);
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

  function toggleHak(todo: Todo) {
    const next = todo.ledelseStatus === "med_til_ledelse" ? "skjult" : "med_til_ledelse";
    patchTodo(todo.id, { ledelseStatus: next });
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
    <section className="plan-a3-print bg-paper" data-testid="plan-grid">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3">
        <TabPng name="plan" px={48} />
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

      <div className="no-print flex flex-wrap items-end gap-2 px-3 pt-3">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Opret to-do</span>
          <input
            className="min-h-11 w-full rounded-xl bg-sand px-3 text-base outline-none"
            placeholder="Ny to-do"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            data-testid="plan-create"
          />
        </label>
        <PrimaryButton className="min-h-11 w-auto shrink-0 px-4" disabled={!draft.trim()} onClick={createTodo}>
          Opret
        </PrimaryButton>
      </div>

      {mode === "mester" ? (
        <ul className="no-print max-h-44 space-y-1.5 overflow-y-auto px-3 pt-3" data-testid="plan-hak-list">
          {jobTodos.length ? (
            jobTodos.map((td) => {
              const on = td.ledelseStatus === "med_til_ledelse";
              return (
                <li key={td.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleHak(td)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-moss text-sand" : "bg-sand text-ink"}`}
                    data-testid={`plan-hak-${td.id}`}
                    data-ledelse={on ? "on" : "off"}
                  >
                    Med til byggeledelse
                  </button>
                  <span className="min-w-0 truncate text-sm text-navy">{td.title}</span>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-muted">Ingen åbne to-dos på sagen.</li>
          )}
        </ul>
      ) : null}

      <div className="no-print px-3 pt-3">
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Vælg to-do til ny række</p>
        <button
          type="button"
          onClick={() => setOpenId(openId === "draft" ? null : "draft")}
          aria-expanded={openId === "draft"}
          className="flex min-h-11 w-full max-w-md items-center gap-2 rounded-xl bg-sand px-3 text-left"
          data-testid="plan-drop-draft"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">
            {openId === "draft" ? "Vælg to-do" : "Vælg to-do til ny række"}
          </span>
          <ChevronDown className={`size-6 shrink-0 text-navy ${openId === "draft" ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {openId ? (
        <div className="no-print px-3 pt-2" data-testid="plan-dropdown-wrap">
          <p className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {openId === "draft" ? "Vælg to-do til ny række" : `Vælg to-do · ${openRow?.title || "række"}`}
          </p>
          <ul className="mt-1 max-h-56 overflow-auto rounded-2xl bg-sand py-1" data-testid="plan-dropdown">
            {dropdownTodos.length ? (
              dropdownTodos.map((td) => {
                const used = usedIds.has(td.id);
                return (
                  <li key={td.id} className="flex items-center gap-1 px-1">
                    <button
                      type="button"
                      onClick={() => assignTodo(openId === "draft" ? null : openRow, td)}
                      className={`min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm ${used ? "bg-brick text-sand" : "text-navy"}`}
                      data-testid={`plan-todo-${td.id}`}
                      data-used={used ? "1" : "0"}
                    >
                      {td.title}
                    </button>
                    {mode === "mester" ? (
                      <button
                        type="button"
                        onClick={() => toggleHak(td)}
                        className={`mr-1 shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${td.ledelseStatus === "med_til_ledelse" ? "bg-moss text-sand" : "bg-sand text-ink"}`}
                        data-testid={`plan-drop-hak-${td.id}`}
                      >
                        Hak
                      </button>
                    ) : null}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-3 text-sm text-muted">Ingen to-do endnu.</li>
            )}
          </ul>
        </div>
      ) : null}

      <div ref={scroller} className="mt-3 overflow-x-auto overscroll-x-contain touch-pan-x pb-2">
        <table className="w-max min-w-full border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[12rem] bg-paper px-2 py-1 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                Opgave
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  colSpan={7}
                  data-week={w.week}
                  data-print-week={printWeeks.has(w.week) ? "1" : "0"}
                  className="border-l border-line px-0 py-1 text-sm font-semibold text-navy"
                >
                  uge {w.week}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-paper" />
              {weeks.map((w) =>
                DAY_LETTERS.map((letter, i) => (
                  <th
                    key={`${w.week}-${i}`}
                    data-print-week={printWeeks.has(w.week) ? "1" : "0"}
                    data-today={w.days[i] === today ? "1" : undefined}
                    className={`w-9 py-0.5 text-[10px] font-semibold text-muted ${i === 0 ? "border-l border-line" : ""} ${w.days[i] === today ? "plan-today" : ""}`}
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
                onOpen={() => setOpenId(openId === row.id ? null : row.id)}
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
  onOpen: () => void;
  comment: string;
  onComment: (v: string) => void;
  onSaveComment: () => void;
  onDay: (ymd: string) => void;
}) {
  const days = row ? new Set(planDaysOf(row)) : new Set<string>();
  const title = row?.title || "Vælg to-do";
  const sticky = zebra ? "bg-sand-deep" : "bg-paper";
  return (
    <tr
      data-testid={row ? `plan-row-${row.id}` : "plan-row-draft"}
      className={`border-b border-line ${zebra ? "bg-sand-deep" : "bg-paper"}`}
    >
      <td className={`sticky left-0 z-10 min-w-[12rem] max-w-[14rem] px-1 py-1.5 text-left align-top ${sticky}`}>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="no-print flex min-h-11 w-full items-center gap-1 rounded-xl bg-sand/80 px-2 py-1.5 text-left"
          data-testid={row ? `plan-drop-${row.id}` : "plan-drop-row-draft"}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{title}</span>
          <ChevronDown className={`size-5 shrink-0 text-navy ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <p className="print-only px-1 text-sm font-semibold text-navy">{title}</p>
        {row ? (
          <>
            <input
              className="no-print mt-1 min-h-9 w-full rounded-lg bg-sand px-2 text-sm outline-none"
              placeholder="Kommentar"
              value={comment}
              onChange={(e) => onComment(e.target.value)}
              onBlur={onSaveComment}
              data-testid={`plan-comment-${row.id}`}
            />
            {comment ? <p className="print-only px-1 text-xs text-muted">{comment}</p> : null}
          </>
        ) : null}
      </td>
      {weeks.map((w) =>
        w.days.map((ymd, i) => {
          const on = days.has(ymd);
          return (
            <td
              key={ymd}
              data-print-week={printWeeks.has(w.week) ? "1" : "0"}
              className={`p-0 ${i === 0 ? "border-l border-line" : ""} ${ymd === today ? "plan-today" : ""}`}
            >
              <button
                type="button"
                disabled={!row}
                onClick={() => onDay(ymd)}
                aria-pressed={on}
                data-testid={row ? `plan-cell-${row.id}-${ymd}` : undefined}
                className={`block h-11 w-9 ${on ? "bg-brick" : "bg-transparent"} ${!row ? "opacity-40" : ""}`}
              />
            </td>
          );
        }),
      )}
    </tr>
  );
}
