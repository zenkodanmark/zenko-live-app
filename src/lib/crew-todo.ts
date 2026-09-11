import { t } from "./i18n.ts";
import { isMasterRole, projectById } from "./seed.ts";
import { todoAssignedTo } from "./todo-people.ts";
import type { Employee, Lang, Todo } from "./types.ts";

export function isPersonalTodo(projectId: string | undefined | null) {
  return !projectId;
}

export function canMarkTodoDone(todo: Pick<Todo, "assigneeId" | "assigneeIds">, me: Employee | null | undefined) {
  if (!me) return false;
  if (isMasterRole(me.role)) return true;
  return todoAssignedTo(todo, me.id);
}

export function todoJobLabel(projectId: string, lang: Lang) {
  if (isPersonalTodo(projectId)) return t(lang, "todoNoJob");
  return projectById(projectId).name;
}

export function crewHomeTodos(todos: Todo[], me: Employee, jobIds: Iterable<string>) {
  const jobs = new Set(jobIds);
  return todos.filter((x) => todoAssignedTo(x, me.id) && (isPersonalTodo(x.projectId) || jobs.has(x.projectId)));
}

/** Svend/lærling: kun tildelte på sagen. Mester: alle på sagen. */
export function crewSagTodos(todos: Todo[], projectId: string, me?: Employee | null) {
  if (isPersonalTodo(projectId)) return [];
  const onJob = todos.filter((x) => x.projectId === projectId);
  if (!me || isMasterRole(me.role)) return onJob;
  return onJob.filter((x) => todoAssignedTo(x, me.id));
}
