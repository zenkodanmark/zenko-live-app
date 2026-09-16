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

export function isJobPlaceTitle(title: string, projectId: string) {
  const raw = title.trim();
  if (!raw || isPersonalTodo(projectId)) return false;
  const job = projectById(projectId);
  const name = (job.name || "").trim();
  const addr = (job.address || "").trim();
  const t0 = raw.toLowerCase();
  if (name && t0 === name.toLowerCase()) return true;
  if (addr && t0 === addr.toLowerCase()) return true;
  if (name && t0.includes(name.toLowerCase()) && raw.length <= name.length + 8) return true;
  return false;
}

export function crewTodoTitle(todo: Todo, lang: Lang) {
  const title = (todo.title || "").trim();
  if (title && isJobPlaceTitle(title, todo.projectId)) return title;
  const orig = (todo.original ?? todo.body ?? title).trim();
  const tr = todo.translations?.[lang]?.trim();
  if (tr && title && title === orig) return tr.split("\n")[0]!.trim() || title;
  if (tr && !title) return tr.split("\n")[0]!.trim();
  return title || orig.split("\n")[0] || "";
}

function nestedBody(raw: unknown): string {
  if (raw && typeof raw === "object" && "body" in raw) {
    const body = (raw as { body?: unknown }).body;
    if (typeof body === "string") return body.trim();
  }
  return "";
}

function isSameTitle(text: string, title: string) {
  return Boolean(text) && text.localeCompare(title, "da", { sensitivity: "accent" }) === 0;
}

/** Beskrivelse under titel. Aldrig titlen om igen. Tom = ingen kasse. */
export function crewTodoBody(todo: Todo, lang?: Lang) {
  const title = (todo.title || "").trim();
  if (lang) {
    const entry = todo.translations ? (todo.translations as Record<string, unknown>)[lang] : undefined;
    const trBody = nestedBody(entry);
    if (trBody && !isSameTitle(trBody, title)) return trBody;
  }
  const body = (todo.body || "").trim();
  if (body && !isSameTitle(body, title)) return body;
  const orig = (todo.original || "").trim();
  if (orig && !isSameTitle(orig, title)) return orig;
  return "";
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