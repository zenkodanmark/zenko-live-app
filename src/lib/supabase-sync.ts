import { pushYardState, saveYardRow, uploadPladsFile } from "./supabase.functions";
import { supabase } from "./supabase";
import {
  assignmentFromRow,
  empFromRow,
  projectFromRow,
} from "./sb-rows";
import type { Assignment, Employee, Project } from "./types";

export async function pullYardState(): Promise<Record<string, unknown> | null> {
  try {
    const sb = supabase();
    const [employees, projects, assignments] = await Promise.all([
      sb.from("employees").select("*"),
      sb.from("projects").select("*"),
      sb.from("assignments").select("*"),
    ]);
    if (employees.error || projects.error) return null;
    return {
      employees: (employees.data ?? []).map((r) => empFromRow(r)),
      projects: (projects.data ?? []).map((r) => projectFromRow(r)),
      assignments: (assignments.data ?? []).map((r) => assignmentFromRow(r)),
    } as { employees: Employee[]; projects: Project[]; assignments: Assignment[] };
  } catch {
    return null;
  }
}

export async function publishYardState(json: string) {
  try {
    return await pushYardState({ data: { json } });
  } catch {
    return { ok: false as const, error: "kunne ikke gemme" };
  }
}

export async function publishYardRow(table: string, id: string, payload: unknown) {
  try {
    return await saveYardRow({ data: { table, id, payload } });
  } catch {
    return { ok: false as const, error: "kunne ikke gemme" };
  }
}

export async function publishPladsFile(path: string, contentBase64: string, mimeType?: string) {
  return uploadPladsFile({ data: { path, contentBase64, mimeType } });
}
