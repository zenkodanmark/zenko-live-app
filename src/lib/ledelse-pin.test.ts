import assert from "node:assert/strict";
import test from "node:test";
import {
  generateLedelsePin,
  isFourPin,
  isLedelseUnlocked,
  ledelseClipboard,
  ledelsePublicUrl,
  normalizePin,
  writeSessionPin,
} from "./ledelse-pin.ts";

test("kode er 4 cifre", () => {
  const pin = generateLedelsePin();
  assert.equal(pin.length, 4);
  assert.equal(isFourPin(pin), true);
  assert.equal(isFourPin("12"), false);
  assert.equal(normalizePin("12ab34"), "1234");
});

test("udklip har sag, github-url og kode", () => {
  const text = ledelseClipboard("Hillerødsholm", "hilleroedsholm", "4821");
  assert.equal(
    text,
    "Hillerødsholm\nhttps://zenkodanmark.github.io/sag/hilleroedsholm\nKode: 4821",
  );
  assert.equal(ledelsePublicUrl("hilleroedsholm"), "https://zenkodanmark.github.io/sag/hilleroedsholm");
});

test("forkert kode låser ikke op", () => {
  const store: Record<string, string> = {};
  const fake = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  (globalThis as { sessionStorage?: typeof fake }).sessionStorage = fake;
  assert.equal(isLedelseUnlocked("hilleroedsholm", "4821"), false);
  writeSessionPin("hilleroedsholm", "4821");
  assert.equal(isLedelseUnlocked("hilleroedsholm", "4821"), true);
  assert.equal(isLedelseUnlocked("hilleroedsholm", "0000"), false);
  assert.equal(isLedelseUnlocked("hilleroedsholm", ""), false);
});
