import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActionPng, CloseX, PlusBtn, PlusRound, SagPng, TabPng, plusForList, sagPngForList } from "@/components/sag-icons";
import { UdPick, UdSheet } from "@/components/sag-ud";
import { CreateJobForm } from "@/components/create-job";
import { FieldAttach } from "@/components/inbox-pane";
import { KsCompose } from "@/components/ks-compose";
import { EntDoc, KsDoc, OfferDoc, PrintChrome, SlipDoc, SlipInternalFlags, TfDoc } from "@/components/print-docs";
import { SagHeader, ReopenPicker, DueChips } from "@/components/sag-header";
import { SagFields } from "@/components/sag-fields";
import { KsListThumb, ReportThumb, TodoPhotos } from "@/components/photo-strip";
import { Chip, GhostButton } from "@/components/zenko";
import { AsShareChip, ErShareChip, KsShareChip } from "@/components/report-share-bar";
import { TfShareChip } from "@/components/tf-share-bar";
import { KundeHak } from "@/components/kunde-hak";
import { LedelseHak } from "@/components/ledelse-hak";
import { KundeJobBar } from "@/components/kunde-job-bar";
import { QuickCompose, type ComposeKind } from "@/components/quick-compose";
import { DoneTodosSheet, OpenTodoRow, TodoSheet } from "@/components/todo-board";
import { MaterialBoard, NewOrderSheet } from "@/components/material-pane";
import { t } from "@/lib/i18n";
import { listPladsPrefix } from "@/lib/plads-file";
import { UD_FOLDERS } from "@/lib/ud-folders";
import { fiveYearDate, fmtDaDate, handoverDate, oneYearDate } from "@/lib/job-archive";
import { findControlPoint, projectById } from "@/lib/seed";
import { softrKsPhotos, hydrateSoftrReport } from "@/lib/softr-ks";
import { mesterKsForJob } from "@/lib/mester-ks";
import { hydrateSoftrSlip, softrAsFieldItems } from "@/lib/softr-as";
import { hydrateSoftrEnt } from "@/lib/softr-er";
import { hydrateSoftrTf } from "@/lib/softr-tf";
import { useYard } from "@/lib/store";
import type { Lang, Project, ReopenReason } from "@/lib/types";

type View = { kind: "slip" | "offer" | "tf" | "ent" | "ks" | "todo"; id: string };
export type ListKind = "slip" | "offer" | "tf" | "ent" | "ks" | "todo" | "material" | "ud";
type MakeKind = ComposeKind | "material";

