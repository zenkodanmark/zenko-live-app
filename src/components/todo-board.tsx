import { useMemo, useState } from "react";
import { FacePhoto } from "@/components/face-photo";
import { CloseX } from "@/components/sag-icons";
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
import { todoAssignedTo, todoDoneLine, todoPeopleLine } from "@/lib/todo-people";
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
  const who = todoPeopleLine(td, employees) || employees.find((e) => e.id === td.assigneeId)?.name || "";
  const heading = shownTodoText(td, lang, me?.role);
  const ids = todoAllPhotoIds(td);
  return (
    <div className="rounded-xl bg-sand px-3 py-2">
      <button type="button" className="flex min-h-11 w-full items-center gap-2 text-left" onClick={() => (onOpen ? onOpen() : setOpen(true))}>
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
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const me = useSessionEmployee();
  const convertTodo = useYard((s) => s.convertTodo);
  const removeTodo = useYard((s) => s.removeTodo);
  const master = me ? isMasterRole(me.role) : false;
  const from = employees.find((e) => e.id === td.fromId)?.name ?? "—";
  const who = todoPeopleLine(td, employees) || employees.find((e) => e.id === td.assigneeId)?.name || "—";
  const jobName = todoJobLabel(td.projectId, lang);
  const [jobId, setJobId] = useState(td.projectId);
  const [print, setPrint] = useState(false);
  const showGps = master || print;
  if (!master) return <CrewTodoOpen td={td} lang={lang} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/50">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <PrimaryButton tone="sand" className="w-auto px-4" onClick={() => { setPrint(true); window.setTimeout(() => printDoc(), 80); }}>
          PDF
        </PrimaryButton>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-[210mm] bg-white px-5 py-6 text-black">
        <article className="doc-a4 mx-auto bg-white p-6">
          <header className="flex items-start justify-between gap-4 border-b-2 border-brick pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{FIRM}</p>
              <h1 className="font-display text-4xl text-navy">To-do</h1>
              <p className="mt-1 text-sm text-gray-600">{jobName}</p>
              <p className="text-xs text-gray-500">CVR {FIRM_CVR}</p>
            </div>
            <img src="/zenko-logo.svg" alt="ZENKO DANMARK" className="h-16 w-16 object-contain" />
          </header>
          <p className="mt-4 text-2xl font-medium">{shownTodoText(td, lang, me?.role)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-gray-500">{t(lang, "chooseProject")}</dt>
              <dd>{jobName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">{t(lang, "assignee")}</dt>
              <dd>{who}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">{t(lang, "createdBy")}</dt>
              <dd>
                {from} · {td.createdAt.slice(0, 16).replace("T", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">{t(lang, "due")}</dt>
              <dd>{td.due || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">{t(lang, "todoDoneMark")}</dt>
              <dd>
                {td.done ? `${todoDoneLine(td, employees) || who} · ${(td.doneAt ?? "").slice(0, 16).replace("T", " ")}` : t(lang, "meOpenDay")}
              </dd>
            </div>
          </dl>
          {showGps && (td.gpsLabel || (td.lat != null && td.lng != null)) ? (
            <p className="mt-3 text-sm">
              GPS: <GpsLink lat={td.lat} lng={td.lng} label={td.gpsLabel || t(lang, "gpsMaps")} />
            </p>
          ) : null}
          {showGps && (td.doneGpsLabel || (td.doneLat != null && td.doneLng != null)) ? (
            <p className="mt-1 text-sm">
              GPS {t(lang, "todoDoneMark")}: <GpsLink lat={td.doneLat} lng={td.doneLng} label={td.doneGpsLabel || t(lang, "gpsMaps")} />
            </p>
          ) : null}
          <UserText original={td.original ?? td.body} translations={td.translations} lang={lang} role={me?.role} className="mt-4 whitespace-pre-wrap leading-relaxed" />
          {td.reply ? (
            <p className="mt-3 text-sm text-gray-700">
              {t(lang, "todoReplyBtn")}: {td.reply}
            </p>
          ) : null}
          {td.history?.length ? (
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {td.history.map((h, i) => (
                <li key={i}>
                  {h.at.slice(0, 16).replace("T", " ")} · {h.text}
                </li>
              ))}
            </ul>
          ) : null}
          <TodoPhotos td={td} large />
        </article>
        {!print ? (
          <div className="no-print mx-auto max-w-[210mm] space-y-3 px-1 pb-8 pt-4">
            {master ? (
              <>
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
                        convertTodo(td.id, k, jobId);
                        onClose();
                      }}
                    >
                      {k === "slip" ? "AS" : k === "ent" ? "ER" : k.toUpperCase()}
                    </GhostButton>
                  ))}
                </div>
              </>
            ) : null}
            <TodoActions todo={td} lang={lang} />
            {master ? (
              <GhostButton
                className="bg-sand text-brick"
                onClick={() => {
                  removeTodo(td.id);
                  onClose();
                }}
              >
                {t(lang, "todoDelete")}
              </GhostButton>
            ) : null}
          </div>
        ) : null}
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
