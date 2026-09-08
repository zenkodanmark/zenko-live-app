import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CloseX, PlusBtn, PlusRound, SagPng, plusForList, sagPngForList } from "@/components/sag-icons";
import { UdPick, UdSheet } from "@/components/sag-ud";
import { KsCompose } from "@/components/ks-compose";
import { EntDoc, KsDoc, TfDoc } from "@/components/print-docs";
import { KsListThumb, ReportThumb } from "@/components/photo-strip";
import { QuickCompose } from "@/components/quick-compose";
import { TodoSheet } from "@/components/todo-board";
import { MaterialBoard, NewOrderSheet } from "@/components/material-pane";
import { CrewTodos } from "@/components/crew-todos";
import { t } from "@/lib/i18n";
import { listUdCounts } from "@/lib/drive.functions";
import { findControlPoint } from "@/lib/seed";
import { softrKsPhotos, hydrateSoftrReport } from "@/lib/softr-ks";
import { hydrateSoftrEnt } from "@/lib/softr-er";
import { hydrateSoftrTf } from "@/lib/softr-tf";
import { softrAsFieldItems } from "@/lib/softr-as";
import { useYard } from "@/lib/store";
import { crewSagTodos } from "@/lib/crew-todo";
import type { Lang, Project } from "@/lib/types";

type CrewKind = "todo" | "material" | "ks" | "tf" | "ent" | "ud";
type CrewView = { kind: "todo" | "ks" | "tf" | "ent"; id: string };

