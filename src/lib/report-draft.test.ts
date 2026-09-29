import assert from "node:assert/strict";
import test from "node:test";
import { draftDirty, serverCue } from "./report-draft.ts";

test("kladde er dirty når body ændres, ikke når den er ens", () => {
  const base = { title: "A", body: "linje", location: "tag", customerPrice: "100" };
  assert.equal(draftDirty(base, base), false);
  assert.equal(draftDirty(base, { ...base, body: "linje\nlinje\nÆØÅ" }), true);
  assert.equal(draftDirty(base, { ...base, customerPrice: "200" }), true);
  assert.equal(draftDirty(base, { ...base }), false);
});

test("poll overskriver ikke en dirty kladde", () => {
  assert.equal(serverCue({ dirty: true, baseStamp: "2026-09-21T10:00:00.000Z", serverStamp: "2026-09-21T10:00:00.000Z" }), "keep");
  assert.equal(serverCue({ dirty: true, baseStamp: "2026-09-21T10:00:00.000Z", serverStamp: "2026-09-21T10:00:05.000Z" }), "ask");
  assert.equal(serverCue({ dirty: false, baseStamp: "2026-09-21T10:00:00.000Z", serverStamp: "2026-09-21T10:00:05.000Z" }), "adopt");
  assert.equal(serverCue({ dirty: true, baseStamp: "", serverStamp: "" }), "keep");
});
