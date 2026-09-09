import type { MouseEvent } from "react";
import { isMasterRole } from "@/lib/crew";
import { t } from "@/lib/i18n";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { Lang, Todo } from "@/lib/types";

export function isTodoLedelseOn(todo: Pick<Todo, "ledelseStatus">) {
  return todo.ledelseStatus === "med_til_ledelse";
}

export function TodoLedelseHak({ todo, lang }: { todo: Todo; lang: Lang }) {
  const patchTodo = useYard((s) => s.patchTodo);
  const me = useSessionEmployee();
  if (!me || !isMasterRole(me.role) || todo.done) return null;
  const on = isTodoLedelseOn(todo);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    patchTodo(todo.id, { ledelseStatus: on ? "skjult" : "med_til_ledelse" });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`mt-1 min-h-9 rounded-full px-3 text-xs font-medium ${on ? "bg-moss text-sand" : "bg-brick/15 text-brick"}`}
      title={t(lang, on ? "ledelseHakOn" : "ledelseHakOff")}
      data-testid={`todo-ledelse-hak-${todo.id}`}
      data-ledelse={on ? "on" : "off"}
    >
      {t(lang, "ledelseHak")}
    </button>
  );
}
