import assert from "node:assert/strict";
import test from "node:test";
import { dropColumn, isMissingTableError, isUnknownColumnError, unknownColumnName, upsertKnown } from "./sb-upsert.ts";

test("kender PostgREST-manglende-kolonne", () => {
  assert.equal(
    isUnknownColumnError({
      code: "PGRST204",
      message: "Could not find the 'kunde_status' column of 'ents' in the schema cache",
    }),
    true,
  );
  assert.equal(unknownColumnName({ message: "Could not find the 'kunde_status' column of 'ents' in the schema cache" }), "kunde_status");
  assert.equal(isUnknownColumnError({ message: "duplicate key" }), false);
  assert.equal(isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.offers' in the schema cache" }), true);
  assert.equal(isMissingTableError({ code: "PGRST204", message: "Could not find the 'kunde_status' column of 'ents' in the schema cache" }), false);
});

test("dropColumn fjerner kun den ukendte", () => {
  const next = dropColumn({ id: "1", kunde_status: "x", title: "t" }, "kunde_status");
  assert.deepEqual(next, { id: "1", title: "t" });
});

test("upsertKnown stripper ukendt kolonne og rammer rigtig række", async () => {
  const sent: string[][] = [];
  const ok = await upsertKnown(async (row) => {
    sent.push(Object.keys(row).sort());
    if ("kunde_status" in row) {
      return { error: { code: "PGRST204", message: "Could not find the 'kunde_status' column of 'ents' in the schema cache" } };
    }
    return { error: null };
  }, { id: "ent-1", number: "Z-ER-2026-002", kunde_status: "skjult" });
  assert.equal(ok, true);
  assert.ok(sent[0]?.includes("kunde_status"));
  assert.deepEqual(sent[1], ["id", "number"]);
});
