import assert from "node:assert/strict";
import test from "node:test";
import { chatTargetLabel, chatVisible, goesToMaster, listChatRows, shownText, shownTodoText, targetEmployeeIds, unsavedOnNewMessage } from "./chat.ts";
import { t } from "./i18n.ts";
import type { Assignment, ChatMessage, ChatThread, Employee, Todo } from "./types.ts";

const alex: Employee = { id: "emp-alex", name: "Alex", role: "laerling", language: "da", pin: "1111", initials: "AL" };
const ion: Employee = { id: "emp-ion", name: "Ion Zafier", role: "svend", language: "ro", pin: "3333", initials: "IZ" };
const marius: Employee = { id: "emp-marius", name: "Marius Pater", role: "svend", language: "pl", pin: "4444", initials: "MP" };
const ole: Employee = { id: "emp-ole", name: "Ole", role: "mester", language: "da", pin: "7777", initials: "OL" };
const fede: Employee = { id: "emp-federico", name: "Federico", role: "mester", language: "es", pin: "2222", initials: "FE" };
const people = [alex, ion, marius, ole, fede];
const assignments: Assignment[] = [
  { employeeId: "emp-alex", projectId: "job-hillerodsholm" },
  { employeeId: "emp-ion", projectId: "job-hillerodsholm" },
  { employeeId: "emp-marius", projectId: "job-hillerodsholm" },
];

function msg(to: ChatMessage["to"], fromId = "emp-alex"): ChatMessage {
  return {
    id: "ch-1",
    at: "2026-09-05T08:00:00.000Z",
    fromId,
    to,
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret" },
    viaVoice: false,
  };
}

test("besked til flere på sagen vises hos alle valgte", () => {
  const row = msg({ kind: "employees", ids: ["emp-ion", "emp-marius"] });
  assert.equal(chatVisible(row, ion, assignments), true);
  assert.equal(chatVisible(row, marius, assignments), true);
  assert.equal(chatVisible(row, alex, assignments), true);
  assert.deepEqual(targetEmployeeIds(row.to), ["emp-ion", "emp-marius"]);
  assert.equal(chatTargetLabel(row.to, people, "Alle", "Mester"), "Ion Zafier, Marius Pater");
});

test("besked til Ion når ikke Marius", () => {
  const row = msg({ kind: "employee", id: "emp-ion" });
  assert.equal(chatVisible(row, ion, assignments), true);
  assert.equal(chatVisible(row, marius, assignments), false);
});

test("mester ser kun beskeder til sig som person", () => {
  const row = msg({ kind: "employees", ids: ["emp-ole", "emp-ion"] });
  assert.equal(goesToMaster(row.to, people), true);
  assert.equal(chatVisible(row, ole, assignments), true);
  assert.equal(chatVisible(row, fede, assignments), false);
});

test("Ole ser ikke Ions private tråd", () => {
  const row = msg({ kind: "employee", id: "emp-ion" }, "emp-alex");
  assert.equal(chatVisible(row, ole, assignments), false);
  assert.equal(chatVisible(row, ion, assignments), true);
});

test("besked til Ole som person vises hos Ole, ikke Federico", () => {
  const row = msg({ kind: "employee", id: "emp-ole" }, "emp-alex");
  assert.equal(chatVisible(row, ole, assignments), true);
  assert.equal(chatVisible(row, fede, assignments), false);
});

test("legacy masters-mål vises hos begge mestre", () => {
  const row = msg({ kind: "masters" });
  assert.equal(chatVisible(row, ole, assignments), true);
  assert.equal(chatVisible(row, fede, assignments), true);
  assert.equal(chatVisible(row, ion, assignments), false);
});

test("visningssprog: Ion rumænsk, Federico spansk, Ole dansk", () => {
  const row: ChatMessage = {
    ...msg({ kind: "employees", ids: ["emp-ion"] }, "emp-ole"),
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului", es: "Limpia detrás del cobertizo" },
  };
  assert.equal(shownText(row, "ro", "svend"), "Curăță în spatele șopronului");
  assert.equal(shownText(row, "es", "svend"), "Limpia detrás del cobertizo");
  assert.equal(shownText(row, "es", "mester"), "Ryd bag skuret");
  assert.equal(shownText(row, "da", "mester"), "Ryd bag skuret");
});

test("Fjern chat skjuler kun hos den ansatte", () => {
  const row = { ...msg({ kind: "employees", ids: ["emp-ole", "emp-ion"] }), hiddenBy: ["emp-ion"] };
  assert.equal(chatVisible(row, ion, assignments), false);
  assert.equal(chatVisible(row, ole, assignments), true);
});

test("ansat ser ikke andres tråd", () => {
  const row = msg({ kind: "employee", id: "emp-ion" }, "emp-ole");
  assert.equal(chatVisible(row, marius, assignments), false);
  assert.equal(chatVisible(row, ion, assignments), true);
});

test("Ion UI: Udført og Fjern chat er rumænsk", () => {
  assert.equal(t("ro", "todoDoneMark"), "Efectuat");
  assert.notEqual(t("ro", "todoDoneMark"), "Udført");
  assert.equal(t("ro", "chatRemove"), "Șterge chatul");
  assert.equal(t("es", "chatRemove"), "Quitar chat");
  assert.equal(t("pl", "chatRemove"), "Usuń czat");
  assert.equal(t("da", "chatOriginalLink"), "Original");
});

