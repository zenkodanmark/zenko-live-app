import { rememberDeviceUser, pathForRole } from "./device-auth";
import { EMPLOYEES } from "./crew";
import { loadCrew, pinOfLive } from "./crew-live";
import type { Employee } from "./types";

export function pinOf(emp: Employee): string {
  const live = loadCrew().find((e) => e.id === emp.id) ?? emp;
  return pinOfLive(live);
}

export function employeeById(id: string | undefined): Employee | undefined {
  if (!id) return undefined;
  return loadCrew().find((e) => e.id === id) ?? EMPLOYEES.find((e) => e.id === id);
}

export function acceptPin(empId: string | undefined, pin: string | undefined): Employee | null {
  const emp = employeeById(empId);
  if (!emp) return null;
  const typed = String(pin ?? "").replace(/\D/g, "");
  if (typed.length !== 4 || typed !== pinOf(emp)) return null;
  rememberDeviceUser({ id: emp.id, role: emp.role });
  return emp;
}

export function destFor(emp: Employee) {
  return pathForRole(emp.role);
}
