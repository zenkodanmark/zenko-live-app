import assert from "node:assert/strict";
import test from "node:test";
import { buildAsSharePayload, buildKsSharePayload, bundledShareRecord, isShareKind, isShareSlug, reportMailCopy, reportSharePath, shareSlug } from "./report-share.ts";
import type { FieldItem, KsPhoto, KsReport, Project, Slip } from "./types.ts";

test("slug og path er kundelink — aldrig mester-hash", () => {
  assert.equal(shareSlug("AS-399"), "399");
  assert.equal(shareSlug("52"), "52");
  assert.equal(shareSlug("TF-12"), "12");
  assert.equal(shareSlug("ER-5"), "5");
  assert.equal(isShareKind("ks"), true);
  assert.equal(isShareKind("mester"), false);
  assert.equal(isShareSlug("52"), true);
  assert.equal(isShareSlug("../mester"), false);
  assert.equal(reportSharePath("ks", "52"), "/r/ks/52");
  assert.equal(reportSharePath("as", "AS-399"), "/r/as/399");
  assert.equal(reportSharePath("tf", "12"), "/r/tf/12");
  assert.equal(reportSharePath("er", "ER-5"), "/r/er/5");
});

test("mailtekst peger kun på rapporten", () => {
  const job = { name: "Kærhuset", address: "Kær Bygade 8", customer: "Ole Jepsen A/S" } as Project;
  const slip = {
    id: "slip-softr-399",
    number: "AS-399",
    projectId: "job-kaerhuset",
    title: "Weber 280",
    location: "R21a",
    body: "R24 bolig 98",
    masterSolution: "",
    customerPrice: "0 kr",
    hoursEst: 0,
    materialsEst: "",
    createdAt: "2026-08-28T10:00:00.000Z",
    status: "issued",
    forwarded: false,
    paid: false,
    photoIds: ["p1"],
  } as Slip;
  const items = [{ id: "p1", name: "foto.jpg", dataUrl: "/as/softr/399/foto.jpg" } as FieldItem];
  const payload = buildAsSharePayload(slip, job, items);
  assert.equal(payload.photos[0]?.src, "/as/softr/399/foto.jpg");
  const url = `https://zenko-danmark.grok.me${reportSharePath("as", slip.number)}`;
  const mail = reportMailCopy(payload, url);
  assert.match(mail.body, /\/r\/as\/399/);
  assert.doesNotMatch(mail.body, /\/mester/);
  assert.doesNotMatch(mail.body, /#ksr/);
});

test("KS payload bruger lokale stier", () => {
  const job = { name: "Hillerødsholm", address: "Selskovvej", customer: "Ole Jepsen A/S" } as Project;
  const report = {
    id: "ksr-softr-52",
    number: "52",
    projectId: "job-hillerodsholm",
    point: "5.7",
    createdAt: "2026-03-20T11:00:00.000Z",
    status: "issued",
    photoIds: ["softr-ks-52-1"],
    task: "Omfugning",
  } as KsReport;
  const photos = [{ id: "softr-ks-52-1", dataUrl: "/ks/softr/52/a.jpg", originalName: "a.jpg" } as KsPhoto];
  const payload = buildKsSharePayload(report, job, photos);
  assert.equal(payload.kind, "ks");
  assert.equal(payload.photos[0]?.src, "/ks/softr/52/a.jpg");
});

test("bundled gæsterapporter — KS 52, AS 399, TF 12, ER 5", () => {
  const ks = bundledShareRecord("ks", "52");
  assert.ok(ks, "KS 52 skal findes uden database");
  assert.equal(ks.kind, "ks");
  assert.equal(shareSlug(ks.number), "52");
  assert.match(ks.photos[0]?.src ?? "", /googleusercontent\.com\/d\//);
  assert.doesNotMatch(ks.photos[0]?.src ?? "", /mester/);

  const as = bundledShareRecord("as", "399");
  assert.ok(as, "AS 399 skal findes uden database");
  assert.equal(as.kind, "as");
  assert.equal(shareSlug(as.number), "399");
  assert.ok(as.photos.length >= 1);

  const tf = bundledShareRecord("tf", "12");
  assert.ok(tf, "TF 12 skal findes uden database");
  assert.equal(tf.kind, "tf");
  assert.equal(shareSlug(tf.number), "12");

  const er = bundledShareRecord("er", "5");
  assert.ok(er, "ER 5 skal findes uden database");
  assert.equal(er.kind, "er");
  assert.equal(shareSlug(er.number), "5");
});
