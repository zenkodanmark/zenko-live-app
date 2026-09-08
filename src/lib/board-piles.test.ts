import assert from "node:assert/strict";
import test from "node:test";
import { inboxToPile, isNewFromChat, pileHasNewFromChat, pileLabelKey, pileSeenKey } from "./board-piles.ts";
import { shownText, shownTodoText, listChatRows } from "./chat.ts";
import { t } from "./i18n.ts";
import type { Assignment, ChatMessage, Employee, Todo } from "./types.ts";

test("To-do ER TF AS KS MA mapper rigtigt", () => {
  assert.equal(inboxToPile("todo"), "todo");
  assert.equal(inboxToPile("ent"), "ent");
  assert.equal(inboxToPile("tf"), "tf");
  assert.equal(inboxToPile("extra"), "extra");
  assert.equal(inboxToPile("ks"), "ks");
  assert.equal(inboxToPile("materials"), "materials");
  assert.equal(t("da", pileLabelKey("todo")), "To-do");
  assert.equal(t("da", pileLabelKey("ent")), "ER");
  assert.equal(t("da", pileLabelKey("extra")), "AS");
  assert.equal(t("da", pileLabelKey("materials")), "MA");
});

test("rød prik kun ved nyt fra chat", () => {
  assert.equal(isNewFromChat("2026-09-05T12:00:00.000Z", true, ""), true);
  assert.equal(isNewFromChat("2026-09-05T12:00:00.000Z", true, "2026-09-05T13:00:00.000Z"), false);
  assert.equal(isNewFromChat("2026-09-05T12:00:00.000Z", false, ""), false);
  assert.equal(
    pileHasNewFromChat({
      pile: "ks",
      employeeId: "emp-ole",
      seenAt: {},
      todos: [],
      ents: [],
      tfs: [],
      slips: [],
      ks: [{ id: "k1", number: "Z-KS-1", projectId: "job-hillerodsholm", point: "div", createdAt: "2026-09-05T12:00:00.000Z", status: "issued", fromChatId: "ch-1" }],
      needs: [],
      chats: [],
    }),
    true,
  );
  assert.equal(pileSeenKey("emp-ole", "ks"), "emp-ole::ks");
});

const ion: Employee = { id: "emp-ion", name: "Ion", role: "svend", language: "ro", pin: "3333", initials: "IZ" };
const ole: Employee = { id: "emp-ole", name: "Ole", role: "mester", language: "da", pin: "7777", initials: "OL" };
const fede: Employee = { id: "emp-federico", name: "Federico", role: "mester", language: "es", pin: "2222", initials: "FE" };
const assignments: Assignment[] = [{ employeeId: "emp-ion", projectId: "job-hillerodsholm" }];

test("visningssprog: Ole dansk, Ion rumænsk, Federico spansk — også i oversigten", () => {
  const row: ChatMessage = {
    id: "ch-1",
    at: "2026-09-05T08:00:00.000Z",
    fromId: "emp-ole",
    to: { kind: "employee", id: "emp-ion" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului", es: "Limpia detrás del cobertizo" },
    viaVoice: false,
    threadId: "thr-1",
  };
  assert.equal(shownText(row, "da", "mester"), "Ryd bag skuret");
  assert.equal(shownText(row, "ro", "svend"), "Curăță în spatele șopronului");
  assert.equal(shownText(row, "es", "mester"), "Ryd bag skuret");
  const ionRows = listChatRows([row], [], [ion, ole, fede], ion, assignments, {});
  assert.equal(ionRows.active[0]?.title, "Curăță în spatele șopronului");
  const oleRows = listChatRows([row], [], [ion, ole, fede], ole, assignments, {});
  assert.equal(oleRows.active[0]?.title, "Ryd bag skuret");
});

test("to-do-kort følger brugerens sprog", () => {
  const todo = {
    id: "td-1",
    title: "Ryd bag skuret",
    body: "Ryd bag skuret",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului", es: "Limpia detrás del cobertizo" },
  } as Todo;
  assert.equal(shownTodoText(todo, "ro", "svend"), "Curăță în spatele șopronului");
  assert.equal(shownTodoText(todo, "es", "mester"), "Limpia detrás del cobertizo");
  assert.equal(shownTodoText(todo, "da", "mester"), "Ryd bag skuret");
});
