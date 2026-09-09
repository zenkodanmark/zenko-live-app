import { EMPLOYEES } from "./crew";
import type { Employee } from "./types";

const KEY = "zenko-crew-v1";
const PERSIST_KEY = "zenko-plads-v32";

function four(pin: unknown) {
  const s = String(pin ?? "").replace(/\D/g, "");
  return s.length === 4 ? s : "";
}

function mergeCrew(rows: Employee[]): Employee[] {
  const byId = new Map<string, Employee>();
  for (const e of EMPLOYEES) byId.set(e.id, { ...e });
  for (const e of rows) {
    if (!e?.id) continue;
    const prev = byId.get(e.id);
    const pin = four(e.pin) || four(prev?.pin);
    byId.set(e.id, { ...(prev ?? e), ...e, pin: pin || e.pin || prev?.pin || "" });
  }
  return [...byId.values()];
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

export function loadCrew(): Employee[] {
  if (typeof window === "undefined") return EMPLOYEES;
  const cached = readJson(KEY);
  if (Array.isArray(cached) && cached.length) return mergeCrew(cached as Employee[]);
  const migrated = migrateFromPersist();
  if (migrated.length) {
    const merged = mergeCrew(migrated);
    saveCrew(merged);
    return merged;
  }
  return EMPLOYEES;
}

export function saveCrew(employees: Employee[]) {
  if (typeof window === "undefined") return;
  try {
    const slim = employees.map((e) => ({
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
    const rows = data.map((r) => empFromRow(r as Record<string, unknown>));
    const local = loadCrew();
    const localById = new Map(local.map((e) => [e.id, e]));
    const merged = mergeCrew([
      ...local,
      ...rows.map((remote) => {
        const mine = localById.get(remote.id);
        const remotePin = four(remote.pin);
        const localPin = four(mine?.pin);
        const seedPin = four(EMPLOYEES.find((e) => e.id === remote.id)?.pin);
        const pin = remotePin && remotePin !== seedPin ? remotePin : localPin || remotePin || seedPin;
        return { ...remote, pin };
      }),
    ]);
    saveCrew(merged);
    return merged;
  } catch {
    return null;
  }
}

export async function publishEmployee(emp: Employee) {
  try {
    const { supabase } = await import("./supabase");
    const { empToRow } = await import("./sb-rows");
    await supabase().from("employees").upsert(empToRow(emp));
  } catch {
    /* offline — local PIN still works on this phone */
  }
}
