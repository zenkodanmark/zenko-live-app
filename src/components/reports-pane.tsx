import { useMemo, useState } from "react";
import { FieldAttach, InboxPane } from "@/components/inbox-pane";
import { EntDoc, KsDoc, PackDoc, PrintChrome, SlipDoc, SlipInternalFlags, TfDoc } from "@/components/print-docs";
import { AsShareChip, ErShareChip, KsShareChip } from "@/components/report-share-bar";
import { TfShareChip } from "@/components/tf-share-bar";
import { KundeHak } from "@/components/kunde-hak";
import { LedelseHak } from "@/components/ledelse-hak";
import { DrivePhoto } from "@/components/drive-photo";
import { ReportThumb } from "@/components/photo-strip";
import { Card, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { downloadCsv } from "@/lib/csv";
import { t } from "@/lib/i18n";
import { OSVALDO_DATALON } from "@/lib/datalon-osvaldo.ts";
import { copenhagenDate, copenhagenTime, hoursWorked, projectById } from "@/lib/seed";
import { payrollReady, useYard } from "@/lib/store";
import { buildHoursPack, downloadHours } from "@/lib/bot-actions";
import { hydrateSoftrSlip, softrAsFieldItems } from "@/lib/softr-as";
import { hydrateSoftrEnt } from "@/lib/softr-er";
import { hydrateSoftrTf } from "@/lib/softr-tf";
import { hydrateSoftrReport, softrKsPhotos } from "@/lib/softr-ks";
import type { Lang } from "@/lib/types";

type Kind = "felt" | "ks" | "tf" | "slip" | "ent" | "pack" | "lon";

export function ReportsPane({ lang }: { lang: Lang }) {
  const [kind, setKind] = useState<Kind>("felt");
  const [pick, setPick] = useState("");
  const [view, setView] = useState<{ kind: Kind; id: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const projects = useYard((s) => s.projects);
  const slips = useYard((s) => s.slips);
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const packs = useYard((s) => s.packs);
  const ksReports = useYard((s) => s.ksReports);
  const employees = useYard((s) => s.employees);
  const days = useYard((s) => s.days);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const fieldItems = useYard((s) => s.fieldItems);
  const exportReady = useYard((s) => s.exportReady);
  const toggleFwd = useYard((s) => s.toggleSlipForwarded);
  const togglePaid = useYard((s) => s.toggleSlipPaid);
  const answerTf = useYard((s) => s.answerTf);
  const trashReport = useYard((s) => s.trashReport);
  const restoreReport = useYard((s) => s.restoreReport);
  const photos = useMemo(
    () => [...softrKsPhotos(), ...Object.values(days).flatMap((d) => d.photos), ...drivePhotos],
    [days, drivePhotos],
  );
  const asPhotos = useMemo(() => [...softrAsFieldItems(), ...fieldItems], [fieldItems]);
  const date = copenhagenDate();
  const today = Object.values(days).filter((d) => d.date === date);
  const ready = today.filter((d) => (payrollReady(d) || d.status === "exported") && (!pick || d.projectId === pick));
  const active = projects.filter((p) => p.status === "active");
  const liveSlips = slips.filter((s) => !s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const trashSlips = slips.filter((s) => s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const sagSlips = showTrash && kind === "slip" ? trashSlips : liveSlips;
  const liveTfs = tfs.filter((s) => !s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const trashTfs = tfs.filter((s) => s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const sagTfs = showTrash && kind === "tf" ? trashTfs : liveTfs;
  const liveEnts = ents.filter((s) => !s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const trashEnts = ents.filter((s) => s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoDesc);
  const sagEnts = showTrash && kind === "ent" ? trashEnts : liveEnts;
  const liveKs = ksReports.filter((s) => !s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoAsc);
  const trashKs = ksReports.filter((s) => s.trashedAt && (!pick || s.projectId === pick)).slice().sort(byNoAsc);
  const sagKs = showTrash && kind === "ks" ? trashKs : liveKs;
  const sagPacks = packs.filter((s) => !pick || s.projectId === pick);
  const tabs: { id: Kind; label: string; count?: number }[] = [
    { id: "felt", label: t(lang, "fieldTab") },
    { id: "slip", label: t(lang, "extraWork"), count: liveSlips.length },
    { id: "tf", label: t(lang, "tfSection"), count: liveTfs.length },
    { id: "ent", label: t(lang, "entrepreneur"), count: liveEnts.length },
    { id: "ks", label: t(lang, "ksReport"), count: liveKs.length },
    { id: "pack", label: t(lang, "invoicePack"), count: sagPacks.length },
    { id: "lon", label: t(lang, "exportPayroll") },
  ];

  function csv() {
    const header = ["Medarbejder", "Dato", "Møde", "Gå", "Timer", "KS", "Status", "Sag"];
    const rows = ready.map((d) => {
      const e = employees.find((x) => x.id === d.employeeId);
      return [e?.name ?? d.employeeId, d.date, d.checkInAt ? copenhagenTime(d.checkInAt) : "", d.checkOutAt ? copenhagenTime(d.checkOutAt) : "", hoursWorked(d).toFixed(2).replace(".", ","), String(d.photos.length), d.status, projectById(d.projectId).name];
    });
    downloadCsv(`datalon-${date}.csv`, header, rows);
    exportReady();
  }

  const slip = view?.kind === "slip" ? (() => {
    const row = slips.find((s) => s.id === view.id);
    return row ? hydrateSoftrSlip(row) : null;
  })() : null;
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
  const pack = view?.kind === "pack" ? packs.find((s) => s.id === view.id) : null;

  const empty =
    (kind === "slip" && sagSlips.length === 0) ||
    (kind === "tf" && sagTfs.length === 0) ||
    (kind === "ent" && sagEnts.length === 0) ||
    (kind === "ks" && sagKs.length === 0) ||
    (kind === "pack" && sagPacks.length === 0);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-navy">{t(lang, "reportsTitle")}</h1>
      <p className="text-sm text-muted">{t(lang, "notSent")}</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setPick("")}
          className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${pick === "" ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
        >
          {t(lang, "filterAll")}
        </button>
        {active.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPick(p.id)}
            className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${pick === p.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setKind(tab.id);
              setShowTrash(false);
            }}
            className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${kind === tab.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
          >
            {tab.label}
            {tab.count != null ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>
      {kind === "felt" ? <InboxPane lang={lang} projectId={pick || undefined} /> : null}
      {kind === "lon" ? (
        <Card>
          <SectionLabel>{t(lang, "readyRows")}</SectionLabel>
          <p className="text-sm">{ready.length} rækker</p>
          <PrimaryButton className="mt-3" onClick={csv}>
            {t(lang, "downloadCsv")}
          </PrimaryButton>
          <div className="mt-5">
            <SectionLabel>{t(lang, "datalonTitle")}</SectionLabel>
            <p className="text-sm leading-relaxed text-muted">{t(lang, "datalonHint")}</p>
            <DatalonSummary lang={lang} />
          </div>
        </Card>
      ) : null}
      {kind === "slip" ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
            {t(lang, "filterAll")} ({liveSlips.length})
          </FilterChip>
          <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
            {t(lang, "trashBin")} ({trashSlips.length})
          </FilterChip>
        </div>
      ) : null}
      {kind === "ks" ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
            {t(lang, "filterAll")} ({liveKs.length})
          </FilterChip>
          <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
            {t(lang, "trashBin")} ({trashKs.length})
          </FilterChip>
        </div>
      ) : null}
      {kind === "tf" ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
            {t(lang, "filterAll")} ({liveTfs.length})
          </FilterChip>
          <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
            {t(lang, "trashBin")} ({trashTfs.length})
          </FilterChip>
        </div>
      ) : null}
      {kind === "ent" ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!showTrash} onClick={() => setShowTrash(false)}>
            {t(lang, "filterAll")} ({liveEnts.length})
          </FilterChip>
          <FilterChip active={showTrash} onClick={() => setShowTrash(true)}>
            {t(lang, "trashBin")} ({trashEnts.length})
          </FilterChip>
        </div>
      ) : null}
      {kind === "slip"
        ? sagSlips.map((s) => {
            const live = hydrateSoftrSlip(s);
            const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
            const job = projects.find((p) => p.id === live.projectId);
            return (
              <div key={s.id} className="rounded-xl bg-paper p-3 shadow-card">
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "slip", id: s.id })}>
                  {thumb?.dataUrl ? (
                    <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <ReportThumb ids={live.photoIds ?? []} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                    <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                      {live.title}
                      {live.location ? ` · ${live.location}` : ""}
                      {!pick && job ? ` · ${job.name}` : ""}
                    </span>
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
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => restoreReport("slip", s.id)}>
                      {t(lang, "restoreTrash")}
                    </GhostButton>
                  ) : (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => trashReport("slip", s.id)}>
                      {t(lang, "trashBin")}
                    </GhostButton>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {kind === "tf"
        ? sagTfs.map((s) => {
            const live = hydrateSoftrTf(s);
            const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
            return (
              <div key={s.id} className="rounded-xl bg-paper p-3 shadow-card">
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "tf", id: s.id })}>
                  {thumb?.dataUrl ? (
                    <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <ReportThumb ids={live.photoIds ?? []} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                    <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">{live.title || live.question}</span>
                    <span className="mt-0.5 block text-list leading-[1.4] text-ink">
                      {shortDate(live.createdAt)}
                      {live.photoIds.length ? ` · ${live.photoIds.length} foto` : ""}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TfShareChip tf={live} lang={lang} />
                  <LedelseHak kind="tf" report={live} lang={lang} />
                  {showTrash ? (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => restoreReport("tf", s.id)}>
                      {t(lang, "restoreTrash")}
                    </GhostButton>
                  ) : (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => trashReport("tf", s.id)}>
                      {t(lang, "trashBin")}
                    </GhostButton>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {kind === "ent"
        ? sagEnts.map((s) => {
            const live = hydrateSoftrEnt(s);
            const thumb = asPhotos.find((p) => live.photoIds?.includes(p.id));
            const job = projects.find((p) => p.id === live.projectId);
            return (
              <div key={s.id} className="rounded-xl bg-paper p-3 shadow-card">
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "ent", id: s.id })}>
                  {thumb?.dataUrl ? (
                    <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <ReportThumb ids={live.photoIds ?? []} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">{live.number}</span>
                    <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                      {live.title}
                      {live.location ? ` · ${live.location}` : ""}
                      {!pick && job ? ` · ${job.name}` : ""}
                    </span>
                    <span className="mt-0.5 block text-list leading-[1.4] text-ink">
                      {shortDate(live.createdAt)}
                      {live.photoIds.length ? ` · ${live.photoIds.length} foto` : ""}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ErShareChip ent={live} lang={lang} />
                  <LedelseHak kind="er" report={live} lang={lang} />
                  {showTrash ? (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => restoreReport("ent", s.id)}>
                      {t(lang, "restoreTrash")}
                    </GhostButton>
                  ) : (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => trashReport("ent", s.id)}>
                      {t(lang, "trashBin")}
                    </GhostButton>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {kind === "ks"
        ? sagKs.map((s) => {
            const live = hydrateSoftrReport(s);
            const thumb = photos.find((p) => live.photoIds?.includes(p.id));
            return (
              <div key={s.id} className="rounded-xl bg-paper p-3 shadow-card">
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setView({ kind: "ks", id: s.id })}>
                  {thumb ? (
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                      <DrivePhoto photo={thumb} className="h-14 w-14 object-cover" />
                    </span>
                  ) : (
                    <ReportThumb ids={live.photoIds ?? []} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap font-display text-title font-semibold text-ink">Nr. {live.number}</span>
                    <span className="mt-0.5 block truncate text-list leading-[1.4] text-ink">
                      {live.point} · {live.employeeName ?? ""}
                      {live.location ? ` · ${live.location}` : ""}
                      {live.photoIds?.length ? ` · ${live.photoIds.length} foto` : ""}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <KsShareChip report={live} lang={lang} />
                  <KundeHak report={live} lang={lang} />
                  {showTrash ? (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => restoreReport("ks", s.id)}>
                      {t(lang, "restoreTrash")}
                    </GhostButton>
                  ) : (
                    <GhostButton className="shrink-0 rounded-full bg-sand px-3 text-action" onClick={() => trashReport("ks", s.id)}>
                      {t(lang, "trashBin")}
                    </GhostButton>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {kind === "pack"
        ? sagPacks.map((s) => (
            <button key={s.id} type="button" className="block w-full rounded-xl bg-paper px-3 py-3 text-left shadow-card" onClick={() => setView({ kind: "pack", id: s.id })}>
              {s.number} · {s.title}
            </button>
          ))
        : null}
      {empty ? <p className="text-list leading-[1.4] text-ink">{showTrash ? t(lang, "trashEmpty") : t(lang, "reportsNoMatch")}</p> : null}

      {slip ? (
        <PrintChrome docId={slip.id} kind="slip" onClose={() => setView(null)}>
          <SlipDoc slip={slip} />
          <SlipInternalFlags slip={slip} onForwarded={() => toggleFwd(slip.id)} onPaid={() => togglePaid(slip.id)} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={slip.projectId} kind="slip" reportId={slip.id} attachedIds={slip.photoIds} />
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
        <PrintChrome docId={ent.id} kind="ent" onClose={() => setView(null)}>
          <EntDoc ent={ent} />
          <div className="no-print mx-auto max-w-[210mm] px-4 pb-8">
            <FieldAttach lang={lang} projectId={ent.projectId} kind="ent" reportId={ent.id} attachedIds={ent.photoIds} />
          </div>
        </PrintChrome>
      ) : null}
      {ks ? (
        <PrintChrome docId={ks.id} kind="ks" onClose={() => setView(null)}>
          <KsDoc report={ks} photos={photos} />
        </PrintChrome>
      ) : null}
      {pack ? (
        <PrintChrome docId={pack.id} kind="pack" onClose={() => setView(null)}>
          <PackDoc pack={pack} slips={slips} />
        </PrintChrome>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${active ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
    >
      {children}
    </button>
  );
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

function byNoDesc(a: { number: string }, b: { number: string }) {
  return (Number(String(b.number).replace(/\D/g, "")) || 0) - (Number(String(a.number).replace(/\D/g, "")) || 0);
}

function byNoAsc(a: { number: string }, b: { number: string }) {
  return (Number(String(a.number).replace(/\D/g, "")) || 0) - (Number(String(b.number).replace(/\D/g, "")) || 0);
}

function DatalonSummary({ lang }: { lang: Lang }) {
  const days = useYard((s) => s.days);
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const hours = OSVALDO_DATALON.reduce((n, r) => n + r.minutes, 0) / 60;
  const byJob = new Map<string, { days: number; hours: number }>();
  for (const r of OSVALDO_DATALON) {
    const name = projectById(r.projectId).name;
    const cur = byJob.get(name) ?? { days: 0, hours: 0 };
    cur.days += 1;
    cur.hours += r.minutes / 60;
    byJob.set(name, cur);
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium">
        {t(lang, "datalonDays", { n: OSVALDO_DATALON.length })} · {t(lang, "datalonHours", { h: hours.toFixed(1).replace(".", ",") })}
      </p>
      <ul className="space-y-1 text-sm">
        {[...byJob.entries()].map(([name, v]) => (
          <li key={name} className="rounded-lg bg-sand px-3 py-2">
            {name} · {t(lang, "datalonDays", { n: v.days })} · {t(lang, "datalonHours", { h: v.hours.toFixed(1).replace(".", ",") })}
          </li>
        ))}
      </ul>
      <PrimaryButton
        className="mt-2"
        onClick={() => downloadHours(buildHoursPack(days, employees, projects, { employeeName: "Osvaldo" }))}
      >
        {t(lang, "datalonDownload")}
      </PrimaryButton>
    </div>
  );
}
