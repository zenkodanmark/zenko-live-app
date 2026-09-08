import assert from "node:assert/strict";
import test from "node:test";
import { ensureSoftrAs, softrAsFieldItems, softrAsSlips } from "./softr-as.ts";
import { softrErReports } from "./softr-er.ts";
import { softrTfReports } from "./softr-tf.ts";
import { SOFTR_ET_NUMBERS } from "./softr-et-numbers.ts";
import { SOFTR_TF_NUMBERS } from "./softr-tf-numbers.ts";

test("Softr-aftalesedler uden BMR, ET og TF", () => {
  const slips = softrAsSlips();
  assert.ok(slips.every((s) => s.source === "softr"));
  assert.ok(slips.every((s) => {
    const n = Number(s.number.replace(/\D/g, ""));
    return !SOFTR_ET_NUMBERS.has(n) && !SOFTR_TF_NUMBERS.has(n);
  }));
  assert.ok(slips.some((s) => s.number === "AS-399"));
  assert.ok(!slips.some((s) => s.number === "AS-396"));
  assert.ok(!slips.some((s) => s.number === "AS-4"));
  const n399 = slips.find((s) => s.number === "AS-399");
  assert.equal(n399?.projectId, "job-islevvaenge");
  assert.ok((n399?.photoIds.length ?? 0) >= 5);
  assert.ok(softrAsFieldItems().length >= 2800);
  const tfOnly = softrTfReports().filter((t) => !SOFTR_ET_NUMBERS.has(Number(t.number.replace(/\D/g, ""))));
  assert.equal(slips.length + softrErReports().length + tfOnly.length, 343);
});

test("ET-listen bliver entreprenørrapporter", () => {
  const ents = softrErReports();
  assert.ok(ents.length >= 150);
  const n396 = ents.find((e) => e.number === "ER-396");
  assert.ok(n396);
  assert.ok((n396?.photoIds.length ?? 0) >= 10);
});

test("TF-listen bliver tekniske forespørgsler", () => {
  const tfs = softrTfReports();
  assert.ok(tfs.length >= 10);
  assert.ok(tfs.every((e) => e.number.startsWith("TF-")));
  assert.ok(tfs.some((e) => e.number === "TF-4"));
  assert.ok(tfs.some((e) => e.number === "TF-22"));
  assert.ok(softrErReports().some((e) => e.number === "ER-22"));
});

test("ensureSoftrAs bevarer papirkurv og fjerner ET/TF-sedler", () => {
  const slips = [
    ...softrAsSlips().map((s) => (s.number === "AS-399" ? { ...s, trashedAt: "2026-09-04T00:00:00.000Z", title: "SKAL IKKE OVERSKRIVES" } : s)),
    { id: "slip-softr-4", number: "AS-4", projectId: "job-hillerodsholm", title: "SKAL VÆK", location: "", body: "", masterSolution: "", customerPrice: "0 kr", hoursEst: 0, materialsEst: "—", createdAt: "", status: "issued" as const, forwarded: false, paid: false, photoIds: [] },
  ];
  const state = { slips, fieldItems: [] as never[] };
  ensureSoftrAs(state);
  const n399 = state.slips.find((s) => s.number === "AS-399");
  assert.equal(n399?.trashedAt, "2026-09-04T00:00:00.000Z");
  assert.ok(!state.slips.some((s) => s.number === "AS-4"));
});
