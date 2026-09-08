import assert from "node:assert/strict";
import test from "node:test";
import { heuristicActions } from "./bot-actions.ts";
import {
  afterLookupAnswer,
  applyCorrection,
  confirmLine,
  heuristicTalk,
  isConfirm,
  isCorrection,
  labelDraft,
  speakLang,
} from "./bot-talk.ts";
import { EMPLOYEES, PROJECTS } from "./seed.ts";
import type { BotAction } from "./bot-actions.ts";

test("stål-spørgsmål opretter ikke TF — kun tilbud om tjek", () => {
  const turn = heuristicTalk({
    query: "Der er gammelt stål her, vi kan ikke komme videre. Hvad gør vi?",
    photoCount: 1,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, false);
  assert.equal(turn.drafts.length, 0);
  assert.ok(turn.offered.includes("udbud"));
  assert.match(turn.answer, /udbud|norm/i);
  assert.equal(isCorrection("Der er gammelt stål her, vi kan ikke komme videre. Hvad gør vi?"), false);
});

test("ja til tilbud kører tjek, opretter ikke", () => {
  const turn = heuristicTalk({
    query: "ja",
    photoCount: 0,
    drafts: [],
    offered: ["udbud", "web"],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, false);
  assert.deepEqual(turn.tools, ["udbud", "web"]);
});

test("TF og to-do til Marian bliver udkast, ikke execute", () => {
  const { actions } = heuristicActions(
    "Lav en TF til byggeledelsen med billedet, og en to-do til Marian om at fjerne det som ekstra",
    1,
    EMPLOYEES,
    PROJECTS,
  );
  assert.ok(actions.some((a) => a.type === "create_tf"));
  assert.ok(actions.some((a) => a.type === "create_todo"));
  assert.ok(!actions.some((a) => a.type === "create_slip"));
  const todo = actions.find((a) => a.type === "create_todo");
  if (todo?.type !== "create_todo") throw new Error("todo");
  assert.equal(todo.assigneeId, "emp-marius");
  const turn = heuristicTalk({
    query: "Lav en TF til byggeledelsen med billedet, og en to-do til Marian om at fjerne det som ekstra",
    photoCount: 1,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, false);
  assert.ok(turn.drafts.length >= 2);
});

test("billede alene laver ikke KS", () => {
  const { actions } = heuristicActions("her er billedet", 3, EMPLOYEES, PROJECTS);
  assert.equal(actions.length, 0);
});

test("gør det med udkast sætter execute", () => {
  const drafts: BotAction[] = [{ type: "create_tf", projectId: "job-hillerodsholm", question: "Stål?", title: "Stål" }];
  const turn = heuristicTalk({
    query: "Gør det",
    photoCount: 0,
    drafts,
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, true);
  assert.equal(turn.drafts.length, 1);
});

test("ja efter stål-note uden udkast foreslår TF og to-do", () => {
  const turn = heuristicTalk({
    query: "ja",
    photoCount: 1,
    drafts: [],
    offered: [],
    notes: ["Der er gammelt stål her, vi kan ikke komme videre."],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, false);
  assert.ok(turn.drafts.some((a) => a.type === "create_tf"));
  assert.ok(turn.drafts.some((a) => a.type === "create_todo"));
});

test("nej 200 mm ikke 180 retter udkastet", () => {
  const drafts: BotAction[] = [
    { type: "create_tf", projectId: "job-hillerodsholm", question: "Udsparing 180 mm i mur.", title: "Stål 180 mm" },
  ];
  const next = applyCorrection("nej, 200 mm ikke 180", drafts);
  assert.match(JSON.stringify(next), /200/);
  assert.doesNotMatch(JSON.stringify(next), /180/);
  assert.equal(isCorrection("nej, 200 mm ikke 180"), true);
  assert.equal(isConfirm("godkendt"), true);
  assert.equal(isConfirm("hvad gør vi"), false);
});

test("labelDraft og confirmLine er korte", () => {
  const s = labelDraft({ type: "create_todo", projectId: "job-hillerodsholm", title: "Fjern stål", assigneeId: "emp-marius", due: "2026-09-04" });
  assert.match(s, /Marius/);
  assert.match(s, /To-do/);
  const line = confirmLine(
    [
      { type: "create_tf", projectId: "job-hillerodsholm", question: "Stål", title: "Stål" },
      { type: "create_todo", projectId: "job-hillerodsholm", title: "Fjern", assigneeId: "emp-marius" },
    ],
    EMPLOYEES,
    ["Z-TF-2026-007"],
  );
  assert.match(line, /Z-TF-2026-007 oprettet/);
  assert.match(line, /Marius har to-doen/);
});

test("spansk spørgsmål får spansk tilbud", () => {
  assert.equal(speakLang("¿Qué hacemos con el acero?"), "es");
  const turn = heuristicTalk({
    query: "Hay acero viejo, no podemos seguir. ¿Qué hacemos?",
    photoCount: 0,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.match(turn.answer, /pliego|norma/i);
});

test("afterLookupAnswer slutter med spørgsmål om TF", () => {
  const line = afterLookupAnswer("Udbud: Bindere Ø4 rustfrit stål.", ["gammelt stål her"]);
  assert.match(line, /TF/);
  assert.match(line, /rustfrit stål/);
});

test("ugeplan med tre sager udføres når der står læg i planen", () => {
  const q = `Plan for næste uge Marius og Ole og Alex skal arbejde på sagen Islevvænge de skal pudse gavle og være færdig med dette mandag.

Tirsdag Marius skal ud til et lille sag der hedder Søren privat - opret en ny sag med det navn

Frederico og Osvaldo skal arbejde på et projekt der hedder Klostergården Hillerød - opret en ny sag der hedder dette

Ole og Alex skat til en sag der hedder Prøvestenen Frederiksværk- opret en sag der hedder dette.
De skal pudse kælder - tirsdag og onsdag

Lig at dette i planen`;
  const slim = PROJECTS.filter((p) => !["job-soren-privat", "job-klostergaarden", "job-provestenen"].includes(p.id));
  const turn = heuristicTalk({
    query: q,
    photoCount: 0,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: slim,
  });
  assert.equal(turn.execute, true);
  assert.ok(turn.drafts.filter((a) => a.type === "create_project").length >= 3);
  assert.ok(turn.drafts.some((a) => a.type === "set_plan" && a.employeeId === "emp-ole"));
  assert.ok(turn.drafts.some((a) => a.type === "set_plan" && a.employeeId === "emp-federico"));
  assert.ok(turn.drafts.some((a) => a.type === "set_plan" && a.employeeId === "emp-marius"));
  const mariusDays = turn.drafts.filter((a) => a.type === "set_plan" && a.employeeId === "emp-marius").map((a) => a.type === "set_plan" ? a.start : "");
  assert.ok(new Set(mariusDays).size >= 2);
  const again = heuristicTalk({
    query: q,
    photoCount: 0,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(again.execute, true);
  assert.equal(again.drafts.filter((a) => a.type === "create_project").length, 0);
  assert.ok(again.drafts.filter((a) => a.type === "set_plan").length >= 8);
});
