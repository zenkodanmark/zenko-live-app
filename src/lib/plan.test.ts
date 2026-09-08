import assert from "node:assert/strict";
import test from "node:test";
import {
  barSpan,
  extractJobName,
  isoWeek,
  looksLikePlan,
  parseDaysList,
  parsePlanRange,
  parseWeekPlan,
  planCoversPerson,
  planPlaceLabel,
  planWorkTitle,
  rangesFromDays,
  resolvePlanPlace,
  startOfIsoWeek,
  weekStartForPerson,
} from "./plan.ts";
import { EMPLOYEES, PROJECTS, ensureBotWeek37, mergeAliasJobs, SEED_PLANS, projectById } from "./seed.ts";
import type { PlanBlock } from "./types.ts";

const friday = "2026-09-04";

test("iso uge 36 starter mandag 31. aug", () => {
  assert.equal(startOfIsoWeek(friday), "2026-08-31");
  assert.equal(isoWeek(friday), 36);
});

test("mandag til onsdag der er passeret rykker til næste uge", () => {
  const r = parsePlanRange("Alex fuger Hillerødsholm mandag til onsdag", friday);
  assert.deepEqual(r, { start: "2026-09-07", end: "2026-09-09" });
});

test("hele ugen er man–fre i indeværende uge", () => {
  const r = parsePlanRange("Osvaldo Hillerødsholm hele ugen, filsning", friday);
  assert.deepEqual(r, { start: "2026-08-31", end: "2026-09-04" });
});

test("i morgen er lørdag når i dag er fredag", () => {
  const r = parsePlanRange("Ion Islevvænge i morgen", friday);
  assert.deepEqual(r, { start: "2026-09-05", end: "2026-09-05" });
});

test("uge 37 tager den nævnte uge", () => {
  const r = parsePlanRange("Alex Hillerødsholm uge 37 mandag til fredag", friday);
  assert.deepEqual(r, { start: "2026-09-07", end: "2026-09-11" });
});

test("planWorkTitle og looksLikePlan", () => {
  assert.equal(planWorkTitle("Alex fuger Hillerødsholm mandag til onsdag"), "Fugearbejde");
  assert.equal(planWorkTitle("Osvaldo hele ugen filsning"), "Filsning");
  assert.equal(looksLikePlan("Alex fuger Hillerødsholm mandag til onsdag"), true);
  assert.equal(looksLikePlan("giv mig timer for december"), false);
});

test("barSpan klipper til den viste uge", () => {
  const block: PlanBlock = {
    id: "pl-1",
    employeeId: "emp-alex",
    projectId: "job-hillerodsholm",
    title: "Fugearbejde",
    start: "2026-09-07",
    end: "2026-09-09",
    createdAt: "",
    createdBy: "emp-ole",
    source: "bot",
  };
  const span = barSpan(block, "2026-09-07");
  assert.deepEqual(span, { col: 0, span: 3 });
  assert.equal(barSpan(block, "2026-08-31"), null);
});

test("næste uge mandag er 7. sep når i dag er fredag uge 36", () => {
  const r = parsePlanRange("næste uge mandag", friday);
  assert.deepEqual(r, { start: "2026-09-07", end: "2026-09-07" });
  const tirsOns = parsePlanRange("næste uge tirsdag og onsdag", friday);
  assert.deepEqual(tirsOns, { start: "2026-09-08", end: "2026-09-09" });
});

test("ugeplan med tre nye sager parser rigtigt", () => {
  const q = `Plan for næste uge Marius og Ole og Alex skal arbejde på sagen Islevvænge de skal pudse gavle og være færdig med dette mandag.

Tirsdag Marius skal ud til et lille sag der hedder Søren privat - opret en ny sag med det navn

Frederico og Osvaldo skal arbejde på et projekt der hedder Klostergården Hillerød - opret en ny sag der hedder dette

Ole og Alex skat til en sag der hedder Prøvestenen Frederiksværk- opret en sag der hedder dette.
De skal pudse kælder - tirsdag og onsdag

Lig at dette i planen`;
  assert.equal(extractJobName("et lille sag der hedder Søren privat - opret en ny sag med det navn"), "Søren privat");
  const week = parseWeekPlan(q, EMPLOYEES, PROJECTS, friday);
  assert.ok(week.length >= 4, `chunks ${week.length} ${JSON.stringify(week.map((c) => c.projectName))}`);
  const islev = week.find((c) => /islev/i.test(c.projectName));
  assert.ok(islev);
});

test("rangesFromDays slår man+tir sammen og holder ons alene", () => {
  assert.deepEqual(rangesFromDays(["2026-09-07", "2026-09-08", "2026-09-10"]), [
    { start: "2026-09-07", end: "2026-09-08" },
    { start: "2026-09-10", end: "2026-09-10" },
  ]);
});

test("sted kan være lager uden sag", () => {
  const lager = resolvePlanPlace("Lager", PROJECTS);
  assert.equal(lager.projectId, "sted-lager");
  assert.equal(planPlaceLabel({ projectId: "sted-lager", title: "Hent mørtel" }), "Lager");
  const job = resolvePlanPlace("Hillerødsholm", PROJECTS);
  assert.equal(job.projectId, "job-hillerodsholm");
});

test("parseDaysList tager man og tir", () => {
  const days = parseDaysList("mandag og tirsdag", "2026-09-07");
  assert.deepEqual(days, ["2026-09-07", "2026-09-08"]);
});

test("én plan-linje dækker flere personer", () => {
  const block: PlanBlock = {
    id: "pl-multi",
    employeeId: "emp-alex",
    employeeIds: ["emp-alex", "emp-ion", "emp-marius"],
    projectId: "sted-lager",
    title: "Ryd lager",
    start: "2026-08-31",
    end: "2026-08-31",
    createdAt: "",
    createdBy: "emp-ole",
    source: "manual",
  };
  assert.equal(planCoversPerson(block, "emp-alex"), true);
  assert.equal(planCoversPerson(block, "emp-ion"), true);
  assert.equal(planCoversPerson(block, "emp-marius"), true);
  assert.equal(planCoversPerson(block, "emp-ole"), false);
});

test("ansats uge starter på den uge der har plan", () => {
  assert.equal(weekStartForPerson(SEED_PLANS, "emp-alex", "2026-09-05"), "2026-09-07");
  assert.equal(weekStartForPerson(SEED_PLANS, "emp-alex", "2026-09-07"), "2026-09-07");
});
