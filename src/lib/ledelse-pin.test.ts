import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureLedelsePin,
  generateLedelsePin,
  isFourPin,
  ledelseClipboard,
  ledelsePublicUrl,
  normalizePin,
  pinMatches,
} from "./ledelse-pin.ts";

test("kode er 4 cifre", () => {
  const pin = generateLedelsePin();
  assert.equal(pin.length, 4);
  assert.equal(isFourPin(pin), true);
  assert.equal(isFourPin("12"), false);
  assert.equal(normalizePin("12ab34"), "1234");
  assert.notEqual(pin, "0000");
});

test("udklip har sag, github-url og kode", () => {
  const text = ledelseClipboard("Hillerødsholm", "hilleroedsholm", "4821");
  assert.equal(
    text,
    "Hillerødsholm\nhttps://zenkodanmark.github.io/sag/hilleroedsholm\nKode: 4821",
  );
  assert.equal(ledelsePublicUrl("hilleroedsholm"), "https://zenkodanmark.github.io/sag/hilleroedsholm");
});

test("PIN kommer fra projects, ikke sessionStorage", () => {
  assert.equal(pinMatches("7462", "7462"), true);
  assert.equal(pinMatches("0000", "7462"), false);
  assert.equal(pinMatches("1234", "7462"), false);
  assert.equal(pinMatches("7462", ""), false);
  assert.equal(pinMatches("7462", undefined), false);
  assert.equal(ensureLedelsePin("7462"), "7462");
  const made = ensureLedelsePin("");
  assert.equal(isFourPin(made), true);
  assert.notEqual(made, "0000");
});