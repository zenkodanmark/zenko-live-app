import assert from "node:assert/strict";
import test from "node:test";
import { shownMaThreadText, toSupplierThread } from "./ma-thread.ts";
import type { MaThreadMsg } from "./types.ts";

const ansat: MaThreadMsg = {
  from: "ansat",
  name: "Osvaldo",
  text: "Hvor er pallen?",
  original: "¿Dónde está el palet?",
  sourceLang: "es",
  translations: { da: "Hvor er pallen?", es: "¿Dónde está el palet?" },
  at: "2026-09-06T08:00:00.000Z",
};

test("trælast ser dansk og Zenko, ikke ansat", () => {
  const pub = toSupplierThread(ansat);
  assert.equal(pub.from, "mester");
  assert.equal(pub.text, "Hvor er pallen?");
  assert.equal(pub.original, "¿Dónde está el palet?");
});

test("ansat ser sit sprog, mester ser dansk", () => {
  assert.equal(shownMaThreadText(ansat, "es", "svend"), "¿Dónde está el palet?");
  assert.equal(shownMaThreadText(ansat, "es", "mester"), "Hvor er pallen?");
});
