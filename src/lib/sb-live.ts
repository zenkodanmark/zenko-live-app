import {
  entFromRow,
  entToRow,
  orderFromRow,
  orderToRow,
  projectFromRow,
  projectToRow,
  slipFromRow,
  slipToRow,
  offerFromRow,
  offerToRow,
  planFromRow,
  planToRow,
  tfFromRow,
  tfToRow,
} from "./sb-rows";
import { supabase } from "./supabase";
import type { Entrepreneur, MaterialOrder, Offer, PlanBlock, Project, Slip, Tf } from "./types";

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
  const full = projectToRow(p);
  if (await upsert("projects", full)) return true;
  const slim = { ...full };
  delete (slim as { ledelse_pin?: string | null }).ledelse_pin;
  return upsert("projects", slim);
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

export async function pullOffers() {
  return pullTable("offers", offerFromRow);
}
export async function publishOffer(row: Offer) {
  return upsert("offers", offerToRow(row));
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

export async function pullPlans() {
  return pullTable("plan_blocks", planFromRow);
}
export async function publishPlan(row: PlanBlock) {
  const full = planToRow(row);
  if (await upsert("plan_blocks", full)) return true;
  const slim = {
    id: full.id,
    employee_id: full.employee_id,
    employee_ids: full.employee_ids,
    project_id: full.project_id,
    title: full.title,
    start_at: full.start_at,
    end_at: full.end_at,
    created_at: full.created_at,
    created_by: full.created_by,
    source: full.source,
    place: full.place,
  };
  return upsert("plan_blocks", slim);
}
