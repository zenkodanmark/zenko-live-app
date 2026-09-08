import assert from "node:assert/strict";
import test from "node:test";
import { yardSnapshotJson } from "./snapshot.ts";
import { ASSIGNMENTS, EMPLOYEES, PROJECTS } from "./seed.ts";

test("snapshot er JSON uden billeddata", () => {
  const json = yardSnapshotJson({
    employees: EMPLOYEES,
    projects: PROJECTS,
    assignments: ASSIGNMENTS,
    plans: [
      {
        id: "pl-1",
        employeeId: "emp-alex",
        projectId: "job-hillerodsholm",
        title: "Fugearbejde",
        start: "2026-09-07",
        end: "2026-09-09",
        createdAt: "2026-09-04T08:00:00.000Z",
        createdBy: "emp-ole",
        source: "bot",
      },
    ],
    todos: [],
    days: {
      "emp-osvaldo:2026-09-03": {
        employeeId: "emp-osvaldo",
        date: "2026-09-03",
        projectId: "job-hillerodsholm",
        checkInAt: "2026-09-03T05:00:00.000Z",
        checkOutAt: "2026-09-03T13:00:00.000Z",
        pauseStartedAt: null,
        pauseMinutes: 0,
        photos: [{ id: "x", dataUrl: "data:image/jpeg;base64,AAA", takenAt: "", floor: "", room: "", point: "", gpsLabel: "", lat: null, lng: null, accuracyM: null, gpsSource: "unknown", projectId: "job-hillerodsholm", projectName: "Hillerødsholm", employeeId: "emp-osvaldo", employeeName: "Osvaldo" }],
        gpsInside: true,
        checkInGps: null,
        checkOutGps: null,
        demoGps: false,
        status: "ready",
        workNote: "filsning",
        source: "datalon",
      },
    },
    slips: [],
    tfs: [],
    ents: [],
    ksReports: [],
    packs: [],
    cal: [],
    chats: [],
  });
  const obj = JSON.parse(json) as { kind: string; hours: { note: string }[]; plans: { title: string }[] };
  assert.equal(obj.kind, "zenko-admin-backup");
  assert.equal(obj.plans[0]?.title, "Fugearbejde");
  assert.equal(obj.hours[0]?.note, "filsning");
  assert.equal(json.includes("data:image"), false);
  assert.equal(json.includes("base64"), false);
});
