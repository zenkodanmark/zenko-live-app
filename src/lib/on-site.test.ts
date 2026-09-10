import assert from "node:assert/strict";
import test from "node:test";
import { boardedCount, isOnSite, presentOnProject } from "./on-site.ts";
import type { DayLog, Employee } from "./types.ts";

function emp(id: string, name: string, role: Employee["role"] = "svend"): Employee {
  return { id, name, role, language: "da", pin: "1111", initials: name.slice(0, 2).toUpperCase() };
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

function key(id: string) {
  return `${id}:${today()}`;
}

function day(employeeId: string, projectId: string, open: boolean): DayLog {
  const at = `${today()}T06:00:00.000Z`;
  const out = `${today()}T14:00:00.000Z`;
  return {
    employeeId,
    date: today(),
    projectId,
    checkInAt: at,
    checkOutAt: open ? null : out,
    pauseStartedAt: null,
    pauseMinutes: 0,
    photos: [],
    gpsInside: true,
    checkInGps: { lat: 55.93, lng: 12.31, at, source: "device" },
    checkOutGps: open ? null : { lat: 55.93, lng: 12.31, at: out, source: "device" },
    demoGps: false,
    status: open ? "open" : "ready",
  };
}

test("isOnSite kræver mødt uden gået", () => {
  assert.equal(isOnSite({ checkInAt: "x", checkOutAt: null }), true);
  assert.equal(isOnSite({ checkInAt: "x", checkOutAt: "y" }), false);
  assert.equal(isOnSite({ checkInAt: null, checkOutAt: null }), false);
});

test("tavle tæller alle — også mester og nyoprettet", () => {
  const people = [emp("emp-ole", "Ole", "mester"), emp("emp-alex", "Alex", "laerling"), emp("emp-created", "Ny svend")];
  const days: Record<string, DayLog> = {
    [key("emp-ole")]: day("emp-ole", "job-hillerodsholm", true),
    [key("emp-alex")]: day("emp-alex", "job-hillerodsholm", false),
  };
  const n = boardedCount(people, days);
  assert.equal(n.total, 3);
  assert.equal(n.met, 1);
});

test("sag viser kun dem der er mødt på den sag", () => {
  const people = [emp("emp-ole", "Ole", "mester"), emp("emp-alex", "Alex"), emp("emp-ion", "Ion")];
  const days: Record<string, DayLog> = {
    [key("emp-ole")]: day("emp-ole", "job-hillerodsholm", true),
    [key("emp-alex")]: day("emp-alex", "job-islevvaenge", true),
    [key("emp-ion")]: day("emp-ion", "job-hillerodsholm", false),
  };
  const onHill = presentOnProject(people, days, "job-hillerodsholm").map((e) => e.id);
  assert.deepEqual(onHill, ["emp-ole"]);
  const afterLeave = presentOnProject(
    people,
    { ...days, [key("emp-ole")]: day("emp-ole", "job-hillerodsholm", false) },
    "job-hillerodsholm",
  );
  assert.equal(afterLeave.length, 0);
});

test("mødt på ny sag fjerner personen fra den gamle", () => {
  const people = [emp("emp-ole", "Ole", "mester")];
  const moved: Record<string, DayLog> = {
    [key("emp-ole")]: day("emp-ole", "job-islevvaenge", true),
  };
  assert.equal(presentOnProject(people, moved, "job-hillerodsholm").length, 0);
  assert.equal(presentOnProject(people, moved, "job-islevvaenge")[0]?.id, "emp-ole");
});
