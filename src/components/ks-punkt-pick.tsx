import { type ChangeEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { lookupProject, useYard } from "@/lib/store";
import { slugForProject, snapshotKundeReport } from "@/lib/ks-customer";
import { setKundeReportStatus } from "@/lib/ks-customer.functions";
import { PUNKT_NEW, punktChoices, recalledKundePunkt, rememberKundePunkt } from "@/lib/ks-punkt";
import { softrKsPhotos } from "@/lib/softr-ks";
import { t } from "@/lib/i18n";
import type { KsReport, Lang } from "@/lib/types";

export function KsPunktPick({ report, lang }: { report: KsReport; lang: Lang }) {
  const setKsPunkt = useYard((s) => s.setKsPunkt);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const ksReports = useYard((s) => s.ksReports);
  const live = ksReports.find((x) => x.id === report.id) ?? report;
  const current = (live.kundePunkt || recalledKundePunkt(live.id) || "").trim();
  const [picked, setPicked] = useState(current);
  const shown = picked || current;
  const choices = useMemo(() => {
    const rows = ksReports.filter((r) => r.projectId === live.projectId);
    const list = punktChoices(live.projectId, rows.length ? rows : [live]);
    if (shown && !list.some((c) => c.value === shown)) {
      list.push({ value: shown, label: shown, custom: true });
    }
    return list;
  }, [ksReports, live.projectId, live, shown]);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (current && current !== picked) setPicked(current);
  }, [current, picked]);

  async function persist(value: string) {
    if (busy) return;
    setBusy(true);
    const prev = picked;
    rememberKundePunkt(live.id, value);
    setPicked(value);
    if (!ksReports.some((x) => x.id === live.id)) {
      useYard.setState((s) => ({ ksReports: [{ ...live, kundePunkt: value }, ...s.ksReports] }));
    }
    const ok = await setKsPunkt(live.id, value);
    if (!ok) {
      rememberKundePunkt(live.id, prev);
      setPicked(prev);
      setBusy(false);
      return;
    }
      const ks = useYard.getState().ksReports.find((x) => x.id === live.id) ?? { ...live, kundePunkt: value };
      if (ks.kundeStatus === "med_til_kunden") {
        const job = lookupProject(ks.projectId);
        const photos = [...softrKsPhotos(), ...drivePhotos];
        const payload = snapshotKundeReport(ks, job, photos);
        void setKundeReportStatus({
          data: {
            slug: slugForProject(job),
            projectId: job.id,
            reportId: ks.id,
            status: "med_til_kunden",
            payload,
          },
        });
      }
    setBusy(false);
  }

  async function commitNew() {
    const v = draft.trim();
    setCustom(false);
    if (!v) return;
    await persist(v);
  }

  function onSelect(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === PUNKT_NEW) {
      setCustom(true);
      setDraft("");
      return;
    }
    setCustom(false);
    void persist(v);
  }

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitNew();
    }
    if (e.key === "Escape") setCustom(false);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" onClick={stop} onPointerDown={stop}>
      <select
        data-testid={`ks-punkt-${live.id}`}
        data-punkt={shown || ""}
        value={custom ? PUNKT_NEW : shown}
        disabled={busy}
        onChange={onSelect}
        className="h-7 max-w-[12.5rem] shrink-0 rounded-md bg-white px-1.5 text-[11px] font-semibold text-navy ring-1 ring-line disabled:opacity-70"
        aria-label={t(lang, "ksPunkt")}
      >
        <option value="">{t(lang, "ksPunktPick")}</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
        <option value={PUNKT_NEW}>{t(lang, "ksPunktNew")}</option>
      </select>
      {custom ? (
        <input
          autoFocus
          data-testid={`ks-punkt-new-${live.id}`}
          value={draft}
          placeholder={t(lang, "ksPunktNew")}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKey}
          onBlur={() => void commitNew()}
          className="h-7 min-w-[8rem] rounded-md bg-white px-1.5 text-[11px] font-semibold text-navy ring-1 ring-line"
        />
      ) : null}
    </div>
  );
}
