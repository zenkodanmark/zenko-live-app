import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarYears,
  applyArchive,
  applyReopen,
  ensureProjectHandover,
  fiveYearDate,
  handoverDate,
  oneYearDate,
  reviewUrgency,
} from "./job-archive.ts";
import type { Project } from "./types.ts";

function job(patch: Partial<Project> = {}): Project {
  return {
    id: "job-x",
    name: "Solbakkegård",
    address: "Vester Snogbæk 15",
    lat: 54.9,
    lng: 9.7,
    radiusM: 160,
    brief: "",
    huddle: "",
    nextTask: "",
    udbudFolderId: "",
    status: "active",
    createdBy: "emp-ole",
    source: "test",
    ...patch,
  };
}

test("1- og 5-års tælles fra afleveringsdato", () => {
  const p = job({ handedOverAt: "2025-09-01", status: "archived" });
  assert.equal(handoverDate(p), "2025-09-01");
  assert.equal(oneYearDate(p), "2026-09-01");
  assert.equal(fiveYearDate(p), "2030-09-01");
  assert.equal(addCalendarYears("2021-10-01", 5), "2026-10-01");
});

test("arkiv sætter aflevering første gang og rydder genåbningsgrund", () => {
  const first = applyArchive(job(), "2025-09-01T10:00:00.000Z");
  assert.equal(first.status, "archived");
  assert.equal(first.handedOverAt, "2025-09-01");
  assert.equal(first.archivedAt, "2025-09-01T10:00:00.000Z");
  assert.equal(first.reopenReason, undefined);

  const opened = applyReopen(first, "mangler", "2026-09-05T08:00:00.000Z");
  assert.equal(opened.status, "active");
  assert.equal(opened.reopenReason, "mangler");
  assert.equal(opened.handedOverAt, "2025-09-01");

  const closedAgain = applyArchive(opened, "2026-09-20T10:00:00.000Z");
  assert.equal(closedAgain.status, "archived");
  assert.equal(closedAgain.handedOverAt, "2025-09-01");
  assert.equal(closedAgain.reopenReason, undefined);
  assert.equal(oneYearDate(closedAgain), "2026-09-01");
  assert.equal(fiveYearDate(closedAgain), "2030-09-01");
});

test("1-års kan genåbnes uden at flytte 5-års", () => {
  const p = applyReopen(
    job({ status: "archived", handedOverAt: "2021-09-15", archivedAt: "2021-09-15T12:00:00.000Z" }),
    "1aar",
    "2026-09-05T08:00:00.000Z",
  );
  assert.equal(p.status, "active");
  assert.equal(p.reopenReason, "1aar");
  assert.equal(fiveYearDate(p), "2026-09-15");
});

test("reviewUrgency: overskredet og inden 14 dage er nu, 26 dage er snart", () => {
  const today = new Date("2026-09-05T10:00:00.000Z");
  assert.equal(reviewUrgency("2026-09-01", today), "now");
  assert.equal(reviewUrgency("2026-09-15", today), "now");
  assert.equal(reviewUrgency("2026-10-01", today), "soon");
  assert.equal(reviewUrgency("2030-09-01", today), "later");
});

test("ensureProjectHandover fylder aflevering fra seed på arkiverede sager", () => {
  const seed = job({ id: "job-solbakkegaard", handedOverAt: "2025-09-01", archivedAt: "2025-09-01T00:00:00.000Z", status: "archived" });
  const live = ensureProjectHandover(job({ id: "job-solbakkegaard", status: "archived" }), seed);
  assert.equal(live.handedOverAt, "2025-09-01");
});