test("Gem chat oversættes på alle sprog — ikke ordet tråd", () => {
  assert.equal(t("da", "chatSave"), "Gem chat");
  assert.equal(t("ro", "chatSave"), "Salvează chat");
  assert.equal(t("es", "chatSave"), "Guardar chat");
  assert.equal(t("pl", "chatSave"), "Zapisz czat");
  assert.equal(t("uk", "chatSave"), "Зберегти чат");
  assert.equal(t("de", "chatSave"), "Chat speichern");
  assert.equal(t("en", "chatSave"), "Save chat");
  assert.equal(t("da", "chatNew"), "Ny chat");
  assert.equal(t("da", "chatSaved"), "Gemte");
  assert.equal(t("da", "chatOpen"), "Åbn chat");
  assert.equal(/tråd/i.test(t("da", "chatSave")), false);
  assert.equal(/tråd/i.test(t("da", "chatSaved")), false);
});

test("to-do-tekst vises på ansatens sprog", () => {
  const todo = {
    id: "td-1",
    title: "Ryd bag skuret",
    body: "Ryd bag skuret",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului" },
  } as Todo;
  assert.equal(shownTodoText(todo, "ro", "svend"), "Curăță în spatele șopronului");
  assert.equal(shownTodoText(todo, "da", "mester"), "Ryd bag skuret");
});

test("kan sende to-do til sig selv", () => {
  assert.deepEqual(targetEmployeeIds({ kind: "employee", id: "emp-alex" }), ["emp-alex"]);
  const row = msg({ kind: "employee", id: "emp-alex" }, "emp-alex");
  assert.equal(chatVisible(row, alex, assignments), true);
});

test("ulæst chat er rød på listen indtil tråden åbnes", () => {
  const a = msg({ kind: "employee", id: "emp-ole" });
  a.id = "ch-new";
  a.threadId = "thr-new";
  a.fromId = "emp-alex";
  const rows = listChatRows([a], [{ id: "thr-new", title: "Hej", rootId: "ch-new", projectId: "job-hillerodsholm", createdAt: a.at }], people, ole, assignments, {});
  assert.equal(rows.active[0]?.unread, 1);
  assert.equal(rows.active[0]?.peopleLabel, "Alex");
  assert.deepEqual(rows.active[0]?.peopleIds, ["emp-alex"]);
  const seen = listChatRows([a], [{ id: "thr-new", title: "Hej", rootId: "ch-new", projectId: "job-hillerodsholm", createdAt: a.at }], people, ole, assignments, { "emp-ole::thr-new": "2026-09-05T12:00:00.000Z" });
  assert.equal(seen.active[0]?.unread, 0);
});

test("aktive chat og gemte chat deles på savedAt", () => {
  const a = msg({ kind: "employee", id: "emp-ole" });
  a.id = "ch-active";
  a.threadId = "thr-a";
  const b: ChatMessage = { ...msg({ kind: "employee", id: "emp-ion" }), id: "ch-saved", threadId: "thr-b", at: "2026-09-05T09:00:00.000Z" };
  const threads: ChatThread[] = [
    { id: "thr-a", title: "Aktiv", rootId: "ch-active", projectId: "job-hillerodsholm", createdAt: a.at },
    { id: "thr-b", title: "Gemt", rootId: "ch-saved", projectId: "job-hillerodsholm", createdAt: b.at, savedAt: b.at },
  ];
  const rows = listChatRows([a, b], threads, people, alex, assignments);
  assert.equal(rows.active.some((r) => r.id === "thr-a"), true);
  assert.equal(rows.saved.some((r) => r.id === "thr-b"), true);
  assert.equal(rows.active.some((r) => r.id === "thr-b"), false);
});

test("nyeste tråd ligger øverst også når en ældre er ulæst", () => {
  const oldUnread: ChatMessage = { ...msg({ kind: "employee", id: "emp-ole" }), id: "ch-old", threadId: "thr-old", at: "2026-09-05T08:00:00.000Z", fromId: "emp-alex" };
  const newer: ChatMessage = { ...msg({ kind: "employee", id: "emp-ole" }), id: "ch-new", threadId: "thr-new", at: "2026-09-05T12:00:00.000Z", fromId: "emp-ole" };
  const threads: ChatThread[] = [
    { id: "thr-old", title: "Gammel", rootId: "ch-old", projectId: "job-hillerodsholm", createdAt: oldUnread.at },
    { id: "thr-new", title: "Ny", rootId: "ch-new", projectId: "job-hillerodsholm", createdAt: newer.at },
  ];
  const rows = listChatRows([oldUnread, newer], threads, people, ole, assignments, {});
  assert.equal(rows.active[0]?.id, "thr-new");
  assert.equal(rows.active[1]?.id, "thr-old");
  assert.equal(rows.active[1]?.unread, 1);
});

test("ny besked løfter gemt tråd op på aktiv", () => {
  const threads: ChatThread[] = [
    { id: "thr-b", title: "Gemt", rootId: "ch-saved", projectId: "job-hillerodsholm", createdAt: "2026-09-05T09:00:00.000Z", savedAt: "2026-09-05T09:00:00.000Z" },
  ];
  const lifted = unsavedOnNewMessage(threads, "thr-b");
  assert.equal(lifted[0]?.savedAt, undefined);
  const stay = unsavedOnNewMessage(threads, "thr-other");
  assert.equal(stay[0]?.savedAt, threads[0]?.savedAt);
});
