import assert from "node:assert/strict";
import test from "node:test";
import { PROJECTS } from "./seed.ts";
import { softrAsSlips } from "./softr-as.ts";
import { softrErReports } from "./softr-er.ts";
import { softrTfReports } from "./softr-tf.ts";
import { SEED_TFS } from "./seed.ts";
import {
  asPdfFilename,
  buildSagSite,
  bundledSagInputs,
  filterAs,
  filterTfs,
  paginate,
  parseAsMaterials,
  priceLabel,
  priceNumber,
  sagJobFields,
  sagPath,
  slugForProject,
  sumAsPrices,
  tfCounts,
} from "./sag-ledelse.ts";
import { defaultLedelseOn } from "./sag-ledelse-defaults.ts";

test("slug og sti er /sag/hilleroedsholm", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  assert.equal(slugForProject(job), "hilleroedsholm");
  assert.equal(sagPath("hilleroedsholm"), "/sag/hilleroedsholm");
  assert.equal(sagPath("hilleroedsholm", ["tf"]), "/sag/hilleroedsholm/tf");
  assert.equal(sagPath("hilleroedsholm", ["as"]), "/sag/hilleroedsholm/as");
  assert.equal(sagPath("hilleroedsholm", ["er"]), "/sag/hilleroedsholm/er");
  assert.equal(sagPath("hilleroedsholm", ["tf", "Z-TF-2026-006"]), "/sag/hilleroedsholm/tf/Z-TF-2026-006");
  assert.equal(sagPath("hilleroedsholm", ["as", "292"]), "/sag/hilleroedsholm/as/292");
});

test("AS-292 er 38.825,- ekskl. moms", () => {
  const slip = softrAsSlips().find((s) => s.number === "AS-292")!;
  assert.equal(priceNumber(slip.customerPrice), 38825);
  assert.equal(priceLabel(slip.customerPrice), "38.825,-");
  const mat = parseAsMaterials(slip.body);
  assert.match(mat.description, /3 mand/i);
  assert.ok(mat.lines.some((l) => /Stål/i.test(l.text) && l.amount === 6000));
  assert.ok(mat.lines.some((l) => /1\.300/i.test(l.text) && l.amount === 1300));
});

test("Hillerød byggeledelse viser kun hakket TF-006, AS-292 og ER-366", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const bundled = bundledSagInputs();
  const site = buildSagSite({
    project: job,
    tfs: bundled.tfs,
    slips: bundled.slips,
    ents: bundled.ents,
    fieldItems: bundled.fieldItems,
  });
  assert.ok(site.tfs.some((t) => t.number === "Z-TF-2026-006"));
  assert.ok(!site.tfs.some((t) => t.number === "Z-TF-2026-005"));
  assert.deepEqual(
    site.slips.map((s) => s.slug),
    ["292", "368", "383", "385", "387", "388"],
  );
  assert.equal(site.slips.find((s) => s.slug === "292")?.price, 38825);
  assert.ok(site.ents.some((e) => e.number === "ER-366"));
  assert.ok(!site.slips.some((s) => s.number === "AS-36"));
});

test("demo-hak rammer kun de seks AS, TF-006 og ER-366", () => {
  assert.equal(defaultLedelseOn("as", "AS-292"), true);
  assert.equal(defaultLedelseOn("as", "AS-36"), false);
  assert.equal(defaultLedelseOn("tf", "Z-TF-2026-006"), true);
  assert.equal(defaultLedelseOn("tf", "TF-4"), false);
  assert.equal(defaultLedelseOn("er", "ER-366"), true);
  assert.equal(softrTfReports().every((t) => !defaultLedelseOn("tf", t.number) || t.number === "Z-TF-2026-006"), true);
  assert.ok(SEED_TFS.some((t) => t.number === "Z-TF-2026-006"));
});

test("tomme sagsfelter vises ikke, PDF-navn og sum", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const bundled = bundledSagInputs();
  const site = buildSagSite({
    project: job,
    tfs: bundled.tfs,
    slips: bundled.slips,
    ents: bundled.ents,
    fieldItems: bundled.fieldItems,
  });
  const labels = sagJobFields(site.job).map(([k]) => k);
  assert.ok(!labels.includes("Periode") || site.job.period);
  const six = site.slips;
  assert.equal(six.length, 6);
  const tot = sumAsPrices(six);
  assert.equal(tot.missing, 0);
  assert.ok(tot.sum > 38825);
  assert.equal(asPdfFilename(site.job, "2026-09-05T08:00:00.000Z"), "Zenko_AS_hilleroedsholm_2026-09-05.pdf");
});

test("Kærhuset har sagsside-slug og ingen opdigtede AS", () => {
  const job = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  assert.equal(slugForProject(job), "kaerhuset");
  const bundled = bundledSagInputs();
  const site = buildSagSite({
    project: job,
    tfs: bundled.tfs,
    slips: bundled.slips,
    ents: bundled.ents,
    fieldItems: bundled.fieldItems,
  });
  assert.ok(site.job.scope.toLowerCase().includes("ruskær") || site.job.name === "Kærhuset");
  assert.ok(site.slips.every((s) => defaultLedelseOn("as", s.number)));
});

test("filter og 20 pr. side", () => {
  const job = PROJECTS.find((p) => p.id === "job-hillerodsholm")!;
  const bundled = bundledSagInputs();
  const site = buildSagSite({
    project: job,
    tfs: bundled.tfs,
    slips: bundled.slips,
    ents: bundled.ents,
    fieldItems: bundled.fieldItems,
  });
  const counts = tfCounts(site.tfs);
  assert.equal(counts.total, site.tfs.length);
  assert.equal(counts.open + counts.answered, counts.total);
  const open = filterTfs(site.tfs, { status: "open" });
  assert.equal(open.length, counts.open);
  const as292 = filterAs(site.slips, { q: "292" });
  assert.equal(as292.length, 1);
  assert.equal(as292[0]?.slug, "292");
  const pricey = filterAs(site.slips, { minPrice: 38825 });
  assert.ok(pricey.every((s) => (s.price ?? 0) >= 38825));
  const many = Array.from({ length: 45 }, (_, i) => i);
  const p2 = paginate(many, 2, 20);
  assert.equal(p2.pages, 3);
  assert.equal(p2.slice.length, 20);
  assert.equal(p2.slice[0], 20);
});
