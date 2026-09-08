import { useMemo, useRef, useState } from "react";
import { CrewTodos } from "@/components/crew-todos";
import { FacePhoto } from "@/components/face-photo";
import { PlanWeekRow, WeekSwipe } from "@/components/plan-pane";
import { BackArrow } from "@/components/sag-icons";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { LogoutButton } from "@/components/logout-button";
import { PinEditor } from "@/components/pin-editor";
import { uploadProfilePhoto } from "@/lib/drive.functions";
import { PushSetup } from "@/components/push-setup";
import { t, localeFor } from "@/lib/i18n";
import { isoWeek, planCoversPerson, planPlaceLabel, weekdayLabel, weekStartForPerson } from "@/lib/plan";
import { copenhagenDate, copenhagenTime, hoursWorked, projectById } from "@/lib/seed";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { DayLog, Lang, PlanBlock } from "@/lib/types";

export function MePane({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee();
  const days = useYard((s) => s.days) ?? {};
  const plans = useYard((s) => s.plans) ?? [];
  const setLang = useYard((s) => s.setLang);
  const projects = useYard((s) => s.projects) ?? [];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [job, setJob] = useState("all");
  const [status, setStatus] = useState<"all" | "done" | "open">("all");
  const [q, setQ] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [planPick, setPlanPick] = useState<{ block: PlanBlock; date: string } | null>(null);
  if (!emp) return null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(days)
      .filter((d) => d.employeeId === emp.id && d.checkInAt)
      .filter((d) => (from ? d.date >= from : true))
      .filter((d) => (to ? d.date <= to : true))
      .filter((d) => (job === "all" ? true : d.projectId === job))
      .filter((d) => (status === "done" ? Boolean(d.checkOutAt) : status === "open" ? !d.checkOutAt : true))
      .filter((d) => {
        if (!needle) return true;
        const sag = d.projectId ? projectById(d.projectId).name : "";
        return `${d.date} ${sag} ${d.workNote ?? ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [days, emp.id, from, to, job, status, q]);

  const total = rows.reduce((n, d) => n + hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now()), 0);
  const mine = plans.filter((p) => planCoversPerson(p, emp.id));
  const shownWeek = weekStart || weekStartForPerson(plans, emp.id);
  const langs: Lang[] = ["da", "ro", "pl", "uk", "de", "en", "es"];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-navy">{t(lang, "meTitle")}</h1>
      <ProfileCard lang={lang} />
      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "changePin")}</SectionLabel>
        <PinEditor emp={emp} lang={lang} />
      </Card>

      <Card className="rounded-[20px]">
        <SectionLabel>
          <span data-testid="me-week-label">
            {t(lang, "planWeek")} {isoWeek(shownWeek)}
          </span>
        </SectionLabel>
        <p className="mb-2 text-sm text-muted">{t(lang, "mePlanHint")}</p>
        <WeekSwipe weekStart={shownWeek} onWeekStart={setWeekStart}>
          {(start, daysOf) => (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase text-muted">
                {daysOf.map((d) => (
                  <div key={d}>
                    <span className="block">{weekdayLabel(d, localeFor(lang))}</span>
                    <span className="font-display text-base text-navy">{Number(d.slice(8))}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1">
                <PlanWeekRow
                  days={daysOf}
                  blocks={plans.filter((p) => planCoversPerson(p, emp.id) && !(p.end < start || p.start > daysOf[6]!))}
                  onOpen={(block, date) => setPlanPick({ block, date })}
                />
              </div>
            </>
          )}
        </WeekSwipe>
        {mine.length === 0 ? <p className="mt-2 text-sm text-muted">{t(lang, "meNoPlan")}</p> : null}
      </Card>

      <CrewTodos lang={lang} all />

      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "hours")}</SectionLabel>
        <p className="font-display text-4xl text-navy">
          {total.toFixed(1).replace(".", ",")} {t(lang, "hoursUnit")}
        </p>
        <p className="text-sm text-muted">{t(lang, "meHoursHint", { n: rows.length })}</p>
        <label className="mt-3 block text-xs text-muted">
          {t(lang, "meSearch")}
          <input
            type="search"
            className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm text-ink"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(lang, "meSearch")}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            {t(lang, "meFrom")}
            <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-2 text-sm text-ink" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            {t(lang, "meTo")}
            <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-2 text-sm text-ink" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FilterChip active={job === "all"} onClick={() => setJob("all")}>
            {t(lang, "filterAll")}
          </FilterChip>
          {projects
            .filter((p) => p.status === "active")
            .map((p) => (
              <FilterChip key={p.id} active={job === p.id} onClick={() => setJob(p.id)}>
                {p.name}
              </FilterChip>
            ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
            {t(lang, "filterAll")}
          </FilterChip>
          <FilterChip active={status === "done"} onClick={() => setStatus("done")}>
            {t(lang, "meDone")}
          </FilterChip>
          <FilterChip active={status === "open"} onClick={() => setStatus("open")}>
            {t(lang, "meOpenDay")}
          </FilterChip>
        </div>
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {rows.slice(0, 40).map((d) => (
            <HourRow key={`${d.employeeId}:${d.date}`} d={d} lang={lang} />
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted">{t(lang, "meNoHours")}</p> : null}
        </ul>
      </Card>

      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "language")}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {langs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLang(id)}
              className={`min-h-11 rounded-full px-3 text-xs font-medium ${lang === id ? "bg-navy text-sand" : "bg-sand"}`}
            >
              {id.toUpperCase()}
            </button>
          ))}
        </div>
      </Card>

      <PushSetup lang={lang} />

      <LogoutButton lang={lang} full />
      {planPick ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/50">
          <div className="mx-auto mt-16 max-w-lg rounded-[20px] bg-paper px-4 py-5 shadow-card">
            <BackArrow onClick={() => setPlanPick(null)} label={t(lang, "back")} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "planDayTitle")}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "planWhere")}</p>
            <p className="font-display text-3xl text-navy">{planPlaceLabel(planPick.block)}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "planWhat")}</p>
            <p className="text-lg">{planPick.block.title}</p>
            <p className="mt-3 text-sm text-muted">
              {t(lang, "planWhen")}: {weekdayLabel(planPick.date, localeFor(lang))} {planPick.date}
              {planPick.block.start !== planPick.block.end ? ` · ${planPick.block.start}–${planPick.block.end}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HourRow({ d, lang }: { d: DayLog; lang: Lang }) {
  const h = hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now());
  return (
    <li className="rounded-xl bg-sand px-3 py-2 text-sm">
      <span className="font-medium">{d.date}</span>
      <span className="text-muted">
        {" · "}
        {h.toFixed(1).replace(".", ",")} {t(lang, "hoursUnit")} · {d.projectId ? projectById(d.projectId).name : "—"}
      </span>
      {d.checkInAt ? (
        <span className="mt-0.5 block text-xs text-muted">
          {copenhagenTime(d.checkInAt)}
          {d.checkOutAt ? ` → ${copenhagenTime(d.checkOutAt)}` : ` → ${t(lang, "meOpenDay")}`}
        </span>
      ) : null}
      {d.workNote ? <span className="mt-0.5 block text-xs">{d.workNote}</span> : null}
      {d.source === "datalon" ? <Chip tone="sand">Dataløn</Chip> : null}
    </li>
  );
}

function ProfileCard({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee();
  const patchEmployee = useYard((s) => s.patchEmployee);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!emp) return null;

  async function onFile(file: File) {
    setBusy(true);
    setNote(t(lang, "profileBusy"));
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
      r.onerror = () => resolve("");
      r.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    try {
      const res = await uploadProfilePhoto({
        data: {
          name: emp.name,
          fileName: `profil-${emp.name.replace(/\s+/g, "-")}.jpg`,
          mimeType: file.type || "image/jpeg",
          contentBase64: base64,
        },
      });
      if (res.fileId) {
        patchEmployee(emp.id, { profileFileId: res.fileId });
        setNote(t(lang, "profileOk"));
      } else {
        setNote(res.loginRequired ? t(lang, "driveLogin") : t(lang, "profileFail"));
      }
    } catch {
      setNote(t(lang, "profileFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <SectionLabel>{t(lang, "profilePhoto")}</SectionLabel>
      <button
        type="button"
        data-testid="profile-photo"
        disabled={busy}
        className="mt-2 flex items-center gap-3 text-left"
        onClick={() => fileRef.current?.click()}
      >
        <FacePhoto employee={emp} px={96} />
        <span className="text-list leading-[1.4] text-ink">{emp.name}</span>
      </button>
      <p className="mt-2 text-list leading-[1.4] text-ink">{t(lang, "profileHint")}</p>
      {note ? <p className="mt-1 text-list leading-[1.4] text-muted">{note}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-11 rounded-full px-3 text-xs font-medium ${active ? "bg-navy text-sand" : "bg-sand text-ink"}`}>
      {children}
    </button>
  );
}
