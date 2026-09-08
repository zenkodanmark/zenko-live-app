import { rememberDeviceUser, pathForRole } from "./device-auth";
import { EMPLOYEES } from "./seed";
import { useYard } from "./store";
import type { Employee } from "./types";

export function pinOf(emp: Employee): string {
  const own = String(emp.pin ?? "").replace(/\D/g, "");
  if (own.length === 4) return own;
  const seed = EMPLOYEES.find((e) => e.id === emp.id);
  return String(seed?.pin ?? "").replace(/\D/g, "");
}

export function employeeById(id: string | undefined): Employee | undefined {
  if (!id) return undefined;
  return EMPLOYEES.find((e) => e.id === id);
}

export function acceptPin(empId: string | undefined, pin: string | undefined): Employee | null {
  const emp = employeeById(empId);
  if (!emp) return null;
  const typed = String(pin ?? "").replace(/\D/g, "");
  if (typed.length !== 4 || typed !== pinOf(emp)) return null;
  rememberDeviceUser({ id: emp.id, role: emp.role });
  try {
    useYard.getState().login(emp.id);
  } catch {
    /* */
  }
  return emp;
}

export function destFor(emp: Employee) {
  return pathForRole(emp.role);
}
