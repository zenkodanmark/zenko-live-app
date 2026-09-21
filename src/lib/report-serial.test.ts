import assert from "node:assert/strict";
import test from "node:test";
import { aliasesFor, allocateZNumber, highestZSerial, movedIdFromSource, movedSource, nextZNumber, numberTaken, zNumber } from "./report-serial.ts";

test("nextZNumber springer dummy Z-ER-2026-001 over", () => {
  const used = ["Z-ER-2026-001", "Z-ER-2026-001", "Z-ER-2026-001"];
  const got = nextZNumber("er", used, 1);
  assert.equal(got.number, "Z-ER-2026-002");
  assert.equal(got.n, 2);
  assert.notEqual(got.number, "Z-ER-2026-001");
});

test("tom used springer stadig dummy 001 over", () => {
  const got = nextZNumber("er", [], 1);
  assert.notEqual(got.number, "Z-ER-2026-001");
  assert.equal(got.number, "Z-ER-2026-002");
});

test("nextZNumber springer ER-1 / ER-001 over", () => {
  const got = nextZNumber("er", ["ER-1", "ER-001"], 1);
  assert.equal(got.number, "Z-ER-2026-002");
});

test("allocateZNumber beholder unikt preferred, skifter hvis taget", () => {
  assert.equal(allocateZNumber("er", ["Z-ER-2026-001"], 1, "Z-ER-2026-009").number, "Z-ER-2026-009");
  assert.equal(allocateZNumber("er", ["Z-ER-2026-001"], 1, "Z-ER-2026-001").number, "Z-ER-2026-002");
  assert.equal(allocateZNumber("er", ["Z-ER-2026-001", "Z-ER-2026-002"], 1).number, "Z-ER-2026-003");
});

test("aliases og taken", () => {
  assert.ok(aliasesFor("er", 1).includes("Z-ER-2026-001"));
  assert.equal(numberTaken("z-er-2026-001", ["Z-ER-2026-001"]), true);
  assert.equal(zNumber("as", 7), "Z-AS-2026-007");
  assert.equal(highestZSerial("er", ["Z-ER-2026-001", "Z-ER-2026-002", "ER-22"]), 2);
});

test("moved-kilde peger på ny id, aldrig number", () => {
  const src = movedSource("ent-abc-unique");
  assert.equal(src, "moved:ent-abc-unique");
  assert.equal(movedIdFromSource(src), "ent-abc-unique");
  assert.equal(movedIdFromSource("softr"), "");
});
