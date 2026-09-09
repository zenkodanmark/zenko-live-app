#!/usr/bin/env node
/**
 * Upserts seed rows into Postgres via supabase-js REST.
 * Run AFTER schema.sql has been executed in SQL Editor.
 * Reads SUPABASE_SECRET_KEY from env or .local/supabase-secret.
 * Never writes the secret into the site.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { EMPLOYEES, PROJECTS, ASSIGNMENTS } from "../src/lib/seed.ts";

const URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";

function secret() {
  const env = (process.env.SUPABASE_SECRET_KEY || process.env.SB_SECRET || "").trim();
  if (env) return env;
  for (const file of [new URL("../.local/supabase-secret", import.meta.url), "/workspace/.local/supabase-secret"]) {
    try {
      const v = readFileSync(file, "utf8").trim();
      if (v) return v;
    } catch {
      /* skip */
    }
  }
  return "";
}

const key = secret();
if (!key) {
  console.error("SUPABASE_SECRET_KEY mangler (ikke i sitet — kun env/.local)");
  process.exit(1);
}

const sb = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

const employees = EMPLOYEES.map((e) => ({
  id: e.id,
  name: e.name,
  role: e.role,
  language: e.language,
  pin: e.pin,
  initials: e.initials ?? "",
  payroll_no: e.payrollNo ?? null,
}));
const projects = PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  address: p.address,
  lat: p.lat,
  lng: p.lng,
  radius_m: p.radiusM,
  brief: p.brief,
  huddle: p.huddle,
  next_task: p.nextTask,
  status: p.status,
  customer: p.customer ?? null,
  created_by: p.createdBy ?? null,
  udbud_folder_id: p.udbudFolderId ?? null,
  drive_root_id: p.driveRootId ?? null,
  source: p.source ?? null,
  ks_type: p.ksType ?? null,
  trade: p.trade ?? null,
  period: p.period ?? null,
  quality_manager: p.qualityManager ?? null,
  handed_over_at: p.handedOverAt ?? null,
  archived_at: p.archivedAt ?? null,
}));
const assignments = ASSIGNMENTS.map((a) => ({ employee_id: a.employeeId, project_id: a.projectId }));
const serials = [
  { kind: "as", next: 6, year: 2026 },
  { kind: "tb", next: 1, year: 2026 },
  { kind: "tf", next: 7, year: 2026 },
  { kind: "er", next: 1, year: 2026 },
  { kind: "ks", next: 5, year: 2026 },
  { kind: "mo", next: 1, year: 2026 },
  { kind: "fb", next: 1, year: 2026 },
];

async function upsert(table, rows) {
  const { error } = await sb.from(table).upsert(rows);
  if (error) {
    if (/PGRST205|schema cache|does not exist/i.test(error.message)) {
      throw new Error(`Tabel ${table} findes ikke. Kør supabase/schema.sql i SQL Editor først.`);
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

const n =
  (await upsert("employees", employees)) +
  (await upsert("projects", projects)) +
  (await upsert("assignments", assignments)) +
  (await upsert("serials", serials));
console.log(`seed ok · ${n} rækker i SQL-tabeller`);
