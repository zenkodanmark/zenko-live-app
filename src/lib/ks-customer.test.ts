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
  OVRIGE_PART,
} from "./ks-customer.ts";
import { PROJECTS, SEED_KS_REPORTS } from "./seed.ts";
import { softrKsPhotos, softrKsReports } from "./softr-ks.ts";
import type { Entrepreneur, Tf } from "./types.ts";

test("slug er hilleroedsholm — ikke mester-hash", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  assert.equal(slugForProject(job), "hilleroedsholm");
  assert.equal(slugFromName("Islevvænge"), "islevvaenge");
  assert.equal(slugFromName("Kærhuset"), "kaerhuset");
  assert.equal(kundePath("hilleroedsholm"), "/kunde/hilleroedsholm");
  assert.equal(kundePath("hilleroedsholm", ["10.02.03", "02"]), "/kunde/hilleroedsholm/10.02.03/02");
  assert.doesNotMatch(kundePath("hilleroedsholm"), /mester/);
});

test("hakket KS uden punkt lander under Øvrigt — ikke auto-udbud", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const two = softrKsReports().find((r) => r.number === "2")!;
  assert.equal(two.kundeStatus, "med_til_kunden");
  assert.equal(partForReport(two).code, OVRIGE_PART.code);
  const site = buildKundeSite({ project: job, reports: softrKsReports(), photos: softrKsPhotos() });
  assert.deepEqual(site.parts.map((p) => p.code), ["ovrige"]);
  assert.ok(site.reports.every((r) => r.part.code === "ovrige"));
  assert.ok(!site.parts.some((p) => p.code === "10.02.03"));
});

test("eksplicit punkt Omfugning grupperer kun de hakkede", () => {
  const job = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  const rows = softrKsReports()
    .filter((r) => r.projectId === "job-kaerhuset")
    .slice(0, 3)
    .map((r) => ({ ...r, kundeStatus: "med_til_kunden" as const, kundePunkt: "Omfugning" }));
  const rest = softrKsReports()
    .filter((r) => r.projectId === "job-kaerhuset")
    .slice(3)
    .map((r) => ({ ...r, kundeStatus: "skjult" as const, kundePunkt: undefined }));
  const site = buildKundeSite({ project: job, reports: [...rows, ...rest], photos: softrKsPhotos() });
  assert.equal(site.reports.length, 3);
  assert.deepEqual(site.parts.map((p) => p.title), ["Omfugning"]);
  assert.ok(site.reports.every((r) => r.part.title === "Omfugning"));
  assert.ok(!site.parts.some((p) => p.code.startsWith("1.1")));
});

test("nyt punkt Filsning altaner bliver en ny række", () => {
  const job = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  const a = { ...softrKsReports().find((r) => r.projectId === "job-kaerhuset")!, id: "ks-a", kundeStatus: "med_til_kunden" as const, kundePunkt: "Omfugning" };
  const b = { ...a, id: "ks-b", number: "88", kundePunkt: "Filsning altaner" };
  const site = buildKundeSite({ project: job, reports: [a, b], photos: [] });
  assert.ok(site.parts.some((p) => p.title === "Omfugning"));
  assert.ok(site.parts.some((p) => p.title === "Filsning altaner"));
  assert.equal(site.reports.filter((r) => r.part.title === "Filsning altaner").length, 1);
});

test("udbudspunkt uden hakkede rapporter vises ikke", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const hill = softrKsReports().filter((r) => r.projectId === "job-hillerodsholm");
  const hidden = hill.map((r) => ({ ...r, kundeStatus: "skjult" as const, kundePunkt: "10.02.03" }));
  const one = { ...hidden[0]!, id: "ks-one", kundeStatus: "med_til_kunden" as const, kundePunkt: "Omfugning" };
  const site = buildKundeSite({ project: job, reports: [...hidden, one], photos: [] });
  assert.ok(site.parts.some((p) => p.title === "Omfugning"));
  assert.ok(!site.parts.some((p) => p.code === "10.02.03"));
});

test("fjern Kunde-hak — rapporten væk, tæller falder", () => {
  const job = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  const rows = [
    { ...softrKsReports().find((r) => r.projectId === "job-kaerhuset")!, id: "a", kundeStatus: "med_til_kunden" as const, kundePunkt: "Omfugning" },
    { ...softrKsReports().find((r) => r.projectId === "job-kaerhuset")!, id: "b", number: "4", kundeStatus: "med_til_kunden" as const, kundePunkt: "Omfugning" },
  ];
  const on = buildKundeSite({ project: job, reports: rows, photos: [] });
  assert.equal(on.reports.length, 2);
  const off = buildKundeSite({
    project: job,
    reports: rows.map((r) => (r.id === "b" ? { ...r, kundeStatus: "skjult" as const } : r)),
    photos: [],
  });
  assert.equal(off.reports.length, 1);
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

test("rapport 02 vises når den er hakket — under Øvrigt uden punkt", () => {
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
  assert.equal(two.part.code, "ovrige");
});

test("udbudskode som punkt bruger kort titel", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const fils = SEED_KS_REPORTS.find((r) => r.id === "ksr-grok-55")!;
  const hakked = [{ ...fils, kundeStatus: "med_til_kunden" as const, kundePunkt: "10.02.01" }];
  const site = buildKundeSite({ project: job, reports: hakked, photos: softrKsPhotos() });
  assert.equal(site.parts[0]?.code, "10.02.01");
  assert.match(site.parts[0]?.title ?? "", /Puds|reparation|altan/i);
});

test("TF og ER kommer ikke med på kundesiden", () => {
  const job = PROJECTS.find((p) => p.id === "job-islevvaenge")!;
  const tf: Tf = {
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
  const er: Entrepreneur = {
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
  const site = buildKundeSite({ project: job, reports: [], photos: [], tfs: [tf], ents: [er] });
  assert.equal(site.reports.length, 0);
  assert.ok(!site.parts.some((p) => p.code === "tf" || p.code === "er"));
});
