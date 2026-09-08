import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKundeSite,
  isPublished,
  kundePath,
  partForReport,
  pdfFilename,
  slugFromName,
  slugForProject,
  toKundeReport,
} from "./ks-customer.ts";
import { PROJECTS, SEED_KS_REPORTS } from "./seed.ts";
import { softrKsPhotos, softrKsReports } from "./softr-ks.ts";

test("slug er hilleroedsholm — ikke mester-hash", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  assert.equal(slugForProject(job), "hilleroedsholm");
  assert.equal(slugFromName("Islevvænge"), "islevvaenge");
  assert.equal(slugFromName("Kærhuset"), "kaerhuset");
  assert.equal(kundePath("hilleroedsholm"), "/kunde/hilleroedsholm");
  assert.equal(kundePath("hilleroedsholm", ["10.02.03", "02"]), "/kunde/hilleroedsholm/10.02.03/02");
  assert.doesNotMatch(kundePath("hilleroedsholm"), /mester/);
});

test("kun hakket rapport 2 vises — 10.02.03, ikke 10.02.04", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const reports = softrKsReports();
  const photos = softrKsPhotos();
  const two = reports.find((r) => r.number === "2");
  assert.ok(two);
  assert.equal(two.kundeStatus, "med_til_kunden");
  assert.equal(partForReport(two)?.code, "10.02.03");
  const site = buildKundeSite({ project: job, reports, photos });
  assert.equal(site.job.name, "Hillerødsholm");
  assert.deepEqual(
    site.parts.map((p) => p.code),
    ["10.02.03"],
  );
  assert.equal(site.reports.length, 1);
  assert.equal(site.reports[0].pad, "02");
  assert.equal(site.reports[0].employeeName, "Federico");
  assert.equal(site.reports[0].photos.length, 3);
  assert.equal(site.reports[0].photos[0].n, "01");
  assert.ok(site.reports[0].photos[0].src.includes("googleusercontent.com/d/"));
  assert.equal(site.reports[0].deviations, "Ingen");
  assert.ok(!JSON.stringify(site).includes("timer"));
  assert.ok(!JSON.stringify(site).toLowerCase().includes("whatsapp"));
});

test("omfugning vises først når en 10.02.04-rapport hakkes", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const reports = softrKsReports().map((r) => ({ ...r, kundeStatus: "skjult" as const }));
  const omfug = reports.find((r) => partForReport(r)?.code === "10.02.04");
  assert.ok(omfug);
  (omfug as { kundeStatus: string }).kundeStatus = "med_til_kunden";
  const site = buildKundeSite({ project: job, reports, photos: softrKsPhotos() });
  assert.ok(site.parts.some((p) => p.code === "10.02.04"));
  assert.ok(!site.parts.some((p) => p.code === "10.02.03"));
});

test("skjult rapport er ikke publiceret", () => {
  assert.equal(isPublished({ kundeStatus: "skjult" }), false);
  assert.equal(isPublished({ kundeStatus: "med_til_kunden" }), true);
  assert.equal(isPublished({ kundeStatus: "med_til_kunden", trashedAt: "x" }), false);
});

test("PDF-filnavn følger skabelonen", () => {
  const name = pdfFilename(
    { name: "Hillerødsholm", trade: "Murværk", slug: "hilleroedsholm", projectId: "job-hillerodsholm" } as ReturnType<typeof import("./ks-customer.ts").kundeMeta>,
    "2026-09-04T10:00:00.000Z",
  );
  assert.equal(name, "Zenko_KS_hilleroedsholm_murvaerk_2026-09-04.pdf");
});

test("toKundeReport dropper filnavne og timer", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const two = softrKsReports().find((r) => r.number === "2")!;
  const view = toKundeReport(two, job, softrKsPhotos());
  assert.ok(view);
  assert.equal(view.deviations, "Ingen");
  assert.ok(view.photos.every((p) => p.n.match(/^\d{2}$/)));
});

test("rapport 02 vises selv om databasen kun har en anden rapport", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const reports = softrKsReports();
  const eighty = reports.find((r) => r.number === "80");
  assert.ok(eighty);
  const site = buildKundeSite({
    project: job,
    reports,
    photos: softrKsPhotos(),
    publishedIds: [eighty.id],
  });
  const two = site.reports.find((r) => r.pad === "02");
  assert.ok(two);
  assert.equal(two.employeeName, "Federico");
  assert.match(two.createdAt, /^2026-04-14/);
  assert.equal(two.photos.length, 3);
});

test("filsning 5.5 mapper til 10.02.01 — vises først når hakket", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const fils = SEED_KS_REPORTS.find((r) => r.id === "ksr-grok-55");
  assert.ok(fils);
  assert.notEqual(fils.kundeStatus, "med_til_kunden");
  assert.equal(partForReport(fils).code, "10.02.01");
  const hidden = buildKundeSite({ project: job, reports: SEED_KS_REPORTS, photos: softrKsPhotos() });
  assert.ok(!hidden.parts.some((p) => p.code === "10.02.01"));
  const hakked = SEED_KS_REPORTS.map((r) => (r.id === fils.id ? { ...r, kundeStatus: "med_til_kunden" as const } : r));
  const site = buildKundeSite({ project: job, reports: hakked, photos: softrKsPhotos() });
  assert.ok(site.parts.some((p) => p.code === "10.02.01"));
  assert.ok(site.reports.some((r) => r.id === fils.id && r.part.code === "10.02.01"));
});

test("5.7 fugning af skorsten mapper til 10.02.04", () => {
  const r = softrKsReports().find((x) => x.number === "45" && x.projectId === "job-hillerodsholm")!;
  assert.ok(r);
  assert.notEqual(r.kundeStatus, "med_til_kunden");
  assert.equal(partForReport(r).code, "10.02.04");
  assert.match(partForReport(r).title, /Omfugning/i);
});

test("rapport uden punkt lander under Øvrige KS når den hakkes", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const orphan = {
    ...softrKsReports()[0]!,
    id: "ksr-orphan",
    number: "999",
    point: "",
    task: "",
    location: "",
    projectId: "job-hillerodsholm",
    kundeStatus: "med_til_kunden" as const,
  };
  const site = buildKundeSite({ project: job, reports: [orphan], photos: [] });
  assert.ok(site.parts.some((p) => p.code === "ovrige"));
  assert.equal(site.reports[0]?.part.title, "Øvrige KS");
});

test("10.02.05 uden for udbud droppes ikke", () => {
  const r = softrKsReports().find((x) => x.number === "79")!;
  assert.ok(r);
  const part = partForReport(r);
  assert.equal(part.code, "10.02.05");
});
