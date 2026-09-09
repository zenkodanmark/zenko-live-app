import { dayFromRow, dayToRow } from "./sb-rows";
import { supabase } from "./supabase";
import type { DayLog } from "./types";

export async function pullDays(): Promise<DayLog[] | null> {
  try {
    const { data, error } = await supabase().from("day_logs").select("*").limit(400);
    if (error) return null;
    return (data ?? []).map((r) => dayFromRow(r as Record<string, unknown>)).filter((d) => d.employeeId);
  } catch {
    return null;
  }
}

export async function publishDay(day: DayLog, id?: string): Promise<boolean> {
  try {
    const { error } = await supabase().from("day_logs").upsert(dayToRow(day, id));
    return !error;
  } catch {
    return false;
  }
}
