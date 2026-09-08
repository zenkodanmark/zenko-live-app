import assert from "node:assert/strict";
import test from "node:test";
import { heuristicFix, parseModelPatch, snapshotOf } from "./report-fix.ts";

const slip = snapshotOf("slip", {
  title: "Udkradsning af fuger — skorsten top",
  location: "Hillerødsholm, skorsten tag",
  body: "Udkradsning af fuger på skorstenstoppen.",
  masterSolution: "Ekstra arbejde. Pris efter regning.",
  customerPrice: "0 kr",
  hoursEst: 0,
  materialsEst: "—",
});

test("heuristic retter titel, sted, tekst og pris — ikke kun pris", () => {
  const patch = heuristicFix(
    "slip",
    "Titlen skal være Omfugning skorsten top. Lokation skal være Hillerødsholm, taget. Beskrivelsen skal være Udkradsning og omfugning mens stillads er oppe. Pris 8500 kr.",
    slip,
  );
  assert.equal(patch.title, "Omfugning skorsten top.");
  assert.match(String(patch.location), /taget/i);
  assert.match(String(patch.body), /stillads/i);
  assert.equal(patch.customerPrice, "8.500 kr");
});

test("parser tager felter på topniveau (ikke kun nested patch)", () => {
  const parsed = parseModelPatch(
    JSON.stringify({
      title: "Omfugning skorsten top",
      body: "Udkradsning og omfugning. Stillads og overdækning er oppe.",
      customerPrice: "8500",
      summary: "Rettede titel, beskrivelse og pris.",
    }),
    "slip",
    slip,
  );
  assert.equal(parsed.patch.title, "Omfugning skorsten top");
  assert.match(String(parsed.patch.body), /Stillads/);
  assert.equal(parsed.patch.customerPrice, "8500 kr");
});

test("parser tager nested patch", () => {
  const parsed = parseModelPatch(
    JSON.stringify({
      patch: { title: "Ny titel", location: "1. sal altan" },
      summary: "Rettede titel og lokation.",
    }),
    "slip",
    slip,
  );
  assert.equal(parsed.patch.title, "Ny titel");
  assert.equal(parsed.patch.location, "1. sal altan");
  assert.equal(parsed.patch.customerPrice, undefined);
});
