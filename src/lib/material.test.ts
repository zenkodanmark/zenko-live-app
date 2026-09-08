import assert from "node:assert/strict";
import test from "node:test";
import { findProdukt, findProdukter, guessFromPhotoNote, isMaterialNeed, matchModtagelse, orderLines, scanBehov } from "./material.ts";

test("scan_behov finder mørtel, brædder, afdækning", () => {
  const keys = scanBehov("jeg mangler mørtel, brædder og afdækning");
  assert.deepEqual(keys, ["mørtel", "brædder", "afdækning"]);
  assert.equal(isMaterialNeed("jeg mangler mørtel"), true);
});

test("Islevvænge mørtel er KC 50/50/700 — aldrig Weber", () => {
  const hit = findProdukt("job-islevvaenge", "mørtel");
  assert.equal(hit.found, true);
  assert.match(hit.product, /KC\s*50\/50\/700/i);
  assert.equal(/weber/i.test(hit.product), false);
  assert.equal(/weber/i.test(hit.spec), false);
});

test("Hillerødsholm mørtel er KKh 35/65/500", () => {
  const hit = findProdukt("job-hillerodsholm", "mørtel");
  assert.equal(hit.found, true);
  assert.match(hit.product, /KKh?\s*35\/65\/500/i);
  assert.equal(/weber/i.test(`${hit.product} ${hit.spec}`), false);
});

test("brædder står ikke i udbud — udfyld selv", () => {
  const hit = findProdukt("job-islevvaenge", "brædder");
  assert.equal(hit.found, false);
  assert.equal(hit.cite, "ikke i udbud — udfyld selv");
  assert.equal(hit.product, "");
});

test("flere nøgler: mørtel fundet, afdækning ikke", () => {
  const rows = findProdukter("job-hillerodsholm", ["mørtel", "afdækning"]);
  assert.equal(rows[0]?.found, true);
  assert.equal(rows[1]?.found, false);
});

test("match advarer ved forkert produkt og antal", () => {
  const a = matchModtagelse("KC 50/50/700", 10, "Weber 700", 10);
  assert.equal(a.ok, false);
  assert.match(a.warning, /Weber 700/);
  const b = matchModtagelse("KC 50/50/700", 10, "KC 50/50/700", 8);
  assert.equal(b.ok, false);
  assert.match(b.warning, /bestilte 10, foto viser 8/);
  const c = matchModtagelse("KC 50/50/700", 10, "KC 50/50/700", 10);
  assert.equal(c.ok, true);
});

test("foto-note tager ikke 700 fra mørtelkoden som antal", () => {
  const a = guessFromPhotoNote("Weber 700");
  assert.equal(a.product.toLowerCase(), "weber 700");
  assert.equal(a.qty, null);
  const b = guessFromPhotoNote("8 sække Weber 700");
  assert.equal(b.qty, 8);
  const c = guessFromPhotoNote("KC 50/50/700 10 stk");
  assert.equal(c.qty, 10);
});

test("orderLines bruger ekstra linjer når de findes", () => {
  const rows = orderLines({
    product: "KC 50/50/700",
    qty: 10,
    unit: "stk",
    lines: [
      { product: "KC 50/50/700", spec: "", qty: 10, unit: "stk", inUdbud: true },
      { product: "Afdækning", spec: "", qty: 2, unit: "stk", inUdbud: false },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.product, "Afdækning");
  const one = orderLines({ product: "Stillads", qty: 1, unit: "stk", inUdbud: true });
  assert.equal(one.length, 1);
  assert.equal(one[0]?.product, "Stillads");
});
