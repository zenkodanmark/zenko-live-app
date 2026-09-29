import assert from "node:assert/strict";
import test from "node:test";
import { photoIdsForSave, visibleReportPhotos } from "./report-photos.ts";

const oldA = "https://example.com/plads/job/er/a.jpeg";
const oldB = "https://example.com/plads/job/er/b.jpeg";
const neu = "https://example.com/plads/job/er/c.jpeg";

test("tekst-gem beholder gamle URL'er og softr-id", () => {
  const prev = ["softr-as-396-1", oldA, oldB];
  assert.deepEqual(photoIdsForSave(prev, [], false), prev);
  assert.deepEqual(photoIdsForSave(prev, [neu], false), prev);
});

test("nye fotos lægges oven i de gamle URL'er", () => {
  const prev = ["softr-as-396-1", oldA];
  assert.deepEqual(photoIdsForSave(prev, [...prev, neu, oldA], true), ["softr-as-396-1", oldA, neu]);
});

test("slet alle URL'er giver tom liste når intet andet er tilbage", () => {
  assert.deepEqual(photoIdsForSave([oldA, oldB], [], true), []);
});

test("slet ét foto beholder de andre", () => {
  assert.deepEqual(photoIdsForSave([oldA, oldB, "softr-as-1"], [oldB, "softr-as-1"], true), [oldB, "softr-as-1"]);
});

test("data-url gemmes aldrig", () => {
  const data = "data:image/jpeg;base64,abc";
  assert.deepEqual(photoIdsForSave([oldA, data], [oldA, data, neu], true), [oldA, neu]);
  assert.deepEqual(visibleReportPhotos([data, oldA]).map((p) => p.src), [oldA]);
});

test("visning er kun http-URL, softr springes over, ingen dublet", () => {
  const pics = visibleReportPhotos(["softr-as-396-1", oldA, oldA + "?v=2", oldB, "fld-1", ""]);
  assert.deepEqual(pics.map((p) => p.src), [oldA, oldB]);
  assert.equal(pics.some((p) => p.src.includes("softr")), false);
});
