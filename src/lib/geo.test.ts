import assert from "node:assert/strict";
import test from "node:test";
import { formatDaAddress } from "./geo";

test("formatDaAddress: vej + husnr + postnr by", () => {
  assert.equal(
    formatDaAddress({
      road: "Søndergade",
      house_number: "12",
      postcode: "4450",
      city: "Jyderup",
    }),
    "Søndergade 12, 4450 Jyderup",
  );
});

test("formatDaAddress: mangler husnr", () => {
  assert.equal(
    formatDaAddress({
      road: "Holbækvej",
      postcode: "4450",
      village: "Jyderup",
    }),
    "Holbækvej, 4450 Jyderup",
  );
});

test("formatDaAddress: falder tilbage til display_name", () => {
  assert.equal(formatDaAddress({ display_name: "Jyderup, Danmark" }), "Jyderup, Danmark");
});
