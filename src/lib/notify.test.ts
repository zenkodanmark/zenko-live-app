import assert from "node:assert/strict";
import test from "node:test";
import { chatRecipientIds, masterIds, noticeForMaShare, noticesFromDiff, unreadNotices } from "./notify.ts";
import type { Assignment, ChatMessage, Employee, KsReport, Todo } from "./types.ts";

const alex: Employee = { id: "emp-alex", name: "Alex", role: "laerling", language: "da", pin: "1111", initials: "AL" };
const ole: Employee = { id: "emp-ole", name: "Ole", role: "mester", language: "da", pin: "7777", initials: "OL" };
const fede: Employee = { id: "emp-federico", name: "Federico", role: "mester", language: "es", pin: "2222", initials: "FE" };
const people = [alex, ole, fede];
const assignments: Assignment[] = [{ employeeId: "emp-alex", projectId: "job-hillerodsholm" }];
const empty = { ksReports: [] as KsReport[], chats: [] as ChatMessage[], todos: [] as Todo[], employees: people, assignments };

test("mestre får notifikation når ansat opretter KS", () => {
  const row: KsReport = {
    id: "ksr-new",
    number: "Z-KS-2026-009",
    projectId: "job-provestenen",
    point: "5.5",
    createdAt: "2026-09-05T18:00:00.000Z",
    status: "issued",
    employeeId: "emp-alex",
    employeeName: "Alex",
  };
  const notes = noticesFromDiff(empty, { ...empty, ksReports: [row] }, "2026-09-05T17:00:00.000Z");
  assert.equal(notes.length, 1);
  assert.equal(notes[0]?.kind, "ks");
  assert.deepEqual(notes[0]?.toIds.slice().sort(), ["emp-federico", "emp-ole"]);
  assert.equal(notes[0]?.fromId, "emp-alex");
  assert.equal(unreadNotices(notes, "emp-ole").length, 1);
  assert.equal(unreadNotices(notes, "emp-alex").length, 0);
});

test("gammel KS fra seed laver ikke notifikation", () => {
  const row: KsReport = {
    id: "ksr-old",
    number: "Z-KS-2026-001",
    projectId: "job-hillerodsholm",
    point: "5.5",
    createdAt: "2026-09-01T08:00:00.000Z",
    status: "issued",
    employeeId: "emp-alex",
  };
  const notes = noticesFromDiff(empty, { ...empty, ksReports: [row] }, "2026-09-05T17:00:00.000Z");
  assert.equal(notes.length, 0);
});

test("chat går til valgte personer, ikke afsender", () => {
  const msg: ChatMessage = {
    id: "ch-n",
    at: "2026-09-05T18:01:00.000Z",
    fromId: "emp-alex",
    to: { kind: "employee", id: "emp-ole" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "Hej",
    translations: { da: "Hej" },
    viaVoice: false,
  };
  const notes = noticesFromDiff(empty, { ...empty, chats: [msg] }, "2026-09-05T17:00:00.000Z");
  assert.equal(notes[0]?.kind, "chat");
  assert.deepEqual(notes[0]?.toIds, ["emp-ole"]);
});

test("ny to-do går til den ansatte", () => {
  const td = {
    id: "td-n",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-alex",
    fromId: "emp-ole",
    title: "Puds kælder",
    body: "Puds kælder",
    kind: "task" as const,
    due: "2026-09-08",
    done: false,
    createdAt: "2026-09-05T18:02:00.000Z",
  } as Todo;
  const notes = noticesFromDiff(empty, { ...empty, todos: [td] }, "2026-09-05T17:00:00.000Z");
  assert.equal(notes[0]?.kind, "todo");
  assert.deepEqual(notes[0]?.toIds, ["emp-alex"]);
});

test("udført to-do går til mester", () => {
  const open = {
    id: "td-n",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-alex",
    fromId: "emp-ole",
    title: "Puds kælder",
    body: "Puds kælder",
    kind: "task" as const,
    due: "2026-09-08",
    done: false,
    createdAt: "2026-09-05T12:00:00.000Z",
  } as Todo;
  const done = { ...open, done: true, doneAt: "2026-09-05T18:03:00.000Z", doneById: "emp-alex" };
  const notes = noticesFromDiff({ ...empty, todos: [open] }, { ...empty, todos: [done] }, "2026-09-05T17:00:00.000Z");
  assert.equal(notes[0]?.kind, "todo-done");
  assert.ok(notes[0]?.toIds.includes("emp-ole"));
  assert.equal(notes[0]?.toIds.includes("emp-alex"), false);
});

test("chat til masters rammer begge mestre", () => {
  const msg: ChatMessage = {
    id: "ch-m",
    at: "2026-09-05T18:04:00.000Z",
    fromId: "emp-alex",
    to: { kind: "masters" },
    projectId: "job-islevvaenge",
    sourceLang: "da",
    original: "Mangler mørtel",
    translations: { da: "Mangler mørtel" },
    viaVoice: false,
  };
  assert.deepEqual(chatRecipientIds(msg, people, assignments).sort(), ["emp-federico", "emp-ole"]);
  assert.deepEqual(masterIds(people).sort(), ["emp-federico", "emp-ole"]);
});

test("ansat MA kladde og send giver besked til mester", () => {
  const draft = noticeForMaShare({
    orderId: "mo-1",
    projectId: "job-hillerodsholm",
    fromId: "emp-alex",
    number: "MA-2026-017",
    mode: "draft",
    employees: people,
  });
  assert.equal(draft?.kind, "ma");
  assert.match(draft?.body ?? "", /kladde klar, vælg leverandør/);
  assert.ok(draft?.toIds.includes("emp-ole"));
  const sent = noticeForMaShare({
    orderId: "mo-1",
    projectId: "job-hillerodsholm",
    fromId: "emp-alex",
    number: "MA-2026-017",
    mode: "send",
    link: "https://example/ma/hillerodsholm/017",
    employees: people,
  });
  assert.match(sent?.body ?? "", /sendt, her er linket/);
  const masterDraft = noticeForMaShare({
    orderId: "mo-1",
    projectId: "job-hillerodsholm",
    fromId: "emp-ole",
    number: "MA-2026-017",
    mode: "draft",
    employees: people,
  });
  assert.equal(masterDraft, null);
});
