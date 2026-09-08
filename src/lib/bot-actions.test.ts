import assert from "node:assert/strict";
import test from "node:test";
import { buildHoursPack, heuristicActions, parseMonth } from "./bot-actions.ts";
import { EMPLOYEES, PROJECTS } from "./seed.ts";
import type { DayLog } from "./types.ts";

const now = new Date("2026-09-03T12:00:00+02:00");

test("dec i september bliver december året før", () => {
  const a = parseMonth("osvaldos timer for dec i hillerøds holm", now);
  assert.deepEqual(a, { year: 2025, month: 12 });
  const b = parseMonth("december på Hillerødsholm", now);
  assert.deepEqual(b, { year: 2025, month: 12 });
  assert.deepEqual(parseMonth("2025-12", now), { year: 2025, month: 12 });
});

test("KS altaner Hillerødsholm laver create_ks 5.4", () => {
  const { actions, answer } = heuristicActions("dette er ks på altaner hillerødsholm", 2, EMPLOYEES, PROJECTS);
  assert.equal(actions[0]?.type, "create_ks");
  if (actions[0]?.type !== "create_ks") throw new Error("expected create_ks");
  assert.equal(actions[0].projectId, "job-hillerodsholm");
  assert.equal(actions[0].point, "5.4");
  assert.match(answer, /KS 5\.4/);
});

test("Osvaldos timer december laver export_hours 2025-12", () => {
  const { actions } = heuristicActions(
    "giv mig en liste over alle Osvaldos timer for dec i hillerøds holm og lav et ark",
    0,
    EMPLOYEES,
    PROJECTS,
  );
  assert.equal(actions[0]?.type, "export_hours");
  if (actions[0]?.type !== "export_hours") throw new Error("expected export_hours");
  assert.equal(actions[0].employeeName, "Osvaldo");
  assert.equal(actions[0].projectId, "job-hillerodsholm");
  assert.equal(actions[0].month, "2025-12");
});

test("buildHoursPack summerer Osvaldo december på Hillerødsholm", () => {
  const days: Record<string, DayLog> = {};
  for (let d = 1; d <= 5; d++) {
    const date = `2025-12-0${d}`;
    days[`emp-osvaldo:${date}`] = {
      employeeId: "emp-osvaldo",
      date,
      projectId: "job-hillerodsholm",
      checkInAt: `${date}T06:05:00.000Z`,
      checkOutAt: `${date}T14:05:00.000Z`,
      pauseStartedAt: null,
      pauseMinutes: 30,
      photos: [],
      gpsInside: true,
      checkInGps: null,
      checkOutGps: null,
      demoGps: false,
      status: "ready",
    };
  }
  const pack = buildHoursPack(days, EMPLOYEES, PROJECTS, {
    employeeName: "Osvaldo",
    projectId: "job-hillerodsholm",
    month: "2025-12",
  });
  assert.equal(pack.days, 5);
  assert.equal(pack.rows.length, 5);
  assert.ok(pack.total > 35 && pack.total < 40);
  assert.match(pack.filename, /osvaldo/);
  assert.match(pack.filename, /hiller(oe|o)dsholm/);
  assert.match(pack.filename, /2025-12/);
});

test("Alex fuger Hillerødsholm mandag til onsdag lægger plan og to-do", () => {
  const { actions, answer } = heuristicActions("Alex fuger Hillerødsholm mandag til onsdag", 0, EMPLOYEES, PROJECTS);
  assert.equal(actions.length, 2);
  assert.equal(actions[0]?.type, "set_plan");
  if (actions[0]?.type !== "set_plan") throw new Error("expected set_plan");
  assert.equal(actions[0].employeeId, "emp-alex");
  assert.equal(actions[0].projectId, "job-hillerodsholm");
  assert.equal(actions[0].title, "Fugearbejde");
  assert.equal(actions[1]?.type, "create_todo");
  if (actions[1]?.type !== "create_todo") throw new Error("expected create_todo");
  assert.equal(actions[1].assigneeId, "emp-alex");
  assert.match(answer, /Alex/);
});

test("hele ugen filsning til Osvaldo", () => {
  const { actions } = heuristicActions("Osvaldo Hillerødsholm hele ugen, filsning", 0, EMPLOYEES, PROJECTS);
  const plan = actions.find((a) => a.type === "set_plan");
  assert.ok(plan);
  if (plan?.type !== "set_plan") throw new Error("expected set_plan");
  assert.equal(plan.employeeId, "emp-osvaldo");
  assert.equal(plan.title, "Filsning");
});

test("TF og to-do med ekstra laver ikke aftaleseddel", () => {
  const { actions } = heuristicActions(
    "Lav en TF til byggeledelsen med billedet, og en to-do til Marian om at fjerne det som ekstra",
    1,
    EMPLOYEES,
    PROJECTS,
  );
  assert.ok(actions.some((a) => a.type === "create_tf"));
  assert.ok(actions.some((a) => a.type === "create_todo"));
  assert.ok(!actions.some((a) => a.type === "create_slip"));
});
