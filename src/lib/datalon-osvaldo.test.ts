import assert from "node:assert/strict";
import test from "node:test";
import { OSVALDO_DATALON } from "./datalon-osvaldo.ts";
import { hoursWorked, seedTodayDays } from "./seed.ts";

test("Osvaldo Dataløn er 147 dage og tæller dubletter én gang", () => {
  assert.equal(OSVALDO_DATALON.length, 147);
  const hours = OSVALDO_DATALON.reduce((n, r) => n + r.minutes, 0) / 60;
  assert.equal(hours, 1160.5);
  assert.equal(OSVALDO_DATALON.filter((r) => r.doubleBooked).length, 9);
  const jobs = new Set(OSVALDO_DATALON.map((r) => r.projectId));
  assert.ok(jobs.has("job-hillerodsholm"));
  assert.ok(jobs.has("job-provestenen"));
  assert.ok(jobs.has("job-islevvaenge"));
  assert.ok(jobs.has("job-kaerhuset"));
  assert.equal(jobs.has("job-strandvejen"), false);
  assert.equal(jobs.has("job-ruskaer"), false);
});

test("seedede dage har beskrivelse og sag på Osvaldo", () => {
  const days = seedTodayDays();
  const sample = days["emp-osvaldo:2026-01-13"];
  assert.ok(sample);
  assert.equal(sample.projectId, "job-provestenen");
  assert.match(sample.workNote ?? "", /Fuge out/);
  assert.equal(sample.source, "datalon");
  assert.equal(hoursWorked(sample), 7);
  const have = Object.values(days).filter((d) => d.employeeId === "emp-osvaldo" && d.source === "datalon");
  assert.ok(have.length >= 140);
  assert.ok(have.every((d) => d.projectId && d.checkOutAt));
});
