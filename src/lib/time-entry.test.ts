import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTimeKind, ksWorkStamp, monthCells, parseHours, shiftMonth, timerDayLabel, timerPhotoPath } from "./time-entry.ts";

describe("time-entry", () => {
  it("parses hours with comma", () => {
    assert.equal(parseHours("8"), 8);
    assert.equal(parseHours("7,5"), 7.5);
    assert.equal(parseHours("7.5"), 7.5);
    assert.equal(parseHours(""), null);
    assert.equal(parseHours("0"), null);
  });

  it("accepts type codes", () => {
    assert.equal(isTimeKind("normal"), true);
    assert.equal(isTimeKind("ot50"), true);
    assert.equal(isTimeKind("ot100"), true);
    assert.equal(isTimeKind("x"), false);
  });

  it("builds a monday-first month", () => {
    const cells = monthCells(2026, 8);
    assert.equal(cells[1], "2026-09-01");
    assert.equal(cells.filter(Boolean).length, 30);
  });

  it("shifts month", () => {
    assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  });

  it("stamps KS work date at noon", () => {
    assert.equal(ksWorkStamp("2026-09-13").startsWith("2026-09-13T12:00:00"), true);
  });

  it("labels the day", () => {
    const s = timerDayLabel("2026-09-14", "da");
    assert.match(s, /14/);
    assert.match(s, /2026/);
  });

  it("keeps timer photos under sager/…/timer/date/id", () => {
    const p = timerPhotoPath("job-islevvaenge", "2026-09-13", "te-abc", "1.jpg");
    assert.equal(p.startsWith("sager/job-islevvaenge/timer/2026-09-13/te-abc/"), true);
  });
});
