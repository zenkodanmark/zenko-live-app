import { type MouseEvent, useState } from "react";
import { HakBtn } from "@/components/hak-btn";
import { isMasterRole } from "@/lib/crew";
import { t } from "@/lib/i18n";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { Lang, Todo } from "@/lib/types";

export function isTodoLedelseOn(todo: Pick<Todo, "ledelseStatus">) {
  return todo.ledelseStatus === "med_til_ledelse";
}

export function TodoLedelseHak({ todo, lang }: { todo: Todo; lang: Lang }) {
  const live = useYard((s) => s.todos.find((x) => x.id === todo.id)) ?? todo;
  const setTodoLedelse = useYard((s) => s.setTodoLedelse);
  const me = useSessionEmployee();
  const [busy, setBusy] = useState(false);
  if (!me || !isMasterRole(me.role) || live.done) return null;
  const on = isTodoLedelseOn(live);

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    await setTodoLedelse(live.id);
    setBusy(false);
  }

  return (
    <HakBtn
      on={on}
      busy={busy}
      label={t(lang, "hakByggeleder")}
      onClick={toggle}
      title={t(lang, on ? "ledelseHakOn" : "ledelseHakOff")}
      data-testid={`todo-ledelse-hak-${live.id}`}
      data-ledelse={on ? "on" : "off"}
    />
  );
}
