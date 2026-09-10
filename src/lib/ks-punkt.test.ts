import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeKundePunkt,
  kundePunktFromPhotoIds,
  photoIdsWithPunkt,
  photoIdsWithoutPunkt,
  punktChoices,
  shortPunktTitle,
  udbudChoices,
} from "./ks-punkt.ts";

test("sentinel i photo_ids rundes tur-retur", () => {
  const ids = photoIdsWithPunkt(["p1", "p2"], "Omfugning");
  assert.ok(ids.includes("p1") && ids.includes("p2"));
  assert.equal(kundePunktFromPhotoIds(ids), "Omfugning");
  assert.deepEqual(photoIdsWithoutPunkt(ids), ["p1", "p2"]);
  assert.equal(encodeKundePunkt("Omfugning"), "__kp:Omfugning");
});

test("tomt punkt fjerner sentinel", () => {
  const ids = photoIdsWithPunkt(["p1", "__kp:x"], "");
  assert.deepEqual(ids, ["p1"]);
  assert.equal(kundePunktFromPhotoIds(ids), undefined);
});

test("kort titel stripper kode og bindestreg-hale", () => {
  assert.equal(shortPunktTitle("10.02.03 Iboring af renoveringsbindere"), "Iboring af renoveringsbindere");
  assert.equal(shortPunktTitle("1.1.8 Indervæg, eksist. murværk – puds"), "Indervæg, eksist. murværk");
});

test("udbud-valg til Hillerød rummer 10.02.03", () => {
  const c = udbudChoices("job-hillerodsholm");
  assert.ok(c.some((x) => x.value === "10.02.03"));
  assert.ok(c.every((x) => x.label.includes(x.value)));
});

test("custom punkt kommer med i dropdown", () => {
  const list = punktChoices("job-kaerhuset", [
    { projectId: "job-kaerhuset", kundePunkt: "Filsning altaner" },
    { projectId: "job-kaerhuset", kundePunkt: "1.1.8" },
  ]);
  assert.ok(list.some((c) => c.value === "Filsning altaner" && c.custom));
});
