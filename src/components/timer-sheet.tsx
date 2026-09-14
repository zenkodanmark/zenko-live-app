import { useEffect, useMemo, useRef, useState } from "react";
import { KsCompose } from "@/components/ks-compose";
import { ActionPng, BackArrow } from "@/components/sag-icons";
import { PrimaryButton } from "@/components/zenko";
import { t, localeFor } from "@/lib/i18n";
import { fileHref } from "@/lib/plads-file";
import { copenhagenDate } from "@/lib/seed";
import { activeAssigned, useSessionEmployee, useYard } from "@/lib/store";
import { listMyTimeEntries, parseHours, saveTimeEntry, shiftMonth, timerDayLabel, monthCells, type TimeEntry, type TimeKind } from "@/lib/time-entry";
import type { Lang } from "@/lib/types";

type Draft = { name: string; dataUrl: string };

export function TimerSheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const emp = useSessionEmployee();
  const projects = useYard((s) => s.projects) ?? [];
  const assignments = useYard((s) => s.assignments) ?? [];
  const today = copenhagenDate();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y!, month: (m ?? 1) - 1 };
  });
  const [day, setDay] = useState(today);
  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("");
  const [kind, setKind] = useState<TimeKind>("normal");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ks, setKs] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const jobs = emp ? activeAssigned(emp.id, emp.role, projects, assignments) : [];
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const dotted = useMemo(() => new Set(rows.map((r) => r.date)), [rows]);
  const dayRows = rows.filter((r) => r.date === day);
  const monthTitle = new Intl.DateTimeFormat(localeFor(lang), { month: "long", year: "numeric" }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));

  useEffect(() => {
    if (!emp) return;
    void listMyTimeEntries(emp.id).then(setRows);
  }, [emp]);

  if (!emp) return null;
  const meId = emp.id;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: Draft[] = [];
    for (const file of [...list]) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (dataUrl.startsWith("data:")) next.push({ name: file.name || "foto.jpg", dataUrl });
    }
    setDrafts((cur) => [...cur, ...next]);
  }

  async function save() {
    const h = parseHours(hours);
    if (!projectId || h == null) {
      setErr(t(lang, "timerNeedJobHours"));
      return;
    }
    setBusy(true);
    setErr("");
    const photos = drafts.map((d) => ({
      name: d.name,
      contentBase64: d.dataUrl.split(",")[1] ?? "",
      mimeType: "image/jpeg",
    }));
    const res = await saveTimeEntry({
      employeeId: meId,
      projectId,
      date: day,
      hours: h,
      type: kind,
      note: note.trim(),
      photos,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t(lang, "timerNotSent"));
      return;
    }
    setRows((cur) => [res.row, ...cur.filter((x) => x.id !== res.row.id)]);
    setHours("");
    setNote("");
    setDrafts([]);
    setKind("normal");
    requestAnimationFrame(() => document.querySelector("[data-testid=timer-row]")?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-sand" data-testid="timer-sheet" role="dialog">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <BackArrow onClick={onClose} label={t(lang, "back")} />
        <p className="font-display text-title text-sand">{t(lang, "timerTab")}</p>
      </div>
      <div className="mx-auto max-w-lg px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="min-h-11 min-w-11 px-2 text-2xl text-navy" aria-label={t(lang, "timerPrev")} onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}>
            ‹
          </button>
          <p className="font-display text-2xl capitalize text-navy">{monthTitle}</p>
          <button type="button" className="min-h-11 min-w-11 px-2 text-2xl text-navy" aria-label={t(lang, "timerNext")} onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}>
            ›
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
          {Array.from({ length: 7 }, (_, i) =>
            new Intl.DateTimeFormat(localeFor(lang), { weekday: "short" }).format(new Date(Date.UTC(2026, 8, 7 + i))),
          ).map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e-${i}`} />;
            const on = iso === day;
            const isToday = iso === today;
            return (
              <button
                key={iso}
                type="button"
                data-testid={`timer-day-${iso}`}
                onClick={() => setDay(iso)}
                className={`relative min-h-12 rounded-xl text-sm font-semibold ${on ? "bg-terracotta text-sand" : isToday ? "bg-navy text-sand" : "bg-paper text-ink"}`}
              >
                {Number(iso.slice(8))}
                {dotted.has(iso) ? <span className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${on || isToday ? "bg-sand" : "bg-terracotta"}`} /> : null}
              </button>
            );
          })}
        </div>

        {day ? (
          <div className="mt-5 space-y-3">
            <p className="font-display text-3xl text-navy" data-testid="timer-day-label">
              {timerDayLabel(day, lang)}
            </p>
            {dayRows.length ? (
              <ul className="space-y-2">
                {dayRows.map((row) => {
                  const job = jobs.find((j) => j.id === row.projectId) ?? projects.find((p) => p.id === row.projectId);
                  const thumb = row.files[0]?.fileId;
                  return (
                    <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2 shadow-card" data-testid="timer-row">
                      {thumb ? <img src={fileHref(thumb)} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-sand" />}
                      <span className="min-w-0">
                        <span className="block font-display text-title text-navy">
                          {String(row.hours).replace(".", ",")} {t(lang, "hoursUnit")}
                          {row.type !== "normal" ? ` · ${row.type}` : ""}
                        </span>
                        <span className="block truncate text-sm text-muted">{job?.name ?? row.projectId}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "chooseProject")}</p>
            <ul className="space-y-1.5">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setProjectId(j.id)}
                    className={`min-h-12 w-full rounded-xl px-3 text-left text-sm font-medium ${projectId === j.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                  >
                    {j.name}
                  </button>
                </li>
              ))}
            </ul>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {t(lang, "timerHours")}
              <input
                data-testid="timer-hours"
                inputMode="decimal"
                className="mt-1 min-h-12 w-full rounded-xl bg-paper px-3 text-lg text-ink shadow-card"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="8"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(["normal", "ot50", "ot100"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={`min-h-14 rounded-xl text-sm font-semibold ${kind === id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                >
                  {id === "normal" ? t(lang, "timerNormal") : id}
                </button>
              ))}
            </div>

            <textarea
              className="min-h-20 w-full rounded-xl bg-paper px-3 py-2 text-sm shadow-card"
              placeholder={t(lang, "timerNote")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-3">
              <button type="button" className="flex flex-1 flex-col items-center" onClick={() => camRef.current?.click()}>
                <ActionPng name="camCompact" px={56} />
                <span className="mt-1 text-xs">{t(lang, "camera")}</span>
              </button>
              <button type="button" className="flex flex-1 flex-col items-center" onClick={() => galRef.current?.click()}>
                <ActionPng name="gallery" px={56} />
                <span className="mt-1 text-xs">{t(lang, "gallery")}</span>
              </button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
            <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
            {drafts.length ? (
              <ul className="grid grid-cols-3 gap-2">
                {drafts.map((d, i) => (
                  <li key={`${d.name}-${i}`}>
                    <img src={d.dataUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  </li>
                ))}
              </ul>
            ) : null}

            {err ? <p className="text-sm text-brick">{err}</p> : null}
            <PrimaryButton data-testid="timer-save" disabled={busy} className="bg-terracotta" onClick={() => void save()}>
              {busy ? t(lang, "saving") : t(lang, "save")}
            </PrimaryButton>
            {projectId ? (
              <button type="button" className="w-full min-h-11 text-sm font-semibold text-navy underline" onClick={() => setKs(true)}>
                {t(lang, "timerMakeKs")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {ks && projectId ? (
        <KsCompose
          projectId={projectId}
          lang={lang}
          workDate={day}
          onClose={() => setKs(false)}
          onCreated={() => setKs(false)}
        />
      ) : null}
    </div>
  );
}

export function TimerOpenBtn({ lang, onClick }: { lang: Lang; onClick: () => void }) {
  return (
    <button type="button" data-testid="timer-open" onClick={onClick} className="flex w-14 shrink-0 flex-col items-center gap-1">
      <img src="/icons/action/timer-helmet.svg" alt="" width={44} height={44} className="size-11" draggable={false} />
      <span className="text-[11px] font-semibold leading-none text-navy">{t(lang, "timerTab")}</span>
    </button>
  );
}
