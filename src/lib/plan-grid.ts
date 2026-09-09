import { addDaysYmd, isoWeek, startOfIsoWeek, weekDays } from "./plan.ts";
import { copenhagenDate } from "./seed.ts";
import type { PlanBlock, Todo } from "./types.ts";

export const DAY_LETTERS = ["M", "T", "O", "T", "F", "L", "S"] as const;

export function ymdOf(v?: string): string {
  const s = (v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function expandRange(start: string, end: string): string[] {
  const a = ymdOf(start);
  if (!a) return [];
  const b = ymdOf(end);
  const stop = b && b >= a ? b : a;
  const out = [a];
  let d = a;
  while (d < stop) {
    d = addDaysYmd(d, 1);
    out.push(d);
  }
  return out;
}

export function planDaysOf(p: Pick<PlanBlock, "days" | "start" | "end">): string[] {
  if (Array.isArray(p.days)) return [...new Set(p.days.map(ymdOf).filter(Boolean))].sort();
  if (ymdOf(p.start)) return expandRange(p.start, p.end || p.start);
  return [];
}

export function daysToRange(days: string[]): { start: string; end: string } {
  const s = [...new Set(days.map(ymdOf).filter(Boolean))].sort();
  if (!s.length) return { start: "", end: "" };
  return { start: s[0]!, end: s[s.length - 1]! };
}

export function toggleDay(days: string[], ymd: string): string[] {
  const day = ymdOf(ymd);
  if (!day) return [...new Set(days.map(ymdOf).filter(Boolean))].sort();
  const set = new Set(days.map(ymdOf).filter(Boolean));
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return [...set].sort();
}

export type GridWeek = { week: number; start: string; days: string[] };

export function gridWeeks(anchor = "2026-08-03", count = 12): GridWeek[] {
  const start = startOfIsoWeek(anchor);
  return Array.from({ length: count }, (_, i) => {
    const s = addDaysYmd(start, i * 7);
    return { week: isoWeek(s), start: s, days: weekDays(s) };
  });
}

export function printWeekNums(weeks: GridWeek[], today = copenhagenDate(), count = 4): Set<number> {
  const current = isoWeek(today);
  const i = weeks.findIndex((w) => w.week === current);
  const slice = (i >= 0 ? weeks.slice(i, i + count) : weeks.slice(0, count)).slice(0, count);
  if (slice.length < count && weeks.length) {
    const start = Math.max(0, weeks.length - count);
    return new Set(weeks.slice(start).map((w) => w.week));
  }
  return new Set(slice.map((w) => w.week));
}

export function isGridPlan(p: Pick<PlanBlock, "source" | "todoId">) {
  return p.source === "plan-grid" || Boolean(p.todoId);
}

export function isLedelseTodo(t: Pick<Todo, "ledelseStatus" | "done">) {
  return t.ledelseStatus === "med_til_ledelse" && !t.done;
}

export function sortTodosForDropdown(todos: Todo[], usedIds: Set<string>): Todo[] {
  const open = todos.filter((t) => !t.done);
  const unused = open.filter((t) => !usedIds.has(t.id));
  const used = open.filter((t) => usedIds.has(t.id));
  return [...unused, ...used];
}

export function uniqueGridRows(rows: PlanBlock[]): PlanBlock[] {
  const seen = new Set<string>();
  const newest = [...rows].sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "") || a.id.localeCompare(b.id),
  );
  const unique = newest.filter((row) => {
    const keys = [row.todoId ? `todo:${row.todoId}` : "", `title:${(row.title || "").trim().toLowerCase()}`].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    for (const k of keys) seen.add(k);
    return true;
  });
  return unique.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") || a.id.localeCompare(b.id));
}

export function visibleGridPlans(
  rows: PlanBlock[],
  todos: Pick<Todo, "id" | "title" | "ledelseStatus" | "done">[],
): PlanBlock[] {
  const hakked = todos.filter(isLedelseTodo);
  const ids = new Set(hakked.map((t) => t.id));
  const titles = new Set(hakked.map((t) => t.title.trim().toLowerCase()));
  return uniqueGridRows(
    rows.filter((p) => {
      if (p.todoId) return ids.has(p.todoId);
      return titles.has((p.title || "").trim().toLowerCase());
    }),
  );
}

export function firstMasterId(employees: { id: string; role: string }[]) {
  return employees.find((e) => e.role === "mester")?.id || "emp-ole";
}
