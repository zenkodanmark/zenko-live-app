import assert from "node:assert/strict";
import test from "node:test";
import { ensureSoftrKs, hydrateSoftrReport, softrKsPhotos, softrKsReports } from "./softr-ks.ts";

test("Softr KS dækker Hillerødsholm, Kærhuset og Islevvænge", () => {
  const rows = softrKsReports();
  assert.ok(rows.length >= 80);
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.projectId, (by.get(r.projectId) ?? 0) + 1);
  assert.ok((by.get("job-hillerodsholm") ?? 0) >= 30);
  assert.ok((by.get("job-kaerhuset") ?? 0) >= 30);
  assert.ok((by.get("job-islevvaenge") ?? 0) >= 10);
  const two = rows.find((r) => r.number === "2");
  assert.equal(two?.employeeName, "Federico");
  assert.equal(two?.projectId, "job-hillerodsholm");
  assert.equal(two?.photoIds?.length, 3);
  assert.equal(rows.find((r) => r.number === "45")?.employeeName, "Osvaldo");
  const three = rows.find((r) => r.number === "3");
  assert.equal(three?.projectId, "job-kaerhuset");
  assert.ok((three?.photoIds?.length ?? 0) >= 6);
  assert.ok(softrKsPhotos().length >= 600);
});

test("ensureSoftrKs overskriver tomme photoIds", () => {
  const state = {
    ksReports: softrKsReports().map((r) => ({ ...r, photoIds: [] as string[] })),
    drivePhotos: [],
  };
  ensureSoftrKs(state);
  assert.ok((state.ksReports.find((r) => r.number === "2")?.photoIds?.length ?? 0) >= 3);
  assert.ok(state.drivePhotos.some((p: { id: string }) => p.id.startsWith("softr-ks-2-")));
  assert.ok(state.ksReports.some((r) => r.number === "3" && r.projectId === "job-kaerhuset"));
});

test("ensureSoftrKs og hydrate bevarer kundePunkt", () => {
  const base = softrKsReports().find((r) => r.number === "3")!;
  const state = {
    ksReports: [{ ...base, kundePunkt: "Omfugning", photoIds: [] as string[] }],
    drivePhotos: [],
  };
  ensureSoftrKs(state);
  const row = state.ksReports.find((r) => r.id === base.id);
  assert.equal(row?.kundePunkt, "Omfugning");
  assert.ok((row?.photoIds?.length ?? 0) >= 1);
  const hydrated = hydrateSoftrReport({ ...base, kundePunkt: "Filsning altaner", kundeStatus: "med_til_kunden" });
  assert.equal(hydrated.kundePunkt, "Filsning altaner");
  assert.equal(hydrated.kundeStatus, "med_til_kunden");
});

test("hydrate og ensure overskriver ikke projectId", () => {
  const base = softrKsReports().find((r) => r.id === "ksr-softr-8")!;
  assert.equal(base.projectId, "job-kaerhuset");
  const hydrated = hydrateSoftrReport({ ...base, projectId: "job-kaerhuset", status: "issued" });
  assert.equal(hydrated.projectId, "job-kaerhuset");
  const state = {
    ksReports: [{ ...base, projectId: "job-kaerhuset" }],
    drivePhotos: [],
  };
  ensureSoftrKs(state);
  assert.equal(state.ksReports.find((r) => r.id === "ksr-softr-8")?.projectId, "job-kaerhuset");
});

