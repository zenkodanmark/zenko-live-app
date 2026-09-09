import type { DayLog, Employee } from "./types.ts";

function todayStamp() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

function todayKey(employeeId: string) {
  return `${employeeId}:${todayStamp()}`;
}

export function isOnSite(day: Pick<DayLog, "checkInAt" | "checkOutAt"> | null | undefined) {
  return Boolean(day?.checkInAt && !day.checkOutAt);
}

export function presentOnProject(employees: Employee[], days: Record<string, DayLog>, projectId: string) {
  if (!projectId) return [];
  return employees.filter((e) => {
    const d = days[todayKey(e.id)];
    return Boolean(d && isOnSite(d) && d.projectId === projectId);
  });
}

export function boardedCount(employees: Employee[], days: Record<string, DayLog>) {
  const met = employees.filter((e) => isOnSite(days[todayKey(e.id)])).length;
  return { met, total: employees.length };
}