export function CrewSagHome({ project, lang }: { project: Project; lang: Lang }) {
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const ksReports = useYard((s) => s.ksReports);
  const todos = useYard((s) => s.todos);
  const needs = useYard((s) => s.needs);
  const orders = useYard((s) => s.orders);
  const days = useYard((s) => s.days);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const fieldItems = useYard((s) => s.fieldItems);

  const [list, setList] = useState<CrewKind | null>(null);
  const [compose, setCompose] = useState<CrewKind | null>(null);
  const [view, setView] = useState<CrewView | null>(null);
  const [udPick, setUdPick] = useState(false);
  const [udCount, setUdCount] = useState<number | null>(null);

  const jobId = project.id;
  const sagTodos = crewSagTodos(todos, jobId);
  const sagTodosOpen = sagTodos.filter((s) => !s.done);
  const sagTfs = tfs.filter((s) => s.projectId === jobId && !s.trashedAt);
  const sagEnts = ents.filter((s) => s.projectId === jobId && !s.trashedAt);
  const sagKs = ksReports.filter((s) => s.projectId === jobId && !s.trashedAt);
  const sagNeeds = needs.filter((n) => n.projectId === jobId && n.status === "need");
  const sagOrders = orders.filter((o) => o.projectId === jobId);
  const asPhotos = useMemo(() => [...softrAsFieldItems(), ...fieldItems], [fieldItems]);
  const photos = useMemo(
    () => [...softrKsPhotos(), ...Object.values(days).flatMap((d) => d.photos), ...drivePhotos],
    [days, drivePhotos],
  );

  useEffect(() => {
    let live = true;
    void listUdCounts({ data: { projectId: jobId } })
      .then((res) => {
        if (live) setUdCount(res.total ?? 0);
      })
      .catch(() => {
        if (live) setUdCount(null);
      });
    return () => {
      live = false;
    };
  }, [jobId, udPick, list]);

  const tf = view?.kind === "tf" ? (() => {
    const row = tfs.find((s) => s.id === view.id);
    return row ? hydrateSoftrTf(row) : null;
  })() : null;
  const ent = view?.kind === "ent" ? (() => {
    const row = ents.find((s) => s.id === view.id);
    return row ? hydrateSoftrEnt(row) : null;
  })() : null;
  const ks = view?.kind === "ks" ? (() => {
    const row = ksReports.find((s) => s.id === view.id);
    return row ? hydrateSoftrReport(row) : null;
  })() : null;
  const todo = view?.kind === "todo" ? todos.find((s) => s.id === view.id) ?? null : null;

  function openList(kind: CrewKind, make?: boolean) {
    setList(kind);
    if (make && kind === "ud") {
      setUdPick(true);
      return;
    }
    if (make) setCompose(kind);
  }

  return (
    <div className="space-y-4">
      {!list ? (
        <>
          <TypeRow
            kind="todo"
            title={t(lang, "rowTodo")}
            count={sagTodosOpen.length}
            onOpen={() => openList("todo")}
            onCreate={() => openList("todo", true)}
            createLabel={t(lang, "todoCreate")}
          />
          <TypeRow
            kind="material"
            title={t(lang, "rowMaterial")}
            count={sagNeeds.length + sagOrders.length}
            onOpen={() => openList("material")}
            onCreate={() => openList("material", true)}
            createLabel={t(lang, "createNew")}
          />
          <TypeRow
            kind="ks"
            title={t(lang, "rowKs")}
            count={sagKs.length}
            onOpen={() => openList("ks")}
            onCreate={() => openList("ks", true)}
            createLabel={t(lang, "createNew")}
          />
          <TypeRow
            kind="tf"
            title={t(lang, "rowTf")}
            count={sagTfs.length}
            onOpen={() => openList("tf")}
            onCreate={() => openList("tf", true)}
            createLabel={t(lang, "createNew")}
          />
          <TypeRow
            kind="ent"
            title={t(lang, "rowEr")}
            count={sagEnts.length}
            onOpen={() => openList("ent")}
            onCreate={() => openList("ent", true)}
            createLabel={t(lang, "createNew")}
          />
          <TypeRow
            kind="ud"
            title={t(lang, "udRow")}
            count={udCount}
            onOpen={() => openList("ud")}
            onCreate={() => setUdPick(true)}
            createLabel={t(lang, "createNew")}
          />
        </>
      ) : (
        <ListSheet
          title={listTitle(list, lang)}
          lang={lang}
          onClose={() => setList(null)}
          onCreate={() => {
            if (list === "ud") setUdPick(true);
            else setCompose(list);
          }}
          createName={plusForList(list === "ent" ? "ent" : list)}
          createTestId={crewListPlusTestId(list)}
        >
          {list === "todo" ? (
            <div>
              <p className="mb-3 text-list leading-[1.4] text-ink">{t(lang, "sagTodoHint")}</p>
              <CrewTodos lang={lang} projectId={jobId} sag />
            </div>
          ) : null}
          {list === "material" ? (
            <div>
              <p className="mb-3 text-list leading-[1.4] text-ink">{t(lang, "crewMaHint")}</p>
              <MaterialBoard lang={lang} projectId={jobId} />
            </div>
          ) : null}
          {list === "ks" ? (
            sagKs.length ? (
              <ul className="space-y-1.5">
                {sagKs.map((row) => {
                  const live = hydrateSoftrReport(row);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-sand px-3 py-3 text-left"
                        onClick={() => setView({ kind: "ks", id: row.id })}
                      >
                        <KsListThumb photoIds={live.photoIds ?? []} photos={photos} />
                        <span className="min-w-0">
                          <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">Nr. {live.number}</span>
                          <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                            {live.point} {findControlPoint(live.point, live.projectId)?.title ?? ""}
                            {live.location ? ` · ${live.location}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{t(lang, "sagKsEmpty")}</p>
            )
          ) : null}
          {list === "tf" ? (
            sagTfs.length ? (
              <ul className="space-y-1.5">
                {sagTfs.map((row) => {
                  const live = hydrateSoftrTf(row);
                  const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-sand px-3 py-3 text-left"
                        onClick={() => setView({ kind: "tf", id: row.id })}
                      >
                        {thumb?.dataUrl ? (
                          <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <ReportThumb ids={live.photoIds ?? []} />
                        )}
                        <span className="min-w-0">
                          <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                          <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">{live.title || live.question}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{t(lang, "noTfYet")}</p>
            )
          ) : null}
          {list === "ent" ? (
            sagEnts.length ? (
              <ul className="space-y-1.5">
                {sagEnts.map((row) => {
                  const live = hydrateSoftrEnt(row);
                  const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-sand px-3 py-3 text-left"
                        onClick={() => setView({ kind: "ent", id: row.id })}
                      >
                        {thumb?.dataUrl ? (
                          <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <ReportThumb ids={live.photoIds ?? []} />
                        )}
                        <span className="min-w-0">
                          <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                          <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">{live.title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{t(lang, "sagEntEmpty")}</p>
            )
          ) : null}
          {list === "ud" ? <UdSheet projectId={jobId} lang={lang} onClose={() => setList(null)} onAdd={() => setUdPick(true)} /> : null}
        </ListSheet>
      )}

      {compose === "material" ? (
        <NewOrderSheet lang={lang} projectId={jobId} onClose={() => setCompose(null)} />
      ) : compose === "ks" ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <KsCompose
            projectId={jobId}
            lang={lang}
            onClose={() => setCompose(null)}
            onCreated={(id) => {
              setCompose(null);
              setView({ kind: "ks", id });
            }}
          />
        </div>
      ) : compose === "todo" || compose === "ent" || compose === "tf" ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <QuickCompose
            kind={compose === "ent" ? "er" : compose === "tf" ? "tf" : "todo"}
            projectId={jobId}
            lang={lang}
            allowNoJob={compose === "todo"}
            onClose={() => setCompose(null)}
            onCreated={(id) => {
              setCompose(null);
              if (compose === "todo") setView({ kind: "todo", id });
              else if (compose === "tf") setView({ kind: "tf", id });
              else setView({ kind: "ent", id });
            }}
          />
        </div>
      ) : null}

      {udPick ? <UdPick projectId={jobId} lang={lang} onClose={() => setUdPick(false)} /> : null}

      {todo ? <TodoSheet td={todo} lang={lang} onClose={() => setView(null)} /> : null}
      {ks ? (
        <CrewDoc lang={lang} onClose={() => setView(null)}>
          <KsDoc report={ks} photos={photos} />
        </CrewDoc>
      ) : null}
      {tf ? (
        <CrewDoc lang={lang} onClose={() => setView(null)}>
          <TfDoc tf={tf} />
        </CrewDoc>
      ) : null}
      {ent ? (
        <CrewDoc lang={lang} onClose={() => setView(null)}>
          <EntDoc ent={ent} />
        </CrewDoc>
      ) : null}
    </div>
  );
}

function TypeRow({
  kind,
  title,
  count,
  onOpen,
  onCreate,
  createLabel,
}: {
  kind: CrewKind;
  title: string;
  count: number | null;
  onOpen: () => void;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="flex min-h-[5.75rem] w-full items-center gap-2">
      <button
        type="button"
        data-testid={`crew-sag-row-${kind}`}
        onClick={onOpen}
        className="flex min-h-[5.75rem] min-w-0 flex-1 items-center justify-between gap-3 rounded-[24px] bg-paper px-3 py-1.5 text-left shadow-card"
      >
        <span className="flex min-w-0 items-center gap-3">
          <TypeIcon kind={kind} />
          <span className="font-display text-3xl text-navy">{title}</span>
        </span>
        <span className="font-display text-3xl tabular-nums text-brick">{count == null ? "–" : count}</span>
      </button>
      {onCreate ? (
        <PlusRound label={createLabel || title} testId={`crew-sag-plus-${kind}`} onClick={onCreate} px={52} />
      ) : null}
    </div>
  );
}

function TypeIcon({ kind }: { kind: CrewKind }) {
  return <SagPng name={sagPngForList(kind)} px={84} />;
}

function ListSheet({
  title,
  lang,
  onClose,
  onCreate,
  createName,
  createTestId,
  children,
}: {
  title: string;
  lang: Lang;
  onClose: () => void;
  onCreate?: () => void;
  createName?: ReturnType<typeof plusForList>;
  createTestId?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3" data-testid="crew-sag-list">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-title text-ink">{title}</h2>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      {onCreate && createName ? (
        <div className="mb-1">
          <PlusBtn name={createName} label={t(lang, "createNew")} testId={createTestId} onClick={onCreate} px={64} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

function crewListPlusTestId(kind: CrewKind) {
  if (kind === "ent") return "crew-list-plus-ent";
  if (kind === "material") return "crew-list-plus-material";
  if (kind === "ud") return "sag-plus-ud-sheet";
  return `crew-list-plus-${kind}`;
}

function CrewDoc({ lang, onClose, children }: { lang: Lang; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50">
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="bg-white py-6">{children}</div>
    </div>
  );
}

function listTitle(kind: CrewKind, lang: Lang) {
  if (kind === "tf") return t(lang, "sagTf");
  if (kind === "ent") return t(lang, "sagEnt");
  if (kind === "todo") return t(lang, "rowTodo");
  if (kind === "material") return t(lang, "rowMaterial");
  if (kind === "ud") return t(lang, "udRow");
  return t(lang, "sagKs");
}
