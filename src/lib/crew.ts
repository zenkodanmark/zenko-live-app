import type { Employee, Role } from "./types";

export const EMPLOYEES: Employee[] = [
  { id: "emp-ole", name: "Ole", role: "mester", language: "da", pin: "7777", initials: "OL" },
  { id: "emp-federico", name: "Federico", role: "mester", language: "es", pin: "2222", initials: "FO" },
  { id: "emp-alex", name: "Alex", role: "laerling", language: "da", pin: "1111", initials: "AL" },
  { id: "emp-ion", name: "Ion Zafier", role: "svend", language: "ro", pin: "3333", initials: "IZ" },
  { id: "emp-marius", name: "Marius Pater", role: "svend", language: "pl", pin: "4444", initials: "MP" },
  { id: "emp-osvaldo", name: "Osvaldo", role: "svend", language: "es", pin: "5555", initials: "OS", payrollNo: "0003" },
];

export function isCrewRole(role: Role) {
  return role === "svend" || role === "laerling";
}

export function isMasterRole(role: Role) {
  return role === "mester";
}

export const MASTER_IDS = ["emp-ole", "emp-federico"] as const;
