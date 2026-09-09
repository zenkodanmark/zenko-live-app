import assert from "node:assert/strict";
import test from "node:test";
import {
  daysToRange,
  expandRange,
  gridWeeks,
  isGridPlan,
  isLedelseTodo,
  planDaysOf,
  printWeekNums,
  sortTodosForDropdown,
  toggleDay,
} from "./plan-grid.ts";
import type { Todo } from "./types.ts";

test("uge 32–37 ligger i gitteret", () => {
  const weeks = gridWeeks("2026-08-03", 12);
  assert.equal(weeks[0]?.week, 32);
  assert.equal(weeks[0]?.start, "2026-08-03");
  assert.equal(weeks[5]?.week, 37);
  assert.equal(weeks[5]?.start, "2026-09-07");
  assert.deepEqual(weeks[5]?.days.slice(2, 4), ["2026-09-09", "2026-09-10"]);
});

test("PDF tager 4 uger fra i dag", () => {
  const weeks = gridWeeks("2026-08-03", 12);
  const set = printWeekNums(weeks, "2026-09-09", 4);
  assert.deepEqual([...set].sort((a, b) => a - b), [37, 38, 39, 40]);
});

test("klik-dag slår til og fra", () => {
  assert.deepEqual(toggleDay([], "2026-09-09"), ["2026-09-09"]);
  assert.deepEqual(toggleDay(["2026-09-09"], "2026-09-10"), ["2026-09-09", "2026-09-10"]);
  assert.deepEqual(toggleDay(["2026-09-09", "2026-09-10"], "2026-09-09"), ["2026-09-10"]);
});

test("planDaysOf bruger days, ellers start–slut", () => {
  assert.deepEqual(planDaysOf({ days: ["2026-09-10", "2026-09-09"], start: "2026-09-07", end: "2026-09-11" }), [
    "2026-09-09",
    "2026-09-10",
  ]);
  assert.deepEqual(planDaysOf({ days: [], start: "2026-09-09", end: "2026-09-10" }), []);
  assert.deepEqual(planDaysOf({ start: "2026-09-09", end: "2026-09-10" }), ["2026-09-09", "2026-09-10"]);
  assert.deepEqual(daysToRange(["2026-09-10", "2026-09-09"]), { start: "2026-09-09", end: "2026-09-10" });
  assert.deepEqual(expandRange("2026-09-07", "2026-09-07"), ["2026-09-07"]);
  assert.deepEqual(expandRange("2026-09-09T12:00:00.000Z", "2026-09-10T22:00:00.000Z"), ["2026-09-09", "2026-09-10"]);
  assert.deepEqual(expandRange("", "2026-09-10"), []);
  assert.deepEqual(planDaysOf({ start: "2026-09-09T00:00:00.000Z", end: "2026-09-09T00:00:00.000Z" }), ["2026-09-09"]);
});

test("valgt to-do ligger nederst i dropdown", () => {
  const todos = [
    { id: "a", title: "A", done: false },
    { id: "b", title: "Ryd stillads", done: false },
    { id: "c", title: "C", done: false },
  ] as Todo[];
  const sorted = sortTodosForDropdown(todos, new Set(["b"]));
  assert.deepEqual(
    sorted.map((t) => t.id),
    ["a", "c", "b"],
  );
});

test("kun hakket to-do vises hos byggeleder", () => {
  assert.equal(isLedelseTodo({ ledelseStatus: "med_til_ledelse", done: false }), true);
  assert.equal(isLedelseTodo({ ledelseStatus: "skjult", done: false }), false);
  assert.equal(isLedelseTodo({ done: false }), false);
  assert.equal(isLedelseTodo({ ledelseStatus: "med_til_ledelse", done: true }), false);
});

test("mandskab-rækker er ikke uge-gitter", () => {
  assert.equal(isGridPlan({ source: "bot" }), false);
  assert.equal(isGridPlan({ source: "manual" }), false);
  assert.equal(isGridPlan({ source: "plan-grid" }), true);
  assert.equal(isGridPlan({ source: "manual", todoId: "td-1" }), true);
});
