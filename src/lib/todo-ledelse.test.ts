import assert from "node:assert/strict";
import test from "node:test";
import { ledelseFromTodoRow, todoFromRow, todoToRow, translationsForTodo } from "./sb-rows.ts";
import { isLedelseTodo } from "./plan-grid.ts";
import type { Todo } from "./types.ts";

function sample(extra: Partial<Todo> = {}): Todo {
  return {
    id: "td-test",
    projectId: "job-islevvaenge",
    assigneeId: "emp-ole",
    fromId: "emp-ole",
    title: "Rep efter blik",
    body: "Rep efter blik",
    done: false,
    createdAt: "2026-09-10T08:00:00.000Z",
    translations: { da: "Rep efter blik" },
    ...extra,
  };
}

test("todoToRow lægger hakket i translations når kolonnen mangler", () => {
  const row = todoToRow(sample({ ledelseStatus: "med_til_ledelse" }));
  assert.equal(row.ledelse_status, "med_til_ledelse");
  assert.equal((row.translations as { __ledelse?: string }).__ledelse, "med_til_ledelse");
  assert.equal((row.translations as { da?: string }).da, "Rep efter blik");
});

test("todoToRow skriver skjult så hvid overlever", () => {
  const row = todoToRow(sample({ ledelseStatus: "skjult" }));
  assert.equal((row.translations as { __ledelse?: string }).__ledelse, "skjult");
});

test("todoFromRow læser hak fra translations når kolonnen mangler", () => {
  const todo = todoFromRow({
    id: "td-1",
    project_id: "job-islevvaenge",
    assignee_id: "emp-ole",
    from_id: "emp-ole",
    title: "Rep efter blik",
    body: "x",
    done: false,
    created_at: "2026-09-10T08:00:00.000Z",
    translations: { da: "Rep efter blik", __ledelse: "med_til_ledelse" },
  });
  assert.equal(todo.ledelseStatus, "med_til_ledelse");
  assert.equal(todo.translations?.da, "Rep efter blik");
  assert.equal((todo.translations as { __ledelse?: string } | undefined)?.__ledelse, undefined);
  assert.equal(isLedelseTodo(todo), true);
});

test("todoFromRow foretrækker kolonnen ledelse_status", () => {
  const todo = todoFromRow({
    id: "td-1",
    title: "R21",
    done: false,
    translations: { __ledelse: "med_til_ledelse" },
    ledelse_status: "skjult",
  });
  assert.equal(todo.ledelseStatus, "skjult");
  assert.equal(isLedelseTodo(todo), false);
});

test("ledelseFromTodoRow ignorerer tomt", () => {
  assert.deepEqual(ledelseFromTodoRow({}), {});
  assert.deepEqual(ledelseFromTodoRow({ translations: { da: "x" } }), {});
});

test("translationsForTodo overskriver gammelt hak", () => {
  const out = translationsForTodo({
    translations: { da: "x", __ledelse: "med_til_ledelse" } as Todo["translations"],
    ledelseStatus: "skjult",
  });
  assert.equal(out.__ledelse, "skjult");
  assert.equal(out.da, "x");
});
