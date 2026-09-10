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
  const storeSoftr = row({
    id: "ksr-softr-8",
    number: "8",
    projectId: "job-kaerhuset",
    point: "UDFØRSEL",
    status: "issued",
    source: "softr",
  });
  const hidden = row({ id: "ksr-softr-3", number: "3", projectId: "job-wrong", kundeStatus: "skjult" });
  const list = mesterKsForJob([grok, other, hidden, storeSoftr], "job-kaerhuset");
  assert.ok(list.some((r) => r.id === "ksr-grok-9"));
  assert.ok(!list.some((r) => r.id === "ksr-grok-8"));
  for (const n of ["8", "9", "82", "84", "85", "86", "87", "88"]) {
    assert.ok(list.some((r) => r.id === `ksr-softr-${n}`), `mangler ksr-softr-${n}`);
  }
  assert.equal(list.find((r) => r.id === "ksr-softr-8")?.projectId, "job-kaerhuset");
  assert.ok(list.some((r) => r.point === "UDFØRSEL"));
  assert.ok(list.some((r) => r.status === "issued"));
  assert.ok(list.some((r) => r.kundeStatus !== "med_til_kunden"), "kunde-hak skjuler ikke");
  assert.ok(!list.some((r) => r.projectId !== "job-kaerhuset"));
});

test("Hillerødsholm mester-liste matcher job-hillerodsholm", () => {
  const grok = row({ id: "ksr-grok-55-1sal", number: "Z-KS-2026-004", projectId: "job-hillerodsholm", point: "5.5" });
  const list = mesterKsForJob([grok], "job-hillerodsholm");
  assert.ok(list.every((r) => r.projectId === "job-hillerodsholm"));
  assert.ok(list.some((r) => r.id === "ksr-grok-55-1sal" && r.number === "Z-KS-2026-004"));
  assert.ok(list.some((r) => r.id === "ksr-softr-97"));
  const bundled = softrKsReports().filter((r) => r.projectId === "job-hillerodsholm");
  assert.ok(bundled.length > 0);
  for (const r of bundled) assert.ok(list.some((x) => x.id === r.id), r.id);
});
