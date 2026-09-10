import { EMPLOYEES } from "./crew.ts";
import type { Employee } from "./types.ts";

const KEY = "zenko-crew-v1";
const PERSIST_KEY = "zenko-plads-v32";

function four(pin: unknown) {
  const s = String(pin ?? "").replace(/\D/g, "");
  return s.length === 4 ? s : "";
}

export function isDummyEmployee(e: { id?: string; name?: string } | null | undefined) {
  if (!e) return true;
  const id = String(e.id || "");
  const name = String(e.name || "").trim();
  if (!id) return true;
  if (id === "emp-ny" || id.startsWith("emp-ny-")) return true;
  if (/^testsvend$/i.test(name)) return true;
  return false;
}

export function dropDummyEmployees(rows: Employee[] | undefined | null): Employee[] {
  const seen = new Set<string>();
  const out: Employee[] = [];
  for (const e of rows ?? []) {
    if (!e?.id || isDummyEmployee(e) || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function migrateFromPersist(): Employee[] {
  const raw = readJson(PERSIST_KEY) as { state?: { employees?: Employee[] }; employees?: Employee[] } | null;
  const rows = raw?.state?.employees ?? raw?.employees;
  return Array.isArray(rows) ? rows : [];
}

/** Login + Folk: cached employees-table. Ingen Testsvend. Ingen seed ovenpå. */
export function loadCrew(): Employee[] {
  if (typeof window === "undefined") return EMPLOYEES;
  const cached = readJson(KEY);
  const fromCache = dropDummyEmployees(Array.isArray(cached) ? (cached as Employee[]) : []);
  if (fromCache.length) {
    if (Array.isArray(cached) && cached.length !== fromCache.length) saveCrew(fromCache);
    return fromCache;
  }
  const migrated = dropDummyEmployees(migrateFromPersist());
  if (migrated.length) {
    saveCrew(migrated);
    return migrated;
  }
  return EMPLOYEES;
}

export function saveCrew(employees: Employee[]) {
  if (typeof window === "undefined") return;
  try {
    const slim = dropDummyEmployees(employees).map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      language: e.language,
      pin: four(e.pin) || e.pin,
      initials: e.initials,
      phone: e.phone,
      payrollNo: e.payrollNo,
      profileFileId: e.profileFileId,
    }));
    window.localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}

export function pinOfLive(emp: Employee): string {
  return four(emp.pin) || four(EMPLOYEES.find((e) => e.id === emp.id)?.pin);
}

export async function refreshCrewFromCloud(): Promise<Employee[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const { supabase } = await import("./supabase");
    const { empFromRow } = await import("./sb-rows");
    const { data, error } = await supabase().from("employees").select("*");
    if (error || !data?.length) return null;
    const local = loadCrew();
    const localById = new Map(local.map((e) => [e.id, e]));
    const rows = dropDummyEmployees(
      data.map((r) => {
        const remote = empFromRow(r as Record<string, unknown>);
        const mine = localById.get(remote.id);
        const remotePin = four(remote.pin);
        const localPin = four(mine?.pin);
        const pin = remotePin || localPin || four(EMPLOYEES.find((e) => e.id === remote.id)?.pin);
        return { ...remote, pin };
      }),
    );
    if (!rows.length) return null;
    saveCrew(rows);
    return rows;
  } catch {
    return null;
  }
}

export async function publishEmployee(emp: Employee) {
  if (isDummyEmployee(emp)) return;
  try {
    const { supabase } = await import("./supabase");
    const { empToRow } = await import("./sb-rows");
    await supabase().from("employees").upsert(empToRow(emp));
  } catch {
    /* offline — local PIN still works on this phone */
  }
}
