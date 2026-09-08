import type { Employee, Todo } from "./types";

export function todoAssigneeIds(td: Pick<Todo, "assigneeId" | "assigneeIds">): string[] {
  if (td.assigneeIds?.length) return [...new Set(td.assigneeIds.filter(Boolean))];
  return td.assigneeId ? [td.assigneeId] : [];
}

export function todoAssignedTo(td: Pick<Todo, "assigneeId" | "assigneeIds">, employeeId: string) {
  return todoAssigneeIds(td).includes(employeeId);
}

export function todoPeopleLine(td: Pick<Todo, "assigneeId" | "assigneeIds">, employees: Employee[]) {
  return todoAssigneeIds(td)
    .map((id) => employees.find((e) => e.id === id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

export function todoDoneLine(td: Pick<Todo, "done" | "doneAt" | "doneById" | "assigneeId" | "assigneeIds">, employees: Employee[]) {
  if (!td.done) return "";
  const who = employees.find((e) => e.id === td.doneById)?.name ?? todoPeopleLine(td, employees);
  const when = td.doneAt ? td.doneAt.slice(0, 16).replace("T", " ") : "";
  return [who, when].filter(Boolean).join(" · ");
}
