import { useState } from "react";
import { FacePhoto } from "@/components/face-photo";
import { PlusBtn } from "@/components/sag-icons";
import { GhostButton, SectionLabel } from "@/components/zenko";
import { QuickCompose } from "@/components/quick-compose";
import { PencilBtn, TodoEditSheet, TodoSheet } from "@/components/todo-board";
import { shownTodoText } from "@/lib/chat";
import { crewHomeTodos, crewSagTodos, isPersonalTodo, todoJobLabel } from "@/lib/crew-todo";
import { t } from "@/lib/i18n";
import { copenhagenDate } from "@/lib/seed";
import { activeAssigned, useSessionEmployee, useYard } from "@/lib/store";
import { todoPeopleLine } from "@/lib/todo-people";
import type { Lang, Todo } from "@/lib/types";

export function CrewTodos({ lang, all, projectId, sag }: { lang: Lang; all?: boolean; projectId?: string; sag?: boolean }) {
  const me = useSessionEmployee();
  const todos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const [doneOpen, setDoneOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  if (!me) return null;
  const jobs = activeAssigned(me.id, me.role, projects, assignments);
  const pool = sag && projectId ? crewSagTodos(todos, projectId) : crewHomeTodos(todos, me, jobs.map((j) => j.id));
  const open = pool.filter((x) => !x.done);
  const done = pool.filter((x) => x.done);
  const today = copenhagenDate();
  const todayOpen = open.filter((x) => !x.due || x.due <= today || x.due.slice(0, 10) === today);
  const shown = all || sag ? open : todayOpen;
  const rows = doneOpen ? done : shown;
  const active = pool.find((x) => x.id === pick) ?? todos.find((x) => x.id === pick) ?? null;

  return (
    <div className="space-y-3" data-testid={sag ? "crew-sag-todos" : "crew-home-todos"}>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{doneOpen ? t(lang, "todoDoneBtn") : sag ? t(lang, "rowTodo") : t(lang, "todoOpen")}</SectionLabel>
        <div className="flex gap-1.5">
          {!sag ? (
            <PlusBtn name="todoPlus" label={t(lang, "todoCreate")} testId="crew-todo-create" onClick={() => setCreate(true)} px={64} />
          ) : null}
          <GhostButton className="min-h-10 text-xs" onClick={() => setDoneOpen((v) => !v)}>
            {doneOpen ? t(lang, "todoOpen") : `${t(lang, "todoDoneBtn")} (${done.length})`}
          </GhostButton>
        </div>
      </div>
      {rows.length === 0 ? <p className="text-list leading-[1.4] text-ink">{doneOpen ? t(lang, "todoDoneEmpty") : t(lang, "todoNone")}</p> : null}
      <ul className="space-y-2">
        {rows.map((td) => (
          <TodoHeading key={td.id} todo={td} lang={lang} sag={Boolean(sag)} who={todoPeopleLine(td, employees)} onOpen={() => setPick(td.id)} />
        ))}
      </ul>
      {active ? <TodoSheet td={active} lang={lang} onClose={() => setPick(null)} /> : null}
      {create ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <QuickCompose
            kind="todo"
            projectId={projectId ?? jobs[0]?.id ?? ""}
            lang={lang}
            allowNoJob
            onClose={() => setCreate(false)}
            onCreated={() => setCreate(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function TodoHeading({
  todo,
  lang,
  sag,
  who,
  onOpen,
}: {
  todo: Todo;
  lang: Lang;
  sag: boolean;
  who: string;
  onOpen: () => void;
}) {
  const me = useSessionEmployee();
  const employees = useYard((s) => s.employees);
  const [edit, setEdit] = useState(false);
  const heading = shownTodoText(todo, lang, me?.role);
  const status = todo.done ? t(lang, "todoStatusDone") : t(lang, "todoStatusOpen");
  const sagLine = isPersonalTodo(todo.projectId) ? t(lang, "todoNoJob") : todoJobLabel(todo.projectId, lang);
  return (
    <li>
      <div className="flex items-start gap-1 rounded-[18px] bg-paper px-2 py-2 shadow-card">
        {!todo.done ? <PencilBtn lang={lang} todoId={todo.id} onClick={() => setEdit(true)} /> : null}
        <button
          type="button"
          className="min-h-12 min-w-0 flex-1 px-2 py-1 text-left"
          onClick={onOpen}
          data-testid={`crew-todo-${todo.id}`}
        >
          <span className="flex items-start gap-3">
            <FacePhoto employee={employees.find((e) => e.id === todo.assigneeId)} px={32} />
            <span className="min-w-0 flex-1">
              <p className="font-display text-title font-semibold text-ink">{heading}</p>
              <p className="mt-0.5 text-list leading-[1.4] text-ink">
                {sag ? [who || "—", status].filter(Boolean).join(" · ") : [sagLine, status].filter(Boolean).join(" · ")}
              </p>
            </span>
          </span>
        </button>
      </div>
      {edit ? <TodoEditSheet td={todo} lang={lang} onClose={() => setEdit(false)} /> : null}
    </li>
  );
}
