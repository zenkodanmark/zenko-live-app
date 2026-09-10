import assert from "node:assert/strict";
import test from "node:test";
import { holdRow, mergeById, mergeChats, mergeEmployeeAssignments, mergePlans, mergeReports, slimChat } from "./yard-slim.ts";
import type { ChatMessage, PlanBlock, Todo } from "./types.ts";

test("server overskriver lokal to-do med samme id", () => {
  const local = [{ id: "td-1", title: "gammel" } as Todo, { id: "td-2", title: "kun her" } as Todo];
  const remote = [{ id: "td-1", title: "ny" } as Todo];
  const out = mergeById(local, remote);
  assert.equal(out.find((t) => t.id === "td-1")?.title, "ny");
  assert.equal(out.find((t) => t.id === "td-2")?.title, "kun her");
});

test("chat slim fjerner stor dataUrl når Drive har filen", () => {
  const row = {
    id: "ch-1",
    at: "2026-09-05T18:00:00.000Z",
    fromId: "emp-alex",
    to: { kind: "employee", id: "emp-ole" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "foto",
    translations: { da: "foto" },
    viaVoice: false,
    photos: [{ dataUrl: "data:image/jpeg;base64,aaaa", driveFileId: "file-1" }],
  } as ChatMessage;
  const slim = slimChat(row);
  assert.equal(slim.photos?.[0]?.dataUrl, "");
  assert.equal(slim.photos?.[0]?.driveFileId, "file-1");
});

test("chat-merge bevarer oversættelse og foto som serveren mangler", () => {
  const local = {
    id: "ch-1",
    at: "2026-09-05T18:00:00.000Z",
    fromId: "emp-ole",
    to: { kind: "employee", id: "emp-ion" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului" },
    viaVoice: false,
    photos: [{ id: "p1", dataUrl: "data:image/jpeg;base64,xxx", name: "foto.jpg" }],
  } as ChatMessage;
  const remote = {
    ...local,
    translations: { da: "Ryd bag skuret" },
    photos: [{ id: "p1", name: "foto.jpg" }],
  } as ChatMessage;
  const out = mergeChats([local], [remote]);
  const hit = out.find((c) => c.id === "ch-1");
  assert.equal(hit?.translations.ro, "Curăță în spatele șopronului");
  assert.equal(hit?.photos?.[0]?.dataUrl, "data:image/jpeg;base64,xxx");
});

type Row = { id: string; number?: string; ledelseStatus?: string; updatedAt?: string };

test("mergeReports beholder lokalt hak når cloud-rækken mangler flaget", () => {
  const local: Row[] = [{ id: "tf-007", number: "Z-TF-2026-007", ledelseStatus: "med_til_ledelse" }];
  const remote: Row[] = [{ id: "tf-007", number: "Z-TF-2026-007" }];
  const merged = mergeReports(local, remote);
  assert.equal(merged[0]?.ledelseStatus, "med_til_ledelse");
});

test("mergeReports tager cloud-skjult og cloud-ja", () => {
  const local: Row[] = [{ id: "a", ledelseStatus: "med_til_ledelse" }, { id: "b", ledelseStatus: "skjult" }];
  const remote: Row[] = [{ id: "a", ledelseStatus: "skjult" }, { id: "b", ledelseStatus: "med_til_ledelse" }];
  const merged = mergeReports(local, remote);
  assert.equal(merged.find((r) => r.id === "a")?.ledelseStatus, "skjult");
  assert.equal(merged.find((r) => r.id === "b")?.ledelseStatus, "med_til_ledelse");
});

test("mergeReports springer en række over som lige er hakket", () => {
  holdRow("tf-held");
  const local: Row[] = [{ id: "tf-held", ledelseStatus: "med_til_ledelse" }];
  const remote: Row[] = [{ id: "tf-held", ledelseStatus: "skjult" }];
  const merged = mergeReports(local, remote);
  assert.equal(merged[0]?.ledelseStatus, "med_til_ledelse");
});

test("mergeReports tager den nyeste hak når tiderne er sat", () => {
  const local: Row[] = [{ id: "tf-007", ledelseStatus: "med_til_ledelse", updatedAt: "2026-09-09T14:00:00.000Z" }];
  const remote: Row[] = [{ id: "tf-007", ledelseStatus: "skjult", updatedAt: "2026-09-09T10:00:00.000Z" }];
  const merged = mergeReports(local, remote, 0);
  assert.equal(merged[0]?.ledelseStatus, "med_til_ledelse");
});

test("mergePlans beholder lokale dage når skyen er tom", () => {
  const local: PlanBlock[] = [
    {
      id: "pl-1",
      employeeId: "emp-ole",
      projectId: "job-hillerodsholm",
      title: "Ryd stillads",
      start: "2026-09-09",
      end: "2026-09-10",
      createdAt: "2026-09-09T10:00:00.000Z",
      createdBy: "ledelse",
      source: "plan-grid",
      days: ["2026-09-09", "2026-09-10"],
      todoId: "td-ryd-stillads",
    },
  ];
  const remote: PlanBlock[] = [
    {
      id: "pl-1",
      employeeId: "emp-ole",
      projectId: "job-hillerodsholm",
      title: "Ryd stillads",
      start: "2026-09-09",
      end: "2026-09-10",
      createdAt: "2026-09-09T10:00:00.000Z",
      createdBy: "ledelse",
      source: "plan-grid",
    },
  ];
  const merged = mergePlans(local, remote, 0);
  assert.deepEqual(merged[0]?.days, ["2026-09-09", "2026-09-10"]);
  assert.equal(merged[0]?.todoId, "td-ryd-stillads");
});

test("tom remote lader lokale tildelinger stå", () => {
  const local = [{ employeeId: "emp-alex", projectId: "job-kaerhuset" }];
  assert.deepEqual(mergeEmployeeAssignments(local, []), local);
});

test("remote erstatter kun den medarbejder der ikke er holdt", () => {
  const local = [
    { employeeId: "emp-alex", projectId: "job-hillerodsholm" },
    { employeeId: "emp-ole", projectId: "job-kaerhuset" },
  ];
  const remote = [
    { employeeId: "emp-alex", projectId: "job-kaerhuset" },
    { employeeId: "emp-ole", projectId: "job-kaerhuset" },
  ];
  const merged = mergeEmployeeAssignments(local, remote, 0);
  assert.equal(merged.some((a) => a.employeeId === "emp-alex" && a.projectId === "job-kaerhuset"), true);
  assert.equal(merged.some((a) => a.employeeId === "emp-alex" && a.projectId === "job-hillerodsholm"), false);
});

test("holdt medarbejder beholdes lokalt efter Gem", () => {
  holdRow("assign:emp-alex");
  const local = [{ employeeId: "emp-alex", projectId: "job-kaerhuset" }];
  const remote = [{ employeeId: "emp-alex", projectId: "job-hillerodsholm" }];
  const merged = mergeEmployeeAssignments(local, remote);
  assert.deepEqual(merged, local);
});
