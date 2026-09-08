import assert from "node:assert/strict";
import test from "node:test";
import { todoAssignedTo, todoAssigneeIds, todoDoneLine, todoPeopleLine } from "./todo-people.ts";
import type { Employee, Todo } from "./types.ts";

const people: Employee[] = [
  { id: "emp-alex", name: "Alex", role: "laerling", language: "da", pin: "1111", initials: "AL" },
  { id: "emp-ion", name: "Ion Zafier", role: "svend", language: "ro", pin: "3333", initials: "IZ" },
  { id: "emp-marius", name: "Marius Pater", role: "svend", language: "pl", pin: "4444", initials: "MP" },
];

function td(patch: Partial<Todo> = {}): Todo {
  return {
    id: "td-1",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-alex",
    fromId: "emp-ole",
    title: "Ryd bag skuret",
    body: "Ryd bag skuret",
    kind: "task",
    due: "2026-09-06",
    done: false,
    createdAt: "2026-09-05T08:00:00.000Z",
    ...patch,
  };
}

test("flere ansvarlige er samme to-do", () => {
  const row = td({ assigneeIds: ["emp-alex", "emp-ion", "emp-marius"] });
  assert.deepEqual(todoAssigneeIds(row), ["emp-alex", "emp-ion", "emp-marius"]);
  assert.equal(todoAssignedTo(row, "emp-ion"), true);
  assert.equal(todoAssignedTo(row, "emp-ole"), false);
  assert.equal(todoPeopleLine(row, people), "Alex, Ion Zafier, Marius Pater");
});

test("én udført arkiverer for alle og husker hvem", () => {
  const row = td({
    assigneeIds: ["emp-alex", "emp-ion"],
    done: true,
    doneById: "emp-ion",
    doneAt: "2026-09-05T09:10:00.000Z",
  });
  assert.equal(todoAssignedTo(row, "emp-alex"), true);
  assert.match(todoDoneLine(row, people), /Ion/);
  assert.match(todoDoneLine(row, people), /2026-09-05/);
});
