#!/usr/bin/env node
/**
 * Uploads seed rows to the public `plads` bucket.
 * Reads SUPABASE_SECRET_KEY from env or .local/supabase-secret.
 * Never writes the secret to disk outside .local/.
 */
import { readFileSync } from "node:fs";
import { EMPLOYEES, PROJECTS, ASSIGNMENTS } from "../src/lib/seed.ts";

const URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const BUCKET = "plads";

function secret() {
  const env = (process.env.SUPABASE_SECRET_KEY || process.env.SB_SECRET || "").trim();
  if (env) return env;
  try {
    return readFileSync(new URL("../.local/supabase-secret", import.meta.url), "utf8").trim();
  } catch {
    try {
      return readFileSync("/workspace/.local/supabase-secret", "utf8").trim();
    } catch {
      return "";
    }
  }
}

async function put(path, body, mime = "application/json") {
  const key = secret();
  if (!key) throw new Error("SUPABASE_SECRET_KEY mangler (ikke i sitet — kun env/.local)");
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": mime,
    "x-upsert": "true",
    "cache-control": "no-cache",
  };
  const url = `${URL}/storage/v1/object/${BUCKET}/${path}`;
  let res = await fetch(url, { method: "POST", headers, body: payload });
  if (!res.ok) res = await fetch(url, { method: "PUT", headers, body: payload });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return path;
}

const employees = EMPLOYEES.map((e) => ({
  id: e.id,
  name: e.name,
  role: e.role,
  language: e.language,
  pin: e.pin,
  initials: e.initials,
  payrollNo: e.payrollNo ?? null,
}));
const projects = PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  address: p.address,
  lat: p.lat,
  lng: p.lng,
  radiusM: p.radiusM,
  brief: p.brief,
  huddle: p.huddle,
  nextTask: p.nextTask,
  status: p.status,
  customer: p.customer,
  createdBy: p.createdBy,
  source: p.source,
  ksType: p.ksType,
  trade: p.trade,
  period: p.period,
}));
const serial = { as: 6, tf: 7, er: 1, ks: 5, fb: 1, mo: 1 };

const jobs = [];
for (const row of employees) jobs.push(put(`tables/employees/${row.id}.json`, row));
for (const row of projects) jobs.push(put(`tables/projects/${row.id}.json`, row));
for (const row of ASSIGNMENTS) jobs.push(put(`tables/assignments/${row.employeeId}__${row.projectId}.json`, row));
jobs.push(put("tables/serials/current.json", serial));
jobs.push(
  put("yard/state.json", {
    updatedAt: new Date().toISOString(),
    state: {
      employees,
      projects,
      assignments: ASSIGNMENTS,
      serial,
      todos: [],
      chats: [],
      ksReports: [],
      days: {},
      needs: [],
      orders: [],
    },
  }),
);
jobs.push(
  put("system/tables.json", {
    note: "JSON-tabeller i bucket plads. Secret-nøglen må aldrig i sitet.",
    tables: [
      "employees",
      "projects",
      "assignments",
      "todos",
      "tfs",
      "slips",
      "ents",
      "ks_reports",
      "orders",
      "messages",
      "plan_blocks",
      "day_logs",
      "notices",
      "needs",
      "receipts",
      "field_items",
      "issues",
      "serials",
    ],
  }),
);

const done = await Promise.all(jobs);
console.log(`seed ok · ${done.length} filer`);
