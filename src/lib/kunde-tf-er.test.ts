import assert from "node:assert/strict";
import test from "node:test";
import { buildKundeSite, isPublished } from "./ks-customer.ts";
import { PROJECTS } from "./seed.ts";
import type { Entrepreneur, Tf } from "./types.ts";

const job = PROJECTS.find((p) => p.id === "job-islevvaenge")!;

const tfOn: Tf = {
  id: "tf-1",
  number: "Z-TF-1",
  projectId: "job-islevvaenge",
  question: "Hul i væg?",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "issued",
  answered: false,
  photoIds: [],
  kundeStatus: "med_til_kunden",
};
const tfOff: Tf = { ...tfOn, id: "tf-2", number: "Z-TF-2", kundeStatus: "skjult" };
const erOn: Entrepreneur = {
  id: "ent-1",
  number: "Z-ER-1",
  projectId: "job-islevvaenge",
  title: "Facade",
  body: "Puds",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "issued",
  photoIds: [],
  kundeStatus: "med_til_kunden",
};
const erOff: Entrepreneur = { ...erOn, id: "ent-2", number: "Z-ER-2", kundeStatus: "skjult" };

test("kunde-side viser kun ER/TF/KS med Kunde = ja", () => {
  const site = buildKundeSite({
    project: job,
    reports: [],
    photos: [],
    tfs: [tfOn, tfOff],
    ents: [erOn, erOff],
  });
  assert.equal(site.reports.length, 2);
  assert.ok(site.reports.some((r) => r.id === "tf-1" && r.kind === "tf"));
  assert.ok(site.reports.some((r) => r.id === "ent-1" && r.kind === "er"));
  assert.ok(!site.reports.some((r) => r.id === "tf-2" || r.id === "ent-2"));
  assert.ok(site.parts.some((p) => p.code === "tf"));
  assert.ok(site.parts.some((p) => p.code === "er"));
});

test("isPublished kræver med_til_kunden og ikke papirkurv", () => {
  assert.equal(isPublished(tfOn), true);
  assert.equal(isPublished(tfOff), false);
  assert.equal(isPublished({ kundeStatus: "med_til_kunden", trashedAt: "x" }), false);
});
