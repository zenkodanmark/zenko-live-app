import { t } from "./i18n.ts";
import { EMPLOYEES, isMasterRole, projectById } from "./seed.ts";
import { todoAssignedTo, todoAssigneeIds } from "./todo-people.ts";
import type { Employee, Lang, Role, Todo, TodoLangCopy, TodoTranslations } from "./types.ts";

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

export function asTodoLangCopy(raw: unknown): TodoLangCopy {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { title: "", body: "" };
    const title = s.split("\n")[0]!.trim();
    const rest = s.slice(title.length).trim();
    return { title, body: rest };
  }
  if (raw && typeof raw === "object") {
    const o = raw as { title?: unknown; body?: unknown };
    return {
      title: typeof o.title === "string" ? o.title.trim() : "",
      body: typeof o.body === "string" ? o.body.trim() : "",
    };
  }
  return { title: "", body: "" };
}

export function todoViewLang(lang: Lang, role?: Role): Lang {
  if (role && isMasterRole(role)) return "da";
  return lang;
}

function languageOf(id: string, employees: Pick<Employee, "id" | "language">[]): Lang | undefined {
  const who = employees.find((e) => e.id === id) ?? EMPLOYEES.find((e) => e.id === id);
  return who?.language;
}

export function todoTargetLangs(
  todo: Pick<Todo, "assigneeId" | "assigneeIds" | "sourceLang">,
  employees: Pick<Employee, "id" | "language">[],
): Lang[] {
  const langs = new Set<Lang>();
  langs.add(todo.sourceLang ?? "da");
  langs.add("da");
  for (const id of todoAssigneeIds(todo)) {
    const lang = languageOf(id, employees);
    if (lang) langs.add(lang);
  }
  return [...langs];
}

export function seedTodoTranslations(opts: {
  title: string;
  body: string;
  from: Lang;
  langs: Lang[];
  keepTitle?: boolean;
}): TodoTranslations {
  const title = opts.title.trim();
  const body = opts.body.trim();
  const out: TodoTranslations = {};
  const langs = opts.langs.length ? opts.langs : (["da"] as Lang[]);
  for (const lang of langs) {
    out[lang] = { title, body };
  }
  if (!out.da) out.da = { title, body };
  if (!out[opts.from]) out[opts.from] = { title, body };
  return out;
}

export function crewTodoTitle(todo: Todo, lang: Lang, role?: Role) {
  const origTitle = (todo.title || "").trim();
  if (origTitle && isJobPlaceTitle(origTitle, todo.projectId)) return origTitle;
  const want = todoViewLang(lang, role);
  const copy = asTodoLangCopy(todo.translations?.[want]);
  if (copy.title) return copy.title;
  return origTitle || (todo.original ?? todo.body ?? "").trim().split("\n")[0] || "";
}

function isSameTitle(text: string, title: string) {
  return Boolean(text) && text.localeCompare(title, "da", { sensitivity: "accent" }) === 0;
}

/** Beskrivelse under titel. Aldrig titlen om igen. Tom translations skjuler ikke original body. */
export function crewTodoBody(todo: Todo, lang?: Lang, role?: Role) {
  const origTitle = (todo.title || "").trim();
  const origBody = (todo.body || "").trim() || (todo.original || "").trim();
  if (lang) {
    const want = todoViewLang(lang, role);
    const copy = asTodoLangCopy(todo.translations?.[want]);
    if (copy.body && !isSameTitle(copy.body, origTitle) && !isSameTitle(copy.body, copy.title || origTitle)) return copy.body;
  }
  if (origBody && !isSameTitle(origBody, origTitle)) return origBody;
  return "";
}

export function todoShowsOriginal(todo: Todo, lang: Lang, role?: Role) {
  const want = todoViewLang(lang, role);
  const source = todo.sourceLang ?? "da";
  if (want === source) return false;
  const copy = asTodoLangCopy(todo.translations?.[want]);
  if (!copy.title && !copy.body) return false;
  const origTitle = (todo.title || "").trim();
  const origBody = (todo.body || todo.original || "").trim();
  const titleSame = !copy.title || isSameTitle(copy.title, origTitle);
  const bodySame = !copy.body || isSameTitle(copy.body, origBody) || isSameTitle(copy.body, origTitle);
  if (titleSame && bodySame) return false;
  return true;
}

export function todoOriginalText(todo: Todo) {
  return (todo.original || todo.body || todo.title || "").trim();
}

export function openTodos(todos: Todo[]) {
  return todos.filter((x) => !x.done);
}

export function doneTodosNewest(todos: Todo[]) {
  return todos.filter((x) => x.done).sort((a, b) => (b.doneAt ?? b.createdAt ?? "").localeCompare(a.doneAt ?? a.createdAt ?? ""));
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
