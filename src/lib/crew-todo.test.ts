import assert from "node:assert/strict";
import test from "node:test";
import { canMarkTodoDone, crewHomeTodos, crewSagTodos, isPersonalTodo, todoJobLabel } from "./crew-todo.ts";
import type { Employee, Todo } from "./types.ts";

const osvaldo: Employee = { id: "emp-osvaldo", name: "Osvaldo", role: "svend", language: "es", pin: "5555", initials: "OS" };
const ole: Employee = { id: "emp-ole", name: "Ole", role: "mester", language: "da", pin: "7777", initials: "OL" };
const alex: Employee = { id: "emp-alex", name: "Alex", role: "laerling", language: "da", pin: "1111", initials: "AL" };

function td(patch: Partial<Todo> = {}): Todo {
  return {
    id: "td-1",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-osvaldo",
    fromId: "emp-ole",
    title: "Ryd bag skuret",
    body: "Intern note",
    kind: "task",
    due: "2026-09-06",
    done: false,
    createdAt: "2026-09-05T08:00:00.000Z",
    ...patch,
  };
}

test("personlig to-do har ingen sag", () => {
  assert.equal(isPersonalTodo(""), true);
  assert.equal(isPersonalTodo(undefined), true);
  assert.equal(isPersonalTodo("job-hillerodsholm"), false);
  assert.equal(todoJobLabel("", "da"), "Ingen sag");
});

test("udført kun tildelt eller mester", () => {
  const row = td({ assigneeIds: ["emp-osvaldo"] });
  assert.equal(canMarkTodoDone(row, osvaldo), true);
  assert.equal(canMarkTodoDone(row, ole), true);
  assert.equal(canMarkTodoDone(row, alex), false);
});

test("forside = personlige + tildelte på egne sager", () => {
  const rows = [
    td({ id: "a", projectId: "", assigneeId: "emp-osvaldo" }),
    td({ id: "b", projectId: "job-hillerodsholm", assigneeId: "emp-osvaldo" }),
    td({ id: "c", projectId: "job-islevvaenge", assigneeId: "emp-osvaldo" }),
    td({ id: "d", projectId: "job-hillerodsholm", assigneeId: "emp-alex" }),
  ];
  const home = crewHomeTodos(rows, osvaldo, ["job-hillerodsholm"]);
  assert.deepEqual(home.map((x) => x.id).sort(), ["a", "b"]);
});

test("på sagen vises sagens to-do, ikke personlige", () => {
  const rows = [
    td({ id: "a", projectId: "", assigneeId: "emp-osvaldo" }),
    td({ id: "b", projectId: "job-hillerodsholm", assigneeId: "emp-alex" }),
    td({ id: "c", projectId: "job-islevvaenge", assigneeId: "emp-osvaldo" }),
  ];
  const sag = crewSagTodos(rows, "job-hillerodsholm");
  assert.deepEqual(sag.map((x) => x.id), ["b"]);
});

test("svend på sag ser kun tildelte, også via assigneeIds", () => {
  const ion: Employee = { id: "emp-ion", name: "Ion Zafier", role: "svend", language: "ro", pin: "3333", initials: "IZ" };
  const rows = [
    td({ id: "1", projectId: "job-islevvaenge", assigneeId: "emp-ion" }),
    td({ id: "2", projectId: "job-islevvaenge", assigneeId: "emp-alex", assigneeIds: ["emp-ion", "emp-alex"] }),
    td({ id: "3", projectId: "job-islevvaenge", assigneeId: "emp-osvaldo" }),
    td({ id: "4", projectId: "job-islevvaenge", assigneeIds: ["emp-marius"] }),
    td({ id: "5", projectId: "job-hillerodsholm", assigneeId: "emp-ion" }),
  ];
  const sag = crewSagTodos(rows, "job-islevvaenge", ion);
  assert.deepEqual(sag.map((x) => x.id).sort(), ["1", "2"]);
  const master = crewSagTodos(rows, "job-islevvaenge", ole);
  assert.equal(master.length, 4);
});
