import { useMemo, useState, type ReactNode } from "react";
import { FacePhoto } from "@/components/face-photo";
import { ActionPng, CloseX } from "@/components/sag-icons";
import { TodoActions, CrewTodoOpen } from "@/components/complete-todo";
import { GpsLink, ReportThumb, TodoPhotos } from "@/components/photo-strip";
import { UserText } from "@/components/user-text";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { shownTodoText } from "@/lib/chat";
import { t } from "@/lib/i18n";
import { printDoc } from "@/lib/print";
import { todoAllPhotoIds } from "@/lib/photo-meta";
import { copenhagenDate, FIRM, FIRM_CVR, isMasterRole } from "@/lib/seed";
import { useSessionEmployee, useYard } from "@/lib/store";
import { todoJobLabel } from "@/lib/crew-todo";
import { fillTodoTranslations } from "@/lib/todo-drive";
import { todoAssigneeIds, todoAssignedTo, todoDoneLine, todoPeopleLine } from "@/lib/todo-people";
import type { Lang, Todo } from "@/lib/types";

export function OpenTodosCard({ lang }: { lang: Lang }) {
  const todos = useYard((s) => s.todos);
  const [openList, setOpenList] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const open = todos.filter((x) => !x.done);

  return (
    <>
      <Card className="rounded-[20px]">
        <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 text-left" onClick={() => setOpenList(true)}>
          <span>
            <SectionLabel>{t(lang, "todoOpenBoard")}</SectionLabel>
            <span className="text-list leading-[1.4] text-ink">{open.length ? t(lang, "todoOpenTap") : t(lang, "todoNone")}</span>
          </span>
          {open.length ? <Chip tone="brick">{open.length}</Chip> : <Chip tone="ok">0</Chip>}
        </button>
        <GhostButton className="mt-2 bg-sand" onClick={() => setDoneOpen(true)}>
          {t(lang, "todoDoneLink")}
        </GhostButton>
      </Card>
      {openList ? <OpenTodosSheet lang={lang} onClose={() => setOpenList(false)} /> : null}
      {doneOpen ? <DoneTodosSheet lang={lang} onClose={() => setDoneOpen(false)} /> : null}
    </>
  );
}

