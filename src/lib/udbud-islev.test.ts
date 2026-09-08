import assert from "node:assert/strict";
import test from "node:test";
import { heuristicActions } from "./bot-actions.ts";
import { confirmLine, heuristicTalk, wantsArchive, wantsLookup } from "./bot-talk.ts";
import { snippetFromCorpus } from "./udbud-corpus.ts";
import { answerDocs } from "./seed.ts";
import { EMPLOYEES, PROJECTS } from "./seed.ts";

const q = `Her er beskrivelse på Islevvænge på murer og tag beskrivelse, som vi udføre, arkivere dem ind på sagen så de ansatte kan søge og spørge ind til det`;

test("Islevvænge fuger 20 mm KC 50/50/700", () => {
  const hit = snippetFromCorpus("job-islevvaenge", "hvor dybt skal fuger udkradses og hvilken mørtel");
  assert.ok(hit);
  assert.match(hit!.excerpt + hit!.name, /20 mm/i);
  assert.match(hit!.excerpt + hit!.name + (hit?.title ?? ""), /Zmur|50\/50\/700|fuge/i);
});

test("Islevvænge puds gavle Fortvej", () => {
  const hit = snippetFromCorpus("job-islevvaenge", "puds gavle røde huse Fortvej");
  assert.ok(hit);
  assert.match((hit!.excerpt + " " + hit!.name).toLowerCase(), /gavl|fortvej|filts|vandskur|puds/);
});

test("Islevvænge skorsten 85 procent omfug", () => {
  const hit = snippetFromCorpus("job-islevvaenge", "hvordan udbedres skorstenene");
  assert.ok(hit);
  assert.match(hit!.name, /Ztag/i);
  assert.match(hit!.excerpt, /85|omfug|skorsten/i);
});

test("answerDocs Islev rammer ikke Hillerødsholm-bindere", () => {
  const a = answerDocs("fuger mørtel", "job-islevvaenge");
  assert.ok(a);
  assert.match(a!.line, /KC 50\/50\/700|20 mm|Islev|Zmur/i);
  assert.doesNotMatch(a!.line, /Hillerødsholm|Ø4 rustfri/);
});

test("bot arkiverer murer og tag på Islevvænge", () => {
  assert.equal(wantsArchive(q), true);
  assert.equal(wantsLookup(q), false);
  const { actions, answer } = heuristicActions(q, 0, EMPLOYEES, PROJECTS);
  assert.equal(actions[0]?.type, "create_note");
  if (actions[0]?.type !== "create_note") throw new Error("note");
  assert.equal(actions[0].projectId, "job-islevvaenge");
  assert.match(answer, /Islevvænge/);
  const turn = heuristicTalk({
    query: q,
    photoCount: 0,
    drafts: [],
    offered: [],
    employees: EMPLOYEES,
    projects: PROJECTS,
  });
  assert.equal(turn.execute, true);
  assert.match(confirmLine(turn.drafts), /Murer og tag ligger på Islevvænge/);
});
