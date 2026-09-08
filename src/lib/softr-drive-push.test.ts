import assert from "node:assert/strict";
import test from "node:test";
import { softrDriveJobs, softrKsDriveJobs } from "./softr-drive-push.ts";

test("softr drive jobs dækker lokale fotos inkl. KS på flere sager", () => {
  const jobs = softrDriveJobs();
  assert.ok(jobs.length >= 3400);
  const kinds = new Set(jobs.map((j) => j.kind));
  assert.deepEqual([...kinds].sort(), ["AS", "ER", "KS", "TF"]);
  assert.ok(jobs.every((j) => j.folderId && j.name && j.rel));
  const ks = softrKsDriveJobs();
  assert.ok(ks.length >= 600);
  const folders = new Set(ks.map((j) => j.folderId));
  assert.ok(folders.size >= 3);
});
