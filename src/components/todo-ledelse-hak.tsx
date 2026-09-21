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

export function TodoKundeHak({ todo, lang }: { todo: Todo; lang: Lang }) {
  const live = useYard((s) => s.todos.find((x) => x.id === todo.id)) ?? todo;
  const setTodoKunde = useYard((s) => s.setTodoKunde);
  const me = useSessionEmployee();
  const [busy, setBusy] = useState(false);
  if (!me || !isMasterRole(me.role)) return null;
  const on = live.kundeStatus === "med_til_kunden";

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    await setTodoKunde(live.id);
    setBusy(false);
  }

  return (
    <HakBtn
      on={on}
      busy={busy}
      label={t(lang, "hakKunde")}
      onClick={toggle}
      title={t(lang, on ? "kundeHakOn" : "kundeHakOff")}
      data-testid={`todo-kunde-hak-${live.id}`}
      data-kunde={on ? "on" : "off"}
    />
  );
}

export function TodoHakPair({ todo, lang }: { todo: Todo; lang: Lang }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <TodoLedelseHak todo={todo} lang={lang} />
      <TodoKundeHak todo={todo} lang={lang} />
    </div>
  );
}
