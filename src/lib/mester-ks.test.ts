import assert from "node:assert/strict";
import test from "node:test";
import { mesterKsForJob } from "./mester-ks.ts";
import { softrKsReports } from "./softr-ks.ts";
import type { KsReport } from "./types.ts";

function row(extra: Partial<KsReport>): KsReport {
  return {
    id: "ksr-x",
    number: "1",
    projectId: "job-kaerhuset",
    point: "5.5",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "issued",
    photoIds: [],
    ...extra,
  };
}

test("Kærhuset mester-liste viser Softr-KS uden id-prefix-filter", () => {
  const grok = row({ id: "ksr-grok-9", number: "Z-KS-9", projectId: "job-kaerhuset" });
  const other = row({ id: "ksr-grok-8", number: "Z-KS-8", projectId: "job-hillerodsholm" });
  const hidden = row({ id: "ksr-softr-3", number: "3", projectId: "job-wrong", kundeStatus: "skjult" });
  const list = mesterKsForJob([grok, other, hidden], "job-kaerhuset");
  assert.ok(list.some((r) => r.id === "ksr-grok-9"));
  assert.ok(!list.some((r) => r.id === "ksr-grok-8"));
  const softr = softrKsReports().filter((r) => r.projectId === "job-kaerhuset");
  assert.ok(softr.length > 0);
  for (const r of softr) assert.ok(list.some((x) => x.id === r.id), r.id);
  assert.ok(list.some((r) => r.id.startsWith("ksr-softr-")));
  assert.ok(list.some((r) => r.kundeStatus !== "med_til_kunden"), "kunde-hak skjuler ikke");
});

test("Hillerødsholm mester-liste matcher job-hillerodsholm", () => {
  const list = mesterKsForJob([], "job-hillerodsholm");
  assert.ok(list.every((r) => r.projectId === "job-hillerodsholm" || r.id.startsWith("ksr-softr-")));
  assert.ok(list.length > 0);
});
