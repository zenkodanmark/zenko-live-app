import assert from "node:assert/strict";
import test from "node:test";
import { dropDummyEmployees, isDummyEmployee } from "./crew-live.ts";
import type { Employee } from "./types.ts";

function emp(extra: Partial<Employee>): Employee {
  return {
    id: "emp-x",
    name: "X",
    role: "svend",
    language: "da",
    pin: "1234",
    initials: "X",
    ...extra,
  };
}

test("dropDummyEmployees fjerner Testsvend og emp-ny", () => {
  const rows = [
    emp({ id: "emp-ole", name: "Ole", role: "mester" }),
    emp({ id: "emp-ny", name: "Testsvend" }),
    emp({ id: "emp-ny-2", name: "Testsvend" }),
    emp({ id: "emp-other", name: "Testsvend" }),
    emp({ id: "emp-7d34f7", name: "Liva Lind", role: "mester", pin: "1307" }),
    emp({ id: "emp-7d34f7", name: "Liva Lind", role: "svend" }),
  ];
  const live = dropDummyEmployees(rows);
  assert.equal(live.length, 2);
  assert.ok(live.some((e) => e.id === "emp-ole"));
  const liva = live.find((e) => e.id === "emp-7d34f7");
  assert.equal(liva?.name, "Liva Lind");
  assert.equal(liva?.role, "mester");
  assert.ok(!live.some((e) => isDummyEmployee(e)));
  assert.ok(!live.some((e) => /testsvend/i.test(e.name)));
});

test("cloud-liste erstatter seed — Liva mester, ingen dummy", () => {
  const seed = [
    emp({ id: "emp-ole", name: "Ole", role: "mester" }),
    emp({ id: "emp-ny", name: "Testsvend" }),
  ];
  const cloud = [
    emp({ id: "emp-ole", name: "Ole", role: "mester", pin: "7777" }),
    emp({ id: "emp-federico", name: "Federico", role: "mester", pin: "2222" }),
    emp({ id: "emp-alex", name: "Alex", role: "laerling", pin: "1111" }),
    emp({ id: "emp-ion", name: "Ion Zafier", role: "svend", pin: "3333" }),
    emp({ id: "emp-marius", name: "Marius Pater", role: "svend", pin: "4000" }),
    emp({ id: "emp-osvaldo", name: "Osvaldo", role: "svend", pin: "5555" }),
    emp({ id: "emp-7d34f7", name: "Liva Lind", role: "mester", pin: "1307", language: "da" }),
  ];
  const live = dropDummyEmployees(cloud);
  assert.equal(live.length, 7);
  assert.ok(!live.some((e) => seed.some((s) => isDummyEmployee(s) && s.id === e.id)));
  assert.equal(live.filter((e) => e.name === "Liva Lind").length, 1);
  assert.equal(live.find((e) => e.id === "emp-7d34f7")?.role, "mester");
});
