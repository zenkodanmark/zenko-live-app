import assert from "node:assert/strict";
import test from "node:test";
import { pileLabelKey } from "./board-piles.ts";
import { t } from "./i18n.ts";
import { defaultLedelseStatus } from "./sag-ledelse-defaults.ts";

test("TB-label og skjult indtil hak", () => {
  assert.equal(t("da", "rowTb"), "TB");
  assert.equal(t("da", "extraOffer"), "Tilbud");
  assert.equal(t("da", pileLabelKey("offer")), "TB");
  assert.equal(defaultLedelseStatus("tb", "TB-2026-001"), "skjult");
  assert.notEqual(defaultLedelseStatus("as", "292"), "skjult");
});
