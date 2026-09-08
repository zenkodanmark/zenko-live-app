import assert from "node:assert/strict";
import test from "node:test";
import { gpsCaption, gpsPatch, todoAllPhotoIds } from "./photo-meta.ts";
import type { GpsFix } from "./types.ts";

test("todoAllPhotoIds samler oprettelse og udførsel", () => {
  assert.deepEqual(
    todoAllPhotoIds({
      photoFileIds: ["a", "b"],
      donePhotoFileIds: ["b", "c"],
      driveFileId: "a",
    }),
    ["a", "b", "c"],
  );
});

test("gpsPatch sætter telefon-koordinater", () => {
  const fix: GpsFix = {
    lat: 55.9324,
    lng: 12.2978,
    accuracyM: 8,
    altitudeM: null,
    heading: null,
    speedMps: null,
    at: "2026-09-05T09:00:00.000Z",
    source: "device",
  };
  const created = gpsPatch(fix, "create");
  assert.equal(created.lat, 55.9324);
  assert.ok(created.gpsLabel?.includes("telefon"));
  const cap = gpsCaption(fix, "Alex", "Hillerødsholm", new Date("2026-09-05T09:24:00"));
  assert.ok(cap.includes("Alex"));
  assert.ok(cap.includes("Hillerødsholm"));
});
