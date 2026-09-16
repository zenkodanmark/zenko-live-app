import assert from "node:assert/strict";
import test from "node:test";
import { canMarkTodoDone, crewHomeTodos, crewSagTodos, crewTodoBody, crewTodoTitle, isJobPlaceTitle, isPersonalTodo, todoJobLabel } from "./crew-todo.ts";
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

test("ansat ser body, ikke titel om igen", () => {
  const bath = td({
    title: "BADEVÆRELSE 2",
    body: "Vasken sænkes 10 centimeter. Gasbetonen i vinduet skæres af.",
    original: "BADEVÆRELSE 2",
    translations: { da: "BADEVÆRELSE 2" },
  });
  assert.equal(crewTodoBody(bath, "ro").startsWith("Vasken sænkes"), true);
  assert.equal(crewTodoBody(bath, "da").includes("BADEVÆRELSE"), false);
  const onlyTitle = td({ title: "Hent mørtel", body: "", original: "Hent mørtel", translations: { da: "Hent mørtel" } });
  assert.equal(crewTodoBody(onlyTitle, "ro"), "");
  const same = td({ title: "Sæt stillads", body: "Sæt stillads", original: "Sæt stillads" });
  assert.equal(crewTodoBody(same, "da"), "");
  const long = td({ title: "Fuger", body: "Udkrads 20 mm og sæt NHL 3,5.", original: "Udkrads 20 mm og sæt NHL 3,5." });
  assert.equal(crewTodoBody(long, "da").includes("NHL"), true);
  const fod = td({ title: "Fodlister", body: "Fodlister – Jyderup (flere kommer)\n- Lille værelse", original: "" });
  assert.match(crewTodoBody(fod, "ro"), /Jyderup/);
  const nested = td({
    title: "Bryggers",
    body: "Fliser 2,5 x 2,5 m",
    translations: { ro: { body: "Gresie 2,5 x 2,5 m" } as unknown as string },
  });
  assert.equal(crewTodoBody(nested, "ro"), "Gresie 2,5 x 2,5 m");
});

test("titel oversættes ikke når det er sagsnavn", () => {
  const job = todoJobLabel("job-hillerodsholm", "da");
  assert.equal(isJobPlaceTitle(job, "job-hillerodsholm"), true);
  const row = td({
    title: job,
    body: "Ryd bag skuret i dag",
    original: "Ryd bag skuret i dag",
    translations: { ro: "Curăță în spatele șopronului astăzi" },
  });
  assert.equal(crewTodoTitle(row, "ro"), job);
  const task = td({
    title: "Ryd bag skuret",
    body: "Ryd bag skuret",
    original: "Ryd bag skuret",
    translations: { ro: "Curăță în spatele șopronului" },
  });
  assert.equal(crewTodoTitle(task, "ro"), "Curăță în spatele șopronului");
});
