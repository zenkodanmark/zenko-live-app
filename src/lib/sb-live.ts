import {
  entFromRow,
  entToRow,
  orderFromRow,
  orderToRow,
  projectFromRow,
  projectToRow,
  slipFromRow,
  slipToRow,
  tfFromRow,
  tfToRow,
} from "./sb-rows";
import { supabase } from "./supabase";
import type { Entrepreneur, MaterialOrder, Project, Slip, Tf } from "./types";

async function pullTable<T>(table: string, fromRow: (r: Record<string, unknown>) => T): Promise<T[] | null> {
  try {
    const { data, error } = await supabase().from(table).select("*").limit(250);
    if (error) return null;
    return (data ?? []).map((r) => fromRow(r as Record<string, unknown>)).filter((row) => Boolean((row as { id?: string }).id));
  } catch {
    return null;
  }
}

async function upsert(table: string, row: object) {
  try {
    const { error } = await supabase().from(table).upsert(row);
    return !error;
  } catch {
    return false;
  }
}

export async function pullProjects() {
  return pullTable("projects", projectFromRow);
}
export async function publishProject(p: Project) {
  return upsert("projects", projectToRow(p));
}

export async function pullTfs() {
  return pullTable("tfs", tfFromRow);
}
export async function publishTf(row: Tf) {
  return upsert("tfs", tfToRow(row));
}

export async function pullSlips() {
  return pullTable("slips", slipFromRow);
}
export async function publishSlip(row: Slip) {
  return upsert("slips", slipToRow(row));
}

export async function pullEnts() {
  return pullTable("ents", entFromRow);
}
export async function publishEnt(row: Entrepreneur) {
  return upsert("ents", entToRow(row));
}

export async function pullOrders() {
  return pullTable("orders", orderFromRow);
}
export async function publishOrder(row: MaterialOrder) {
  return upsert("orders", orderToRow(row));
}