export function SagerPane({
  lang,
  masterId,
  embedKind,
  onEmbedClose,
}: {
  lang: Lang;
  masterId: string;
  embedKind?: ListKind;
  onEmbedClose?: () => void;
}) {
  const projects = useYard((s) => s.projects);
  const archiveProject = useYard((s) => s.archiveProject);
  const slips = useYard((s) => s.slips);
  const offers = useYard((s) => s.offers) ?? [];
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const ksReports = useYard((s) => s.ksReports);
  const todos = useYard((s) => s.todos);
  const needs = useYard((s) => s.needs) ?? [];
  const orders = useYard((s) => s.orders) ?? [];
  const days = useYard((s) => s.days);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const fieldItems = useYard((s) => s.fieldItems);
  const trashReport = useYard((s) => s.trashReport);
  const restoreReport = useYard((s) => s.restoreReport);
  const toggleFwd = useYard((s) => s.toggleSlipForwarded);
  const togglePaid = useYard((s) => s.toggleSlipPaid);
  const toggleOfferFwd = useYard((s) => s.toggleOfferForwarded);
  const toggleOfferPaid = useYard((s) => s.toggleOfferPaid);
  const answerTf = useYard((s) => s.answerTf);

  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");
  const [pick, setPick] = useState(active[0]?.id ?? projects[0]?.id ?? "job-hillerodsholm");
  const [mode, setMode] = useState<"job" | "all" | "archived">("job");
  const [creating, setCreating] = useState(false);
  const [compose, setCompose] = useState(false);
  const [composeKind, setComposeKind] = useState<MakeKind>("ks");
  const [view, setView] = useState<View | null>(null);
  const [list, setList] = useState<ListKind | null>(embedKind ?? null);
  const [ksFilter, setKsFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [udPick, setUdPick] = useState(false);
  const [udCount, setUdCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const id = window.sessionStorage.getItem("zenko-open-job");
      if (id && projects.some((p) => p.id === id)) {
        setMode("job");
        setPick(id);
        window.sessionStorage.removeItem("zenko-open-job");
      }
    } catch {
      /* */
    }
  }, [projects]);

  const allJobs = Boolean(embedKind);
  const project = projects.find((p) => p.id === pick) ?? (mode === "archived" ? archived[0] : active[0]) ?? projects[0];
  const jobId = project?.id ?? "";
  const sagSlips = slips.filter((s) => (allJobs || s.projectId === jobId) && !s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const sagOffers = offers.filter((s) => (allJobs || s.projectId === jobId) && !s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const sagTfs = tfs.filter((s) => (allJobs || s.projectId === jobId) && !s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const sagEnts = ents.filter((s) => (allJobs || s.projectId === jobId) && !s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const sagKs = mesterKsForJob(ksReports, jobId, { allJobs });
  const sagTodos = todos.filter((s) => allJobs || s.projectId === jobId);
  const sagTodosOpen = allJobs ? sagTodos.filter((s) => !s.done).slice().sort(byCreatedDesc) : sagTodos.filter((s) => !s.done);
  const sagNeeds = needs.filter((n) => (allJobs || n.projectId === jobId) && n.status === "need");
  const sagOrders = orders.filter((o) => allJobs || o.projectId === jobId);
  const trashSlips = slips.filter((s) => (allJobs || s.projectId === jobId) && s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const trashOffers = offers.filter((s) => (allJobs || s.projectId === jobId) && s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const trashTfs = tfs.filter((s) => (allJobs || s.projectId === jobId) && s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const trashEnts = ents.filter((s) => (allJobs || s.projectId === jobId) && s.trashedAt).slice().sort(allJobs ? byCreatedDesc : byAsNoDesc);
  const trashKs = mesterKsForJob(ksReports, jobId, { allJobs, trashed: true });
  const asPhotos = useMemo(() => [...softrAsFieldItems(), ...fieldItems], [fieldItems]);
  const photos = useMemo(
    () => [...softrKsPhotos(), ...Object.values(days).flatMap((d) => d.photos), ...drivePhotos],
    [days, drivePhotos],
  );

  useEffect(() => {
    if (!jobId || embedKind) return;
    let live = true;
    void Promise.all(UD_FOLDERS.map((f) => listPladsPrefix(`${jobId}/${f.key}`)))
      .then((rows) => {
        if (live) setUdCount(rows.reduce((n, list) => n + list.length, 0));
      })
      .catch(() => {
        if (live) setUdCount(null);
      });
    return () => {
      live = false;
    };
  }, [jobId, embedKind, udPick, list]);

  const slip = view?.kind === "slip" ? (() => {
    const row = slips.find((s) => s.id === view.id);
    return row ? hydrateSoftrSlip(row) : null;
  })() : null;
  const offer = view?.kind === "offer" ? offers.find((s) => s.id === view.id) ?? null : null;
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

  function selectJob(id: string) {
    setMode("job");
    setPick(id);
    setCreating(false);
    setList(null);
    setKsFilter("all");
    setShowTrash(false);
  }

  function openList(kind: ListKind, make?: boolean) {
    setShowTrash(false);
    setList(kind);
    if (make && kind === "ud") {
      setUdPick(true);
      return;
    }
    if (make) {
      setComposeKind(makeKindOf(kind));
      setCompose(true);
    }
  }

  const ksPoints = [...new Set(sagKs.map((r) => r.point))];
  const shownKs = (ksFilter === "all" ? sagKs : sagKs.filter((r) => r.point === ksFilter)).slice().sort((a, b) => {
    if (allJobs) return b.createdAt.localeCompare(a.createdAt);
    if (Boolean(a.fromChatId) !== Boolean(b.fromChatId)) return a.fromChatId ? -1 : 1;
    const na = Number(a.number);
    const nb = Number(b.number);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.number.localeCompare(b.number);
  });

  return (
    <div className="space-y-4">
      {!embedKind ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2" data-testid="sager-title">
              <TabPng name="sager" px={80} />
              <span className="text-xl font-semibold text-navy">{t(lang, "sagerTitle")}</span>
            </div>
            <button
              type="button"
              aria-label={t(lang, "newJob")}
              data-testid="sager-new"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"
              onClick={() => setCreating((v) => !v)}
            >
              <ActionPng name="sagerPlus" px={64} />
            </button>
          </div>

          {creating ? <CreateJobForm lang={lang} createdBy={masterId} onDone={(id) => selectJob(id)} /> : null}

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {active.map((p) => (
              <FilterChip key={p.id} active={mode === "job" && pick === p.id} onClick={() => selectJob(p.id)}>
                {p.name}
              </FilterChip>
            ))}
            <FilterChip active={mode === "all"} onClick={() => setMode("all")}>
              {t(lang, "sagAll")}
            </FilterChip>
            <FilterChip active={mode === "archived"} onClick={() => setMode("archived")}>
              {t(lang, "closedJobs", { n: archived.length })}
            </FilterChip>
            {mode === "job" && project?.status === "archived" ? (
              <FilterChip active onClick={() => selectJob(project.id)}>
                {project.name}
              </FilterChip>
            ) : null}
          </div>

          {mode === "all" ? (
            <ul className="space-y-2">
              {active.map((p) => (
                <li key={p.id}>
                  <JobCard project={p} onOpen={() => selectJob(p.id)} />
                </li>
              ))}
            </ul>
          ) : null}

          {mode === "archived" ? (
            archived.length ? (
              <ul className="space-y-2">
                {archived.map((p) => (
                  <li key={p.id}>
                    <ArchivedJobCard
                      project={p}
                      lang={lang}
                      onOpen={() => selectJob(p.id)}
                      onReopen={() => setReopenId(p.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t(lang, "noneYet")}</p>
            )
          ) : null}

          {mode === "job" && project && !list ? (
            <>
              <SagHeader
                project={project}
                lang={lang}
                onArchive={(archivedFlag) => archiveProject(project.id, archivedFlag)}
                onReopen={(reason) => {
                  archiveProject(project.id, false, reason);
                  setMode("job");
                  setPick(project.id);
                }}
              />
              <TypeRow
                kind="todo"
                title={t(lang, "rowTodo")}
                count={sagTodosOpen.length}
                onOpen={() => openList("todo")}
                onCreate={() => openList("todo", true)}
                createLabel={t(lang, "createNew")}
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
                kind="ud"
                title={t(lang, "udRow")}
                count={udCount}
                onOpen={() => openList("ud")}
                onCreate={() => setUdPick(true)}
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
                kind="slip"
                title={t(lang, "rowAs")}
                count={sagSlips.length}
                onOpen={() => openList("slip")}
                onCreate={() => openList("slip", true)}
                createLabel={t(lang, "createNew")}
              />
              <TypeRow
                kind="offer"
                title={t(lang, "rowTb")}
                count={sagOffers.length}
                onOpen={() => openList("offer")}
                onCreate={() => openList("offer", true)}
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
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "kundeSection")}</p>
                <KundeJobBar project={project} lang={lang} />
              </div>
              <SagFields key={project.id} project={project} lang={lang} />
            </>
          ) : null}
        </>
      ) : null}

      {list && (embedKind || project) ? (
        <ListSheet
          title={listTitle(list, lang)}
          lang={lang}
          onClose={() => {
            setList(null);
            setShowTrash(false);
            setKsFilter("all");
            onEmbedClose?.();
          }}
          onCreate={showTrash || list === "todo" ? undefined : () => {
            if (list === "ud") setUdPick(true);
            else {
              setComposeKind(makeKindOf(list));
              setCompose(true);
            }
          }}
          createName={plusForList(list)}
          createTestId={listPlusTestId(list)}
        >
          {list === "ks" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FilterChip
                active={!showTrash && ksFilter === "all"}
                onClick={() => {
                  setShowTrash(false);
                  setKsFilter("all");
                }}
              >
                {t(lang, "filterAll")} ({sagKs.length})
              </FilterChip>
              {ksPoints.map((p) => (
                <FilterChip
                  key={p}
                  active={!showTrash && ksFilter === p}
                  onClick={() => {
                    setShowTrash(false);
                    setKsFilter(p);
                  }}
                >
                  {p} ({sagKs.filter((r) => r.point === p).length})
                </FilterChip>
              ))}
              <FilterChip
                active={showTrash}
                onClick={() => {
                  setShowTrash(true);
                  setKsFilter("all");
                }}
              >
                {t(lang, "trashBin")} ({trashKs.length})
              </FilterChip>
            </div>
          ) : null}
          {list === "slip" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
                {t(lang, "filterAll")} ({sagSlips.length})
              </FilterChip>
              <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
                {t(lang, "trashBin")} ({trashSlips.length})
              </FilterChip>
            </div>
          ) : null}
          {list === "slip" ? (
            (showTrash ? trashSlips : sagSlips).length ? (
              <ul className="space-y-1.5">
                {(showTrash ? trashSlips : sagSlips).map((row) => {
                  const live = hydrateSoftrSlip(row);
                  const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
                  return (
                    <li key={row.id}>
                      <div className="rounded-xl bg-sand p-3">
                        <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "slip", id: row.id })}>
                          {thumb?.dataUrl ? (
                            <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <ReportThumb ids={live.photoIds ?? []} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                            {row.fromChatId ? (
                              <span className="mt-1 inline-block rounded-full bg-brick px-2 py-0.5 text-action font-bold uppercase tracking-wide text-sand">{t(lang, "boardFromChat")}</span>
                            ) : null}
                            <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                              {live.title}
                              {live.location ? ` · ${live.location}` : ""}
                            </span>
                            <JobHint lang={lang} show={allJobs} projectId={row.projectId} />
                            <span className="mt-0.5 block text-list leading-[1.4] text-ink">
                              {shortDate(live.createdAt)}
                              {live.photoIds.length ? ` · ${live.photoIds.length} foto` : ""}
                            </span>
                            <span className="mt-0.5 block text-list font-medium leading-[1.4] text-ink">{priceOf(live.customerPrice)}</span>
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <AsShareChip slip={live} lang={lang} />
                          <LedelseHak kind="as" report={live} lang={lang} />
                          {showTrash ? (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => restoreReport("slip", row.id)}>
                              {t(lang, "restoreTrash")}
                            </GhostButton>
                          ) : (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => trashReport("slip", row.id)}>
                              {t(lang, "trashBin")}
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{showTrash ? t(lang, "trashEmpty") : t(lang, "noSlipsYet")}</p>
            )
          ) : null}
          {list === "offer" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
                {t(lang, "filterAll")} ({sagOffers.length})
              </FilterChip>
              <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
                {t(lang, "trashBin")} ({trashOffers.length})
              </FilterChip>
            </div>
          ) : null}
          {list === "offer" ? (
            (showTrash ? trashOffers : sagOffers).length ? (
              <ul className="space-y-1.5">
                {(showTrash ? trashOffers : sagOffers).map((row) => {
                  const thumb = asPhotos.find((p) => row.photoIds?.includes(p.id));
                  return (
                    <li key={row.id}>
                      <div className="rounded-xl bg-sand p-3">
                        <button type="button" className="flex w-full items-start gap-3 text-left" data-testid={`tb-row-${row.id}`} onClick={() => setView({ kind: "offer", id: row.id })}>
                          {thumb?.dataUrl ? (
                            <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <ReportThumb ids={row.photoIds ?? []} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{row.number}</span>
                            <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                              {row.title}
                              {row.location ? ` · ${row.location}` : ""}
                            </span>
                            <JobHint lang={lang} show={allJobs} projectId={row.projectId} />
                            <span className="mt-0.5 block text-list leading-[1.4] text-ink">
                              {shortDate(row.createdAt)}
                              {row.photoIds.length ? ` · ${row.photoIds.length} foto` : ""}
                            </span>
                            <span className="mt-0.5 block text-list font-medium leading-[1.4] text-ink">{priceOf(row.customerPrice)}</span>
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <LedelseHak kind="tb" report={row} lang={lang} />
                          {showTrash ? (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => restoreReport("offer", row.id)}>
                              {t(lang, "restoreTrash")}
                            </GhostButton>
                          ) : (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => trashReport("offer", row.id)}>
                              {t(lang, "trashBin")}
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink" data-testid="tb-empty">{showTrash ? t(lang, "trashEmpty") : t(lang, "noOffersYet")}</p>
            )
          ) : null}
          {list === "tf" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
                {t(lang, "filterAll")} ({sagTfs.length})
              </FilterChip>
              <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
                {t(lang, "trashBin")} ({trashTfs.length})
              </FilterChip>
            </div>
          ) : null}
          {list === "tf" ? (
            (showTrash ? trashTfs : sagTfs).length ? (
              <ul className="space-y-1.5">
                {(showTrash ? trashTfs : sagTfs).map((row) => {
                  const live = hydrateSoftrTf(row);
                  const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
                  return (
                    <li key={row.id} className="rounded-xl bg-sand p-3">
                      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "tf", id: row.id })}>
                        {thumb?.dataUrl ? (
                          <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <ReportThumb ids={live.photoIds ?? []} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                          {row.fromChatId ? (
                            <span className="mt-1 inline-block rounded-full bg-brick px-2 py-0.5 text-action font-bold uppercase tracking-wide text-sand">{t(lang, "boardFromChat")}</span>
                          ) : null}
                          {live.answered ? <Chip tone="ok" className="ml-0 mt-1">{t(lang, "answered")}</Chip> : null}
                          <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                            {live.title || live.question}
                            {live.photoIds.length ? ` · ${live.photoIds.length} foto` : ""}
                          </span>
                          <JobHint lang={lang} show={allJobs} projectId={row.projectId} />
                          <span className="mt-0.5 block text-list leading-[1.4] text-ink">{shortDate(live.createdAt)}</span>
                        </span>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <TfShareChip tf={live} lang={lang} />
                        <LedelseHak kind="tf" report={live} lang={lang} />
                        <KundeHak kind="tf" report={live} lang={lang} />
                        {showTrash ? (
                          <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => restoreReport("tf", row.id)}>
                            {t(lang, "restoreTrash")}
                          </GhostButton>
                        ) : (
                          <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => trashReport("tf", row.id)}>
                            {t(lang, "trashBin")}
                          </GhostButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{showTrash ? t(lang, "trashEmpty") : t(lang, "noTfYet")}</p>
            )
          ) : null}
          {list === "ent" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
                {t(lang, "filterAll")} ({sagEnts.length})
              </FilterChip>
              <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
                {t(lang, "trashBin")} ({trashEnts.length})
              </FilterChip>
            </div>
          ) : null}
          {list === "ent" ? (
            (showTrash ? trashEnts : sagEnts).length ? (
              <ul className="space-y-1.5">
                {(showTrash ? trashEnts : sagEnts).map((row) => {
                  const live = hydrateSoftrEnt(row);
                  const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
                  return (
                    <li key={row.id}>
                      <div className="rounded-xl bg-sand p-3">
                        <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "ent", id: row.id })}>
                          {thumb?.dataUrl ? (
                            <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <ReportThumb ids={live.photoIds ?? []} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                            {row.fromChatId ? (
                              <span className="mt-1 inline-block rounded-full bg-brick px-2 py-0.5 text-action font-bold uppercase tracking-wide text-sand">{t(lang, "boardFromChat")}</span>
                            ) : null}
                            <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                              {live.title}
                              {live.location ? ` · ${live.location}` : ""}
                            </span>
                            <JobHint lang={lang} show={allJobs} projectId={row.projectId} />
                            <span className="mt-0.5 block text-list leading-[1.4] text-ink">
                              {shortDate(live.createdAt)}
                              {live.photoIds.length ? ` · ${live.photoIds.length} foto` : ""}
                            </span>
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ErShareChip ent={live} lang={lang} />
                          <LedelseHak kind="er" report={live} lang={lang} />
                          <KundeHak kind="er" report={live} lang={lang} />
                          {showTrash ? (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => restoreReport("ent", row.id)}>
                              {t(lang, "restoreTrash")}
                            </GhostButton>
                          ) : (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => trashReport("ent", row.id)}>
                              {t(lang, "trashBin")}
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{showTrash ? t(lang, "trashEmpty") : t(lang, "sagEntEmpty")}</p>
            )
          ) : null}
          {list === "ks" ? (
            (showTrash ? trashKs : shownKs).length ? (
              <ul className="space-y-1.5">
                {(showTrash ? trashKs : shownKs).map((row) => {
                  const live = hydrateSoftrReport(row);
                  return (
                    <li key={row.id} data-testid={`ks-row-${live.id}`}>
                      <div className="rounded-xl bg-sand p-3">
                        <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "ks", id: row.id })}>
                          <KsListThumb photoIds={live.photoIds ?? []} photos={photos} />
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">Nr. {live.number}</span>
                            {row.fromChatId ? (
                              <span className="mt-1 inline-block rounded-full bg-brick px-2 py-0.5 text-action font-bold uppercase tracking-wide text-sand">{t(lang, "boardFromChat")}</span>
                            ) : null}
                            <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                              {live.point} {findControlPoint(live.point, live.projectId)?.title ?? ""} · {live.employeeName ?? ""}
                              {live.location ? ` · ${live.location}` : ""}
                              {live.photoIds?.length ? ` · ${live.photoIds.length} foto` : ""}
                            </span>
                            <JobHint lang={lang} show={allJobs} projectId={row.projectId} />
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <KsShareChip report={live} lang={lang} />
                          <KundeHak kind="ks" report={live} lang={lang} />
                          {showTrash ? (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => restoreReport("ks", row.id)}>
                              {t(lang, "restoreTrash")}
                            </GhostButton>
                          ) : (
                            <GhostButton className="shrink-0 rounded-full bg-paper px-3 text-action" onClick={() => trashReport("ks", row.id)}>
                              {t(lang, "trashBin")}
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink">{showTrash ? t(lang, "trashEmpty") : t(lang, "sagKsEmpty")}</p>
            )
          ) : null}
          {list === "todo" ? (
            <div>
              {sagTodosOpen.length === 0 ? <p className="text-list leading-[1.4] text-ink">{t(lang, "todoNone")}</p> : null}
              <ul className="space-y-1.5">
                {sagTodosOpen.map((td) => (
                  <li key={td.id}>
                    <OpenTodoRow
                      td={td}
                      lang={lang}
                      onOpen={() => setView({ kind: "todo", id: td.id })}
                      hint={
                        <>
                          <JobHint lang={lang} show={allJobs} projectId={td.projectId} />
                          <TodoPhotos td={td} />
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
              <GhostButton className="mt-3 bg-paper" onClick={() => setView({ kind: "todo", id: "__done__" })}>
                {t(lang, "todoDoneLink")}
              </GhostButton>
            </div>
          ) : null}
          {list === "material" ? (
            <div>
              <MaterialBoard lang={lang} projectId={allJobs ? undefined : jobId} />
            </div>
          ) : null}
          {list === "ud" && jobId ? (
            <UdSheet projectId={jobId} lang={lang} onClose={() => setList(null)} onAdd={() => setUdPick(true)} />
          ) : null}
        </ListSheet>
      ) : null}

      {reopenId ? (
        <ReopenPicker
          lang={lang}
          onClose={() => setReopenId(null)}
          onPick={(reason: ReopenReason) => {
            archiveProject(reopenId, false, reason);
            selectJob(reopenId);
            setReopenId(null);
          }}
        />
      ) : null}

      {compose && project ? (
        composeKind === "material" ? (
          <NewOrderSheet
            lang={lang}
            projectId={allJobs ? undefined : project.id}
            pickJob={allJobs}
            onClose={() => setCompose(false)}
          />
        ) : composeKind === "ks" ? (
          <KsCompose
            projectId={project.id}
            lang={lang}
            onClose={() => setCompose(false)}
            onCreated={(id) => {
              setCompose(false);
              setView({ kind: "ks", id });
            }}
          />
        ) : (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
            <QuickCompose
              kind={composeKind}
              projectId={project.id}
              lang={lang}
              onClose={() => setCompose(false)}
              onCreated={(id) => {
                setCompose(false);
                if (composeKind === "todo") setView({ kind: "todo", id });
              }}
            />
          </div>
        )
      ) : null}

      {slip ? (
        <PrintChrome docId={slip.id} kind="slip" lang={lang} onClose={() => setView(null)}>
          <SlipDoc slip={slip} />
          <SlipInternalFlags slip={slip} onForwarded={() => toggleFwd(slip.id)} onPaid={() => togglePaid(slip.id)} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={slip.projectId} kind="slip" reportId={slip.id} attachedIds={slip.photoIds} />
          </div>
        </PrintChrome>
      ) : null}
      {offer ? (
        <PrintChrome docId={offer.id} kind="offer" lang={lang} onClose={() => setView(null)}>
          <OfferDoc offer={offer} />
          <SlipInternalFlags slip={offer} onForwarded={() => toggleOfferFwd(offer.id)} onPaid={() => toggleOfferPaid(offer.id)} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={offer.projectId} kind="offer" reportId={offer.id} attachedIds={offer.photoIds} />
          </div>
        </PrintChrome>
      ) : null}
      {tf ? (
        <PrintChrome docId={tf.id} kind="tf" lang={lang} onClose={() => setView(null)}>
          <TfDoc tf={tf} onAnswer={(a) => answerTf(tf.id, a)} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={tf.projectId} kind="tf" reportId={tf.id} attachedIds={tf.photoIds} />
          </div>
        </PrintChrome>
      ) : null}
      {ent ? (
        <PrintChrome docId={ent.id} kind="ent" lang={lang} onClose={() => setView(null)}>
          <EntDoc ent={ent} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={ent.projectId} kind="ent" reportId={ent.id} attachedIds={ent.photoIds} />
          </div>
        </PrintChrome>
      ) : null}
      {ks ? (
        <PrintChrome docId={ks.id} kind="ks" lang={lang} onClose={() => setView(null)}>
          <KsDoc report={ks} photos={photos} />
        </PrintChrome>
      ) : null}
      {view?.kind === "todo" && view.id === "__done__" && project ? (
        <DoneTodosSheet lang={lang} projectId={allJobs ? undefined : project.id} onClose={() => setView(null)} />
      ) : null}
      {view?.kind === "todo" && view.id !== "__done__" ? (
        (() => {
          const td = todos.find((x) => x.id === view.id);
          return td ? <TodoSheet td={td} lang={lang} onClose={() => setView(null)} /> : null;
        })()
      ) : null}

      {udPick && jobId ? <UdPick projectId={jobId} lang={lang} onClose={() => setUdPick(false)} /> : null}
    </div>
  );
}

function makeKindOf(kind: ListKind): MakeKind {
  if (kind === "slip") return "as";
  if (kind === "offer") return "tb";
  if (kind === "ent") return "er";
  if (kind === "material") return "material";
  if (kind === "todo") return "todo";
  if (kind === "tf") return "tf";
  return "ks";
}

function JobHint({ lang, show, projectId }: { lang: Lang; show: boolean; projectId: string }) {
  if (!show) return null;
  return <span className="mt-0.5 block text-list leading-[1.4] text-ink">{t(lang, "boardOnJob", { name: projectById(projectId).name })}</span>;
}

function shortDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

function priceOf(raw: string) {
  const digits = String(raw || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${Math.round(n).toLocaleString("da-DK")},-`;
}

function byAsNoDesc(a: { number: string }, b: { number: string }) {
  const na = Number(String(a.number).replace(/\D/g, "")) || 0;
  const nb = Number(String(b.number).replace(/\D/g, "")) || 0;
  return nb - na;
}

function byCreatedDesc(a: { createdAt?: string; at?: string; orderedAt?: string }, b: { createdAt?: string; at?: string; orderedAt?: string }) {
  const ta = a.createdAt ?? a.at ?? a.orderedAt ?? "";
  const tb = b.createdAt ?? b.at ?? b.orderedAt ?? "";
  return tb.localeCompare(ta);
}

function listTitle(kind: ListKind, lang: Lang) {
  if (kind === "slip") return t(lang, "extraWork");
  if (kind === "offer") return t(lang, "extraOffer");
  if (kind === "tf") return t(lang, "sagTf");
  if (kind === "ent") return t(lang, "sagEnt");
  if (kind === "todo") return t(lang, "rowTodo");
  if (kind === "material") return t(lang, "rowMaterial");
  if (kind === "ud") return t(lang, "udRow");
  return t(lang, "sagKs");
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-medium ${active ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
    >
      {children}
    </button>
  );
}

function JobCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <button type="button" className="block w-full rounded-[20px] bg-paper px-4 py-3 text-left shadow-card" onClick={onOpen}>
      <p className="font-display text-2xl text-navy">{project.name}</p>
      <p className="text-sm text-muted">{project.address}</p>
    </button>
  );
}

function ArchivedJobCard({
  project,
  lang,
  onOpen,
  onReopen,
}: {
  project: Project;
  lang: Lang;
  onOpen: () => void;
  onReopen: () => void;
}) {
  const handed = handoverDate(project);
  const one = oneYearDate(project);
  const five = fiveYearDate(project);
  return (
    <div className="rounded-[20px] bg-paper px-4 py-3 shadow-card">
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <p className="font-display text-2xl text-navy">{project.name}</p>
        {project.address ? <p className="text-sm text-muted">{project.address}</p> : null}
        {handed ? <p className="mt-1 text-xs text-muted">{t(lang, "handedOver", { date: fmtDaDate(handed) })}</p> : null}
        {one && five ? (
          <p className="mt-0.5 text-xs text-muted">{t(lang, "yearReviews", { one: fmtDaDate(one), five: fmtDaDate(five) })}</p>
        ) : null}
        <DueChips lang={lang} one={one} five={five} />
      </button>
      <GhostButton className="mt-3 w-full rounded-full bg-sand" onClick={onReopen}>
        {t(lang, "reopenJob")}
      </GhostButton>
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
  kind: ListKind;
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
        data-testid={`sag-row-${kind}`}
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
        <PlusRound label={createLabel || title} testId={`sag-plus-${kind}`} onClick={onCreate} px={52} />
      ) : null}
    </div>
  );
}

function TypeIcon({ kind }: { kind: ListKind }) {
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand" data-testid="sag-list-sheet">
      <div className="min-h-dvh px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="font-display text-title text-ink">{title}</h2>
          <CloseX onClick={onClose} label={t(lang, "close")} />
        </div>
        {onCreate && createName ? (
          <div className="mb-4">
            <PlusBtn name={createName} label={t(lang, "createNew")} testId={createTestId} onClick={onCreate} px={64} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function listPlusTestId(kind: ListKind) {
  if (kind === "slip") return "list-plus-slip";
  if (kind === "ent") return "list-plus-ent";
  if (kind === "material") return "list-plus-material";
  if (kind === "ud") return "sag-plus-ud-sheet";
  if (kind === "offer") return "sag-plus-offer-sheet";
  return `list-plus-${kind}`;
}