export function OpenTodosSheet({ lang, onClose, projectId, assigneeId }: { lang: Lang; onClose: () => void; projectId?: string; assigneeId?: string }) {
  const todos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const open = todos
    .filter((x) => !x.done)
    .filter((x) => (projectId ? x.projectId === projectId : true))
    .filter((x) => (assigneeId ? todoAssignedTo(x, assigneeId) : true))
    .filter((x) => {
      if (!q.trim()) return true;
      const who = todoPeopleLine(x, employees);
      return `${x.title} ${x.body} ${who} ${todoJobLabel(x.projectId, lang)}`.toLowerCase().includes(q.trim().toLowerCase());
    });
  const grouped = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const td of open) {
      const key = `${td.projectId}::${todoPeopleLine(td, employees) || td.assigneeId}`;
      const list = map.get(key) ?? [];
      list.push(td);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [open, employees]);
  const active = open.find((r) => r.id === pick) ?? null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-lg">{t(lang, "todoOpenBoard")}</p>
        <Chip tone="sand">{open.length}</Chip>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <input className="min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" placeholder={t(lang, "todoSearch")} value={q} onChange={(e) => setQ(e.target.value)} />
        {grouped.length === 0 ? <p className="text-list leading-[1.4] text-ink">{t(lang, "todoNone")}</p> : null}
        <ul className="space-y-3">
          {grouped.map(([key, rows]) => {
            const [jobId] = key.split("::");
            const job = todoJobLabel(jobId || "", lang);
            const who = key.slice(key.indexOf("::") + 2) || "—";
            return (
              <li key={key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {job} · {who}
                </p>
                <ul className="space-y-1">
                  {rows.map((td) => (
                    <TodoLine key={td.id} td={td} lang={lang} onOpen={() => setPick(td.id)} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
      {active ? <TodoSheet td={active} lang={lang} onClose={() => setPick(null)} /> : null}
    </div>
  );
}

function TodoLine({ td, lang, onOpen }: { td: Todo; lang: Lang; onOpen?: () => void }) {
  const employees = useYard((s) => s.employees);
  const addChat = useYard((s) => s.addChat);
  const me = useSessionEmployee();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const who = todoPeopleLine(td, employees) || employees.find((e) => e.id === td.assigneeId)?.name || "";
  const heading = shownTodoText(td, lang, me?.role);
  const ids = todoAllPhotoIds(td);
  function openView() {
    if (onOpen) onOpen();
    else setOpen(true);
  }
  return (
    <div className="rounded-xl bg-sand px-3 py-2">
      <div className="flex items-center gap-1">
        <PencilBtn lang={lang} todoId={td.id} onClick={() => setEdit(true)} />
        <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" onClick={openView}>
          <FacePhoto employee={employees.find((e) => e.id === td.assigneeId)} px={32} />
          {ids.length ? <ReportThumb ids={ids} /> : null}
          <span className="min-w-0 flex-1">
            <p className="font-display text-title font-semibold text-ink">{heading}</p>
            <p className="text-list leading-[1.4] text-ink">
              {todoJobLabel(td.projectId, lang)} · {who}
              {td.due ? ` · ${td.due}` : ""}
              {ids.length ? ` · ${ids.length} foto` : ""}
              {td.reply ? ` · ${t(lang, "todoReplyBtn")}` : ""}
            </p>
          </span>
        </button>
      </div>
      <GhostButton
        className="mt-1 min-h-9 px-2 text-xs"
        onClick={() => {
          if (!me) return;
          addChat({
            fromId: me.id,
            to: { kind: "employee", id: td.assigneeId },
            projectId: td.projectId,
            sourceLang: lang,
            original: t(lang, "todoRemindBody", { title: td.title }),
            translations: { [lang]: t(lang, "todoRemindBody", { title: td.title }), da: `Påmindelse: ${td.title}` },
            viaVoice: false,
          });
        }}
      >
        {t(lang, "todoRemind")}
      </GhostButton>
      {!onOpen && open ? <TodoSheet td={td} lang={lang} onClose={() => setOpen(false)} /> : null}
      {edit ? <TodoEditSheet td={td} lang={lang} onClose={() => setEdit(false)} /> : null}
    </div>
  );
}

export function PencilBtn({ lang, todoId, onClick }: { lang: Lang; todoId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`todo-edit-${todoId}`}
      aria-label={t(lang, "editShort")}
      onClick={onClick}
      className="flex size-12 shrink-0 items-center justify-center"
    >
      <ActionPng name="sagerPencil" px={36} />
    </button>
  );
}

export function OpenTodoRow({
  td,
  lang,
  onOpen,
  hint,
}: {
  td: Todo;
  lang: Lang;
  onOpen: () => void;
  hint?: ReactNode;
}) {
  const [edit, setEdit] = useState(false);
  const live = useYard((s) => s.todos.find((x) => x.id === td.id)) ?? td;
  const text = (live.body || live.original || "").trim();
  return (
    <div className="flex items-start gap-1 rounded-xl bg-sand px-1 py-1">
      <PencilBtn lang={lang} todoId={live.id} onClick={() => setEdit(true)} />
      <button type="button" className="min-w-0 flex-1 rounded-xl px-2 py-3 text-left" onClick={onOpen} data-testid={`todo-open-${live.id}`}>
        <span className="block font-display text-title font-semibold text-ink">{live.title}</span>
        {text && text !== live.title ? (
          <span className="mt-0.5 block text-list leading-[1.4] text-ink">{text}</span>
        ) : null}
        {live.fromChatId ? (
          <span className="mt-1 inline-block rounded-full bg-brick px-2 py-0.5 text-action font-bold uppercase tracking-wide text-sand">
            {t(lang, "boardFromChat")}
          </span>
        ) : null}
        <span className="mt-0.5 block text-list leading-[1.4] text-ink">
          {live.due} · {live.photoFileIds?.length || live.donePhotoFileIds?.length ? `${(live.photoFileIds?.length ?? 0) + (live.donePhotoFileIds?.length ?? 0)} foto` : t(lang, "meOpenDay")}
        </span>
        {hint}
      </button>
      {edit ? <TodoEditSheet td={live} lang={lang} onClose={() => setEdit(false)} /> : null}
    </div>
  );
}

export function DoneTodosSheet({ lang, onClose, projectId, assigneeId }: { lang: Lang; onClose: () => void; projectId?: string; assigneeId?: string }) {
  const todos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const me = useSessionEmployee();
  const [q, setQ] = useState("");
  const [person, setPerson] = useState(assigneeId ?? "");
  const [job, setJob] = useState(projectId ?? "");
  const [date, setDate] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const rows = todos
    .filter((x) => x.done)
    .filter((x) => (job ? x.projectId === job : true))
    .filter((x) => (person ? todoAssignedTo(x, person) : true))
    .filter((x) => (date ? (x.doneAt ?? x.createdAt).slice(0, 10) === date : true))
    .filter((x) => {
      if (!q.trim()) return true;
      const who = todoPeopleLine(x, employees);
      const doneBy = todoDoneLine(x, employees);
      return `${x.title} ${x.body} ${who} ${doneBy} ${todoJobLabel(x.projectId, lang)}`.toLowerCase().includes(q.trim().toLowerCase());
    })
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const active = rows.find((r) => r.id === pick) ?? null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-lg">{t(lang, "todoDoneTitle")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <input className="min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" placeholder={t(lang, "todoSearch")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={!person ? "navy" : "sand"}>
            <button type="button" onClick={() => setPerson("")}>
              {t(lang, "todoFilterPerson")}: {t(lang, "filterAll")}
            </button>
          </Chip>
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setPerson(e.id === person ? "" : e.id)}
              className={`min-h-10 rounded-full px-3 text-xs font-medium ${person === e.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
            >
              {e.name.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setJob("")}
            className={`min-h-10 rounded-full px-3 text-xs font-medium ${!job ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
          >
            {t(lang, "todoFilterSag")}: {t(lang, "filterAll")}
          </button>
          {projects
            .filter((p) => p.status === "active" || todos.some((td) => td.done && td.projectId === p.id))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setJob(p.id === job ? "" : p.id)}
                className={`min-h-10 rounded-full px-3 text-xs font-medium ${job === p.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
              >
                {p.name}
              </button>
            ))}
        </div>
        <label className="block text-xs text-muted">
          {t(lang, "todoFilterDate")}
          <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-paper px-3 text-sm shadow-card" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {rows.length === 0 ? <p className="text-list leading-[1.4] text-ink">{t(lang, "todoDoneEmpty")}</p> : null}
        <ul className="space-y-1.5">
          {rows.map((td) => (
            <li key={td.id}>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl bg-paper px-3 py-2 text-left shadow-card" onClick={() => setPick(td.id)}>
                {todoAllPhotoIds(td).length ? <ReportThumb ids={todoAllPhotoIds(td)} /> : null}
                <span className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{shownTodoText(td, lang, me?.role)}</p>
                  <p className="text-xs text-muted">
                    {todoJobLabel(td.projectId, lang)} · {todoPeopleLine(td, employees) || "—"}
                    {td.doneById ? ` · ${todoDoneLine(td, employees)}` : ""}
                    {td.photoFileIds?.length || td.donePhotoFileIds?.length ? ` · ${(td.photoFileIds?.length ?? 0) + (td.donePhotoFileIds?.length ?? 0)} foto` : ""}
                  </p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {active ? <TodoSheet td={active} lang={lang} onClose={() => setPick(null)} /> : null}
    </div>
  );
}

export function TodoSheet({ td, lang, onClose }: { td: Todo; lang: Lang; onClose: () => void }) {
  const live = useYard((s) => s.todos.find((x) => x.id === td.id)) ?? td;
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const me = useSessionEmployee();
  const convertTodo = useYard((s) => s.convertTodo);
  const removeTodo = useYard((s) => s.removeTodo);
  const master = me ? isMasterRole(me.role) : false;
  const [jobId, setJobId] = useState(live.projectId);
  const [edit, setEdit] = useState(false);
  if (!master) return <CrewTodoOpen td={live} lang={lang} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/50">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <PrimaryButton tone="sand" className="w-auto px-4" data-testid="todo-pdf" onClick={() => printDoc()}>
          PDF
        </PrimaryButton>
        <GhostButton className="text-sand" onClick={() => setEdit(true)}>
          {t(lang, "editShort")}
        </GhostButton>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="bg-white py-6">
        <TodoDoc td={live} lang={lang} />
      </div>
      <div className="no-print mx-auto max-w-[210mm] space-y-3 px-5 pb-8 pt-4">
        <label className="block text-xs text-muted">
          {t(lang, "chooseProject")}
          <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {projects.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "todoMakeReport")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(["slip", "ks", "ent", "tf"] as const).map((k) => (
            <GhostButton
              key={k}
              className="bg-sand"
              onClick={() => {
                convertTodo(live.id, k, jobId);
                onClose();
              }}
            >
              {k === "slip" ? "AS" : k === "ent" ? "ER" : k.toUpperCase()}
            </GhostButton>
          ))}
        </div>
        <TodoActions todo={live} lang={lang} />
        <GhostButton
          className="bg-sand text-brick"
          onClick={() => {
            removeTodo(live.id);
            onClose();
          }}
        >
          {t(lang, "todoDelete")}
        </GhostButton>
      </div>
      {edit ? <TodoEditSheet td={live} lang={lang} onClose={() => setEdit(false)} /> : null}
    </div>
  );
}

export function TodoDoc({ td, lang }: { td: Todo; lang: Lang }) {
  const employees = useYard((s) => s.employees);
  const me = useSessionEmployee();
  const from = employees.find((e) => e.id === td.fromId)?.name ?? "—";
  const who = todoPeopleLine(td, employees) || employees.find((e) => e.id === td.assigneeId)?.name || "—";
  const jobName = todoJobLabel(td.projectId, lang);
  const status = td.done ? t(lang, "todoStatusDone") : t(lang, "todoStatusOpen");
  const gps =
    td.gpsLabel || (td.lat != null && td.lng != null)
      ? { lat: td.lat, lng: td.lng, label: td.gpsLabel }
      : td.doneGpsLabel || (td.doneLat != null && td.doneLng != null)
        ? { lat: td.doneLat, lng: td.doneLng, label: td.doneGpsLabel }
        : null;
  return (
    <article className="doc-a4 mx-auto bg-white p-6 text-black" data-testid="todo-doc">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-bold">To-do</h1>
          <p className="mt-1 text-lg text-gray-700">{shownTodoText(td, lang, me?.role)}</p>
        </div>
        <div className="text-right text-sm">
          <img src="/zenko-logo.svg" alt="ZENKO DANMARK" className="mb-2 ml-auto h-16 w-16 object-contain" />
          <div className="font-bold">{FIRM}</div>
          <div className="text-gray-700">CVR {FIRM_CVR}</div>
        </div>
      </header>
      <div className="mt-4 h-0.5 bg-black" />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-gray-500">{t(lang, "chooseProject")}</dt>
          <dd className="font-medium">{jobName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">{t(lang, "assignee")}</dt>
          <dd className="font-medium">{who}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">{t(lang, "due")}</dt>
          <dd className="font-medium">{td.due || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">{t(lang, "todoDoneMark")}</dt>
          <dd className="font-medium">{status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-500">{t(lang, "createdBy")}</dt>
          <dd>
            {from} · {td.createdAt.slice(0, 16).replace("T", " ")}
          </dd>
        </div>
        {td.done ? (
          <div>
            <dt className="text-xs uppercase text-gray-500">{t(lang, "todoStatusDone")}</dt>
            <dd>
              {todoDoneLine(td, employees) || who} · {(td.doneAt ?? "").slice(0, 16).replace("T", " ")}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6">
        <h2 className="mb-3 text-xl font-bold">{t(lang, "composeBody")}:</h2>
        <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4">
          <UserText original={td.original ?? td.body} translations={td.translations} lang={lang} role={me?.role} className="whitespace-pre-wrap leading-relaxed" />
        </div>
      </div>
      {gps ? (
        <p className="mt-4 text-sm">
          GPS: <GpsLink lat={gps.lat} lng={gps.lng} label={gps.label || t(lang, "gpsMaps")} />
        </p>
      ) : null}
      {td.reply ? (
        <p className="mt-3 text-sm text-gray-700">
          {t(lang, "todoReplyBtn")}: {td.reply}
        </p>
      ) : null}
      <TodoPhotos td={td} large />
    </article>
  );
}

export function TodoEditSheet({ td, lang, onClose }: { td: Todo; lang: Lang; onClose: () => void }) {
  const live = useYard((s) => s.todos.find((x) => x.id === td.id)) ?? td;
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const patchTodo = useYard((s) => s.patchTodo);
  const [title, setTitle] = useState(live.title || (live.original ?? live.body ?? "").slice(0, 80));
  const [body, setBody] = useState(live.body || live.original || "");
  const [assigneeIds, setAssigneeIds] = useState(() => todoAssigneeIds(live));
  const [due, setDue] = useState(live.due ?? "");
  const [sagId, setSagId] = useState(live.projectId);
  const [done, setDone] = useState(live.done);
  const [busy, setBusy] = useState(false);

  const preview: Todo = {
    ...live,
    title: title.trim() || live.title,
    body: body.trim() || title.trim() || live.body,
    due: due || undefined,
    projectId: sagId,
    assigneeId: assigneeIds[0] || live.assigneeId,
    assigneeIds,
    done,
  };

  function save() {
    if (busy) return;
    setBusy(true);
    const ids = assigneeIds.length ? assigneeIds : [live.assigneeId];
    const heading = title.trim() || body.trim().slice(0, 80) || live.title;
    const text = body.trim() || heading;
    const whoId = useYard.getState().employeeId ?? live.assigneeId;
    const at = new Date().toISOString();
    const statusPatch = done
      ? live.done
        ? {}
        : { done: true as const, doneAt: at, doneById: whoId }
      : { done: false as const, doneAt: undefined, doneById: undefined };
    patchTodo(live.id, {
      title: heading,
      body: text,
      original: text,
      translations: { ...(live.translations ?? {}), [lang]: text, da: text },
      due: due || undefined,
      projectId: sagId,
      assigneeId: ids[0]!,
      assigneeIds: ids,
      ...statusPatch,
    });
    if (text !== (live.body || live.original || "")) void fillTodoTranslations(live.id, text, lang);
    useYard.setState({ toast: "Gemt." });
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand" data-testid="todo-edit-sheet">
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <PrimaryButton
          tone="sand"
          className="w-auto shrink-0 px-4"
          data-testid="todo-pdf"
          onClick={() => printDoc()}
        >
          PDF
        </PrimaryButton>
        <p className="min-w-0 flex-1 truncate font-display text-lg">{t(lang, "editShort")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="no-print mx-auto max-w-lg space-y-3 px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <label className="block text-xs text-muted">
            {t(lang, "composeTitle")}
            <input
              className="mt-1 min-h-11 w-full rounded-lg bg-paper px-3 text-sm shadow-card"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="todo-edit-title"
            />
          </label>
          <label className="block text-xs text-muted">
            {t(lang, "composeBody")}
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg bg-paper px-3 py-2 text-sm shadow-card"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="todo-edit-body"
            />
          </label>
          <div>
            <p className="text-xs text-muted">{t(lang, "todoAssignees")}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {employees.map((e) => {
                const on = assigneeIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    data-testid={`todo-edit-who-${e.id}`}
                    onClick={() =>
                      setAssigneeIds((cur) => (cur.includes(e.id) ? cur.filter((id) => id !== e.id) : [...cur, e.id]))
                    }
                    className={`min-h-10 rounded-full px-3 text-xs font-medium ${on ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-xs text-muted">
            {t(lang, "due")}
            <input
              type="date"
              className="mt-1 min-h-11 w-full rounded-lg bg-paper px-3 text-sm shadow-card"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              data-testid="todo-edit-due"
            />
          </label>
          <label className="block text-xs text-muted">
            {t(lang, "chooseProject")}
            <select
              className="mt-1 min-h-11 w-full rounded-lg bg-paper px-3 text-sm shadow-card"
              value={sagId}
              onChange={(e) => setSagId(e.target.value)}
              data-testid="todo-edit-job"
            >
              <option value="">{t(lang, "todoNoJob")}</option>
              {projects
                .filter((p) => p.status === "active" || p.id === sagId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <div>
            <p className="text-xs text-muted">{t(lang, "todoDoneMark")}</p>
            <div className="mt-1 flex gap-1.5">
              <button
                type="button"
                data-testid="todo-edit-status-open"
                onClick={() => setDone(false)}
                className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${!done ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
              >
                {t(lang, "todoStatusOpen")}
              </button>
              <button
                type="button"
                data-testid="todo-edit-status-done"
                onClick={() => setDone(true)}
                className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${done ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
              >
                {t(lang, "todoStatusDone")}
              </button>
            </div>
          </div>
          <PrimaryButton disabled={busy} onClick={save} data-testid="todo-edit-save">
            {busy ? t(lang, "saving") : t(lang, "save")}
          </PrimaryButton>
        </div>
      <div className="print-only">
        <TodoDoc td={preview} lang={lang} />
      </div>
    </div>
  );
}

export function PersonTodos({ lang, assigneeId }: { lang: Lang; assigneeId: string }) {
  const todos = useYard((s) => s.todos);
  const [done, setDone] = useState(false);
  const open = todos.filter((x) => todoAssignedTo(x, assigneeId) && !x.done);
  if (done) return <DoneTodosSheet lang={lang} assigneeId={assigneeId} onClose={() => setDone(false)} />;
  return (
    <Card className="rounded-[20px]">
      <SectionLabel>{t(lang, "todoOpenBoard")}</SectionLabel>
      {open.length === 0 ? <p className="text-list leading-[1.4] text-ink">{t(lang, "todoNone")}</p> : null}
      <ul className="mt-2 space-y-1">
        {open.map((td) => (
          <li key={td.id}>
            <TodoLine td={td} lang={lang} />
          </li>
        ))}
      </ul>
      <GhostButton className="mt-2 bg-sand" onClick={() => setDone(true)}>
        {t(lang, "todoDoneLink")}
      </GhostButton>
    </Card>
  );
}

void copenhagenDate;
