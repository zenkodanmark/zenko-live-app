import { writeFileSync, readFileSync } from "node:fs";
import { EMPLOYEES, PROJECTS, ASSIGNMENTS } from "../src/lib/seed.ts";

function q(v) {
  if (v == null) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lines = [];
lines.push("");
lines.push("-- Seed (ansatte, sager, tildelinger, serienumre)");
lines.push("insert into employees (id, name, role, language, pin, initials, payroll_no) values");
lines.push(
  EMPLOYEES.map(
    (e) =>
      `  (${q(e.id)}, ${q(e.name)}, ${q(e.role)}, ${q(e.language)}, ${q(e.pin)}, ${q(e.initials)}, ${q(e.payrollNo ?? null)})`,
  ).join(",\n"),
);
lines.push(
  "on conflict (id) do update set name = excluded.name, role = excluded.role, language = excluded.language, pin = excluded.pin, initials = excluded.initials, payroll_no = excluded.payroll_no;",
);
lines.push("");
lines.push(
  "insert into projects (id, name, address, lat, lng, radius_m, brief, huddle, next_task, status, customer, created_by, udbud_folder_id, source, ks_type, handed_over_at, archived_at) values",
);
lines.push(
  PROJECTS.map(
    (p) =>
      `  (${q(p.id)}, ${q(p.name)}, ${q(p.address)}, ${p.lat}, ${p.lng}, ${p.radiusM}, ${q(p.brief)}, ${q(p.huddle)}, ${q(p.nextTask)}, ${q(p.status)}, ${q(p.customer)}, ${q(p.createdBy)}, ${q(p.udbudFolderId)}, ${q(p.source)}, ${q(p.ksType ?? null)}, ${q(p.handedOverAt ?? null)}, ${q(p.archivedAt ?? null)})`,
  ).join(",\n"),
);
lines.push(
  "on conflict (id) do update set name = excluded.name, address = excluded.address, brief = excluded.brief, huddle = excluded.huddle, next_task = excluded.next_task, status = excluded.status;",
);
lines.push("");
lines.push("insert into assignments (employee_id, project_id) values");
lines.push(ASSIGNMENTS.map((a) => `  (${q(a.employeeId)}, ${q(a.projectId)})`).join(",\n"));
lines.push("on conflict do nothing;");
lines.push("");
lines.push("insert into serials (kind, next, year) values");
lines.push("  ('as', 6, 2026), ('tf', 7, 2026), ('er', 1, 2026), ('ks', 5, 2026), ('mo', 1, 2026), ('fb', 1, 2026)");
lines.push("on conflict (kind) do nothing;");
const seed = `${lines.join("\n")}\n`;
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), seed);
const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const schema = readFileSync(schemaPath, "utf8");
if (!schema.includes("insert into employees (id, name, role")) {
  writeFileSync(schemaPath, `${schema.trimEnd()}\n${seed}`);
}
console.log("seed sql ready");
