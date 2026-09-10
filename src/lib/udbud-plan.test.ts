import assert from "node:assert/strict";
import test from "node:test";
import { bundledUdbudScan, isMurerFile, matchUdbudPart, parseUdbudParts, planForProject } from "./udbud-plan.ts";
import { UDBUD_CORPUS } from "./udbud-corpus.ts";
import { buildKundeSite, partForReport, slugForProject } from "./ks-customer.ts";
import { controlPlanFor, PROJECTS } from "./seed.ts";
import { softrKsPhotos, softrKsReports } from "./softr-ks.ts";

test("murer-fil: Kærhuset og Hillerød, ikke stillads eller tømrer", () => {
  assert.equal(isMurerFile("11ARBE~1- murer arbejde.PDF"), true);
  assert.equal(isMurerFile("K01_C08_002_Murer.pdf"), true);
  assert.equal(isMurerFile("ISV_K01_C08.2_Zmur - Murer.pdf"), true);
  assert.equal(isMurerFile("K01_C08_001_Tømrer.pdf"), false);
  assert.equal(isMurerFile("K01_C08_000_03_Stillads.pdf"), false);
  assert.equal(isMurerFile("RSD_K01_H0_N07 - Byggepladsplan.pdf"), false);
});

test("Kærhuset-udbud giver 1.1.1–1.1.9", () => {
  const text = UDBUD_CORPUS["job-kaerhuset"]![0]!.text;
  const parts = parseUdbudParts(text);
  assert.deepEqual(
    parts.map((p) => p.code),
    ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7", "1.1.8", "1.1.9"],
  );
  assert.match(parts.find((p) => p.code === "1.1.8")!.title, /Indervæg/i);
  assert.match(parts.find((p) => p.code === "1.1.6")!.title, /Ydervæg/i);
});

test("Hillerød-udbud giver 10.02-punkter, ikke stillads", () => {
  const parts = planForProject("job-hillerodsholm");
  assert.ok(parts.some((p) => p.code === "10.02.03"));
  assert.ok(parts.some((p) => p.code === "10.02.04"));
  assert.ok(!parts.some((p) => /stillads/i.test(p.title)));
});

test("Islev-udbud læser Zmur, ikke opdigtede punkter", () => {
  const scan = bundledUdbudScan("job-islevvaenge")!;
  assert.equal(scan.found, true);
  assert.match(scan.fileName, /Zmur|Murer/i);
  assert.ok(scan.parts.some((p) => p.code === "213.104"));
  assert.ok(scan.parts.some((p) => p.code === "213.202"));
});

test("Prøvestenen uden murer-fil: tom punktliste", () => {
  const scan = bundledUdbudScan("job-provestenen")!;
  assert.equal(scan.found, false);
  assert.equal(scan.parts.length, 0);
});

test("Kærhuset-rapport puds/overligger rammer 1.1.8", () => {
  const parts = planForProject("job-kaerhuset");
  const puds = matchUdbudPart("UDFØRSEL Puds af indvendig af vægge Indv", parts);
  assert.equal(puds?.code, "1.1.8");
  const over = matchUdbudPart("Teglsten overligger over alle døre og lave nye dørhuller", parts);
  assert.equal(over?.code, "1.1.8");
  const yder = matchUdbudPart("Ydervæg, eksist. murværk", parts);
  assert.equal(yder?.code, "1.1.6");
});

test("Kærhuset kundeside: hakket uden punkt = Øvrigt, ikke auto-udbud", () => {
  const job = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  assert.equal(slugForProject(job), "kaerhuset");
  const reports = softrKsReports();
  const three = reports.find((r) => r.number === "3" && r.projectId === "job-kaerhuset");
  assert.ok(three);
  assert.equal(three.kundeStatus, "med_til_kunden");
  assert.equal(partForReport(three)?.code, "ovrige");
  const site = buildKundeSite({ project: job, reports, photos: softrKsPhotos() });
  assert.equal(site.job.slug, "kaerhuset");
  assert.ok(site.parts.every((p) => p.code === "ovrige"));
  assert.ok(!site.parts.some((p) => p.code.startsWith("1.1")));
});

test("Hillerød kundeside: hakket uden punkt = Øvrigt", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const site = buildKundeSite({ project: job, reports: softrKsReports(), photos: softrKsPhotos() });
  assert.deepEqual(
    site.parts.map((p) => p.code),
    ["ovrige"],
  );
});

test("kapitel 3.6.5 tæller ikke som bygningsdel", () => {
  const parts = parseUdbudParts(
    "3.6.5 Genopretning må alene anvendes ved renovering\n1.1.8 Indervæg, eksist. murværk\n4.14 Kontrol: visuel\n",
  );
  assert.deepEqual(
    parts.map((p) => p.code),
    ["1.1.8"],
  );
});

test("Hillerød felt-KS er stadig 5.x — kundeside bruger 10.02", () => {
  const field = controlPlanFor("job-hillerodsholm");
  assert.ok(field.some((p) => p.code === "5.6"));
  assert.ok(!field.some((p) => p.code === "10.02.03"));
  const udbud = planForProject("job-hillerodsholm");
  assert.ok(udbud.some((p) => p.code === "10.02.03"));
});

test("Kærhuset felt-KS er udbuddets 1.1.1–1.1.9", () => {
  assert.deepEqual(
    controlPlanFor("job-kaerhuset").map((p) => p.code),
    ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.6", "1.1.7", "1.1.8", "1.1.9"],
  );
});

test("Prøvestenen kundeside er tom indtil murer-fil", () => {
  const job = PROJECTS.find((p) => p.id === "job-provestenen")!;
  const site = buildKundeSite({ project: job, reports: softrKsReports(), photos: softrKsPhotos() });
  assert.equal(site.parts.length, 0);
  assert.equal(site.reports.length, 0);
});

test("Islev hakket rapport uden murer-punkt vises alligevel", () => {
  const job = PROJECTS.find((p) => p.id === "job-islevvaenge")!;
  const plan = planForProject("job-islevvaenge");
  const site = buildKundeSite({ project: job, reports: softrKsReports(), photos: softrKsPhotos() });
  assert.ok(plan.some((p) => p.code === "213.104"));
  assert.ok(site.reports.length >= 1);
  assert.ok(site.parts.every((p) => p.code === "ovrige" || p.code.length > 0));
});
