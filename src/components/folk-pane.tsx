import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DrivePhoto } from "@/components/drive-photo";
import { PushSetup } from "@/components/push-setup";
import { SlackSetup } from "@/components/slack-setup";
import { KsDoc, PrintChrome } from "@/components/print-docs";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { downloadHours, buildHoursPack } from "@/lib/bot-actions";
import { downloadCsv } from "@/lib/csv";
import { t, roleLabel, LANGS } from "@/lib/i18n";
import { copenhagenDate, copenhagenTime, findControlPoint, hoursWorked, projectById } from "@/lib/seed";
import { hydrateSoftrReport, softrKsPhotos } from "@/lib/softr-ks";
import { todayLog, useYard } from "@/lib/store";
import type { DayLog, Employee, KsPhoto, KsReport, Lang, Role } from "@/lib/types";
import { PersonTodos } from "@/components/todo-board";

export function FolkPane({ lang }: { lang: Lang }) {
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const days = useYard((s) => s.days);
  const fieldItems = useYard((s) => s.fieldItems);
  const ksReports = useYard((s) => s.ksReports);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const addEmployee = useYard((s) => s.addEmployee);
  const setAssignment = useYard((s) => s.setAssignment);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("svend");
  const [open, setOpen] = useState<string | null>(null);
  const used = new Set(employees.map((e) => e.pin));
  const suggest = useMemo(() => {
    for (let i = 1000; i < 9999; i++) {
      const p = String(i);
      if (!used.has(p)) return p;
    }
    return "8888";
  }, [used]);
  const person = employees.find((e) => e.id === open) ?? null;
  const photos = useMemo(
    () => [...softrKsPhotos(), ...drivePhotos, ...Object.values(days).flatMap((d) => d.photos ?? [])],
    [drivePhotos, days],
  );

  function csvHours() {
    const date = copenhagenDate();
    const header = ["Medarbejder", "Dato", "Møde", "Gå", "Timer", "KS", "Sag"];
    const rows = employees.map((e) => {
      const d = todayLog(e.id, days);
      return [e.name, date, d.checkInAt ? copenhagenTime(d.checkInAt) : "", d.checkOutAt ? copenhagenTime(d.checkOutAt) : "", hoursWorked(d).toFixed(2), String(d.photos.length), d.projectId];
    });
    downloadCsv(`timer-${date}.csv`, header, rows);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl text-navy">{t(lang, "peopleTitle")}</h1>
      <p className="text-sm text-muted">{t(lang, "peopleHint")}</p>
      <PushSetup lang={lang} />
      <SlackSetup lang={lang} />
      <Card>
        <SectionLabel>{t(lang, "createEmployee")}</SectionLabel>
        <input className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "employeeName")} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "employeePin")} value={pin} onChange={(e) => setPin(e.target.value.slice(0, 4))} />
        <input className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "peoplePhone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <p className="mt-1 text-xs text-muted">{t(lang, "suggestPin", { pin: suggest })}</p>
        <select className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="svend">{t(lang, "roleSvend")}</option>
          <option value="laerling">{t(lang, "roleLaerling")}</option>
          <option value="mester">{t(lang, "roleMester")}</option>
        </select>
        <PrimaryButton
          className="mt-3"
          onClick={() => {
            if (name && pin.length === 4) {
              addEmployee({ name, pin, role, language: "da", phone: phone.trim() || undefined });
              setName("");
              setPin("");
              setPhone("");
            }
          }}
        >
          {t(lang, "save")}
        </PrimaryButton>
      </Card>
      <GhostButton onClick={csvHours}>{t(lang, "exportHours")}</GhostButton>
      <GhostButton
        onClick={() => {
          const pack = buildHoursPack(days, employees, projects, { employeeName: "Osvaldo" });
          downloadHours(pack);
        }}
      >
        {t(lang, "datalonDownload")}
      </GhostButton>
      <ul className="space-y-2">
        {employees.map((e) => {
          const d = todayLog(e.id, days);
          const pending = fieldItems.filter((f) => f.employeeId === e.id && f.status === "inbox").length;
          const ksN = personKs(ksReports, e).length;
          const hourN = Object.values(days).filter((x) => x.employeeId === e.id && x.checkInAt).length;
          return (
            <li key={e.id}>
              <button type="button" className="flex w-full items-center justify-between rounded-xl bg-paper px-4 py-3 text-left shadow-card" onClick={() => setOpen(e.id)}>
                <span>
                  <span className="font-display text-xl text-navy">{e.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {roleLabel(lang, e.role)} · {hourN} dage · {ksN} KS
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  {pending ? <Chip tone="brick">{t(lang, "fieldCount", { n: pending })}</Chip> : null}
                  <Chip tone={d.checkInAt ? "ok" : "sand"}>{d.checkInAt ? t(lang, "boarded") : t(lang, "notIn")}</Chip>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {person ? (
        <PersonSheet
          emp={person}
          lang={lang}
          days={days}
          ksReports={ksReports}
          photos={photos}
          onClose={() => setOpen(null)}
          onAssign={(projectId, on) => setAssignment(person.id, projectId, on)}
        />
      ) : null}
    </div>
  );
}

function PersonSheet({
  emp,
  lang,
  days,
  ksReports,
  photos,
  onClose,
  onAssign,
}: {
  emp: Employee;
  lang: Lang;
  days: Record<string, DayLog>;
  ksReports: KsReport[];
  photos: KsPhoto[];
  onClose: () => void;
  onAssign: (projectId: string, on: boolean) => void;
}) {
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const [tab, setTab] = useState<"hours" | "ks">("hours");
  const [viewKs, setViewKs] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("all");
  const [job, setJob] = useState("all");
  const [point, setPoint] = useState("all");
  const hourRows = Object.values(days)
    .filter((d) => d.employeeId === emp.id && d.checkInAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  const ksRows = personKs(ksReports, emp).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const months = [...new Set(hourRows.map((d) => d.date.slice(0, 7)))];
  const jobsH = [...new Set(hourRows.map((d) => d.projectId))];
  const jobsK = [...new Set(ksRows.map((r) => r.projectId))];
  const points = [...new Set(ksRows.map((r) => r.point))];
  const needle = q.trim().toLowerCase();
  const shownHours = hourRows.filter((d) => {
    if (month !== "all" && d.date.slice(0, 7) !== month) return false;
    if (job !== "all" && d.projectId !== job) return false;
    if (!needle) return true;
    const jobName = projectById(d.projectId).name;
    return `${d.date} ${jobName} ${d.workNote ?? ""} ${d.photos.length}`.toLowerCase().includes(needle);
  });
  const shownKs = ksRows.filter((r) => {
    const live = hydrateSoftrReport(r);
    if (job !== "all" && live.projectId !== job) return false;
    if (point !== "all" && live.point !== point) return false;
    if (!needle) return true;
    return `${live.number} ${live.point} ${live.location ?? ""} ${live.task ?? ""} ${live.employeeName ?? ""} ${findControlPoint(live.point, live.projectId)?.title ?? ""}`.toLowerCase().includes(needle);
  });
  const hourTotal = shownHours.reduce((n, d) => n + hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now()), 0);
  const ksOpen = viewKs ? ksRows.find((r) => r.id === viewKs) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <GhostButton className="text-sand" onClick={onClose}>
          {t(lang, "backPeople")}
        </GhostButton>
        <p className="font-display text-lg">{emp.name}</p>
        <span className="w-16" />
      </div>
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <Card>
          <p className="text-sm text-muted">
            {roleLabel(lang, emp.role)} · {t(lang, "showPin", { pin: emp.pin })}
          </p>
          <PinEditor emp={emp} lang={lang} />
          <PhoneEditor emp={emp} lang={lang} />
          <SectionLabel>{t(lang, "chooseProject")}</SectionLabel>
          <div className="mt-1 space-y-1">
            {projects
              .filter((p) => p.status === "active")
              .map((p) => {
                const on = assignments.some((a) => a.employeeId === emp.id && a.projectId === p.id);
                return (
                  <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} onChange={(ev) => onAssign(p.id, ev.target.checked)} />
                    {p.name}
                  </label>
                );
              })}
          </div>
        </Card>
        <PersonTodos lang={lang} assigneeId={emp.id} />
        <div className="flex gap-1.5">
          <FilterChip
            active={tab === "hours"}
            onClick={() => {
              setTab("hours");
              setQ("");
              setJob("all");
            }}
          >
            {t(lang, "personHours")} ({hourRows.length})
          </FilterChip>
          <FilterChip
            active={tab === "ks"}
            onClick={() => {
              setTab("ks");
              setQ("");
              setJob("all");
              setPoint("all");
            }}
          >
            {t(lang, "personKs")} ({ksRows.length})
          </FilterChip>
        </div>
        <input
          className="min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card"
          placeholder={tab === "hours" ? t(lang, "searchHours") : t(lang, "searchKs")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {tab === "hours" ? (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              <FilterChip active={month === "all"} onClick={() => setMonth("all")}>
                {t(lang, "filterAll")}
              </FilterChip>
              {months.map((m) => (
                <FilterChip key={m} active={month === m} onClick={() => setMonth(m)}>
                  {m}
                </FilterChip>
              ))}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              <FilterChip active={job === "all"} onClick={() => setJob("all")}>
                {t(lang, "filterAll")}
              </FilterChip>
              {jobsH.map((id) => (
                <FilterChip key={id} active={job === id} onClick={() => setJob(id)}>
                  {projectById(id).name}
                </FilterChip>
              ))}
            </div>
            <p className="text-xs text-muted">
              {t(lang, "datalonDays", { n: shownHours.length })} · {t(lang, "datalonHours", { h: hourTotal.toFixed(1).replace(".", ",") })}
            </p>
            {shownHours.length ? (
              <ul className="space-y-1.5">
                {shownHours.map((d) => (
                  <li key={d.date} className="rounded-xl bg-paper px-3 py-2.5 shadow-card">
                    <p className="text-sm font-medium">{d.date}</p>
                    <p className="text-xs text-muted">
                      {hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now())
                        .toFixed(2)
                        .replace(".", ",")}{" "}
                      t · {projectById(d.projectId).name}
                      {d.photos.length ? ` · ${d.photos.length} KS-foto` : ""}
                    </p>
                    {d.workNote ? <p className="mt-0.5 text-xs">{d.workNote}</p> : null}
                    {d.doubleBooked ? <Chip tone="brick">{t(lang, "datalonDouble")}</Chip> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t(lang, "noHours")}</p>
            )}
          </>
        ) : (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              <FilterChip active={point === "all"} onClick={() => setPoint("all")}>
                {t(lang, "filterAll")}
              </FilterChip>
              {points.map((p) => (
                <FilterChip key={p} active={point === p} onClick={() => setPoint(p)}>
                  {p} {findControlPoint(p)?.title ?? ""}
                </FilterChip>
              ))}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              <FilterChip active={job === "all"} onClick={() => setJob("all")}>
                {t(lang, "filterAll")}
              </FilterChip>
              {jobsK.map((id) => (
                <FilterChip key={id} active={job === id} onClick={() => setJob(id)}>
                  {projectById(id).name}
                </FilterChip>
              ))}
            </div>
            {shownKs.length ? (
              <ul className="space-y-1.5">
                {shownKs.map((row) => {
                  const live = hydrateSoftrReport(row);
                  const thumb = photos.find((p) => live.photoIds?.includes(p.id) || live.photoIds?.includes(p.driveFileId ?? ""));
                  return (
                    <li key={row.id}>
                      <button type="button" className="flex w-full items-center gap-3 rounded-xl bg-paper px-3 py-3 text-left shadow-card" onClick={() => setViewKs(row.id)}>
                        {thumb ? (
                          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                            <DrivePhoto photo={thumb} className="h-14 w-14 object-cover" />
                          </span>
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sand text-xs text-muted">
                            {live.photoIds?.length || "—"}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="font-medium">Nr. {live.number}</span>
                          <span className="mt-0.5 block truncate text-sm text-muted">
                            {live.point} {findControlPoint(live.point, live.projectId)?.title ?? ""}
                            {live.location ? ` · ${live.location}` : ""}
                            {live.photoIds?.length ? ` · ${live.photoIds.length} foto` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t(lang, "noPersonKs")}</p>
            )}
          </>
        )}
      </div>
      {ksOpen ? (
        <PrintChrome docId={ksOpen.id} kind="ks" onClose={() => setViewKs(null)}>
          <KsDoc report={hydrateSoftrReport(ksOpen)} photos={photos} />
        </PrintChrome>
      ) : null}
    </div>
  );
}

function PinEditor({ emp, lang }: { emp: Employee; lang: Lang }) {
  const live = useYard((s) => s.employees.find((e) => e.id === emp.id) ?? emp);
  const patchEmployee = useYard((s) => s.patchEmployee);
  const [pin, setPin] = useState(live.pin);
  useEffect(() => {
    setPin(live.pin);
  }, [live.id, live.pin]);
  const ready = pin.length === 4 && pin !== live.pin;
  return (
    <div className="mt-3" data-testid="pin-editor">
      <p className="text-xs text-muted">{t(lang, "changePin")}</p>
      <div className="mt-1 flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-lg bg-sand px-3 text-sm text-ink"
          value={pin}
          maxLength={4}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <PrimaryButton
          className="w-auto shrink-0 px-4"
          disabled={!ready}
          onClick={() => patchEmployee(live.id, { pin })}
        >
          {t(lang, "save")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function PhoneEditor({ emp, lang }: { emp: Employee; lang: Lang }) {
  const live = useYard((s) => s.employees.find((e) => e.id === emp.id) ?? emp);
  const patchEmployee = useYard((s) => s.patchEmployee);
  const [phone, setPhone] = useState(live.phone ?? "");
  useEffect(() => {
    setPhone(live.phone ?? "");
  }, [live.id, live.phone]);
  const ready = phone.trim() !== (live.phone ?? "");
  return (
    <div className="mt-3" data-testid="phone-editor">
      <p className="text-xs text-muted">{t(lang, "peoplePhone")}</p>
      <div className="mt-1 flex gap-2">
        <input
          inputMode="tel"
          autoComplete="tel"
          className="min-h-11 flex-1 rounded-lg bg-sand px-3 text-sm text-ink"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <PrimaryButton className="w-auto shrink-0 px-4" disabled={!ready} onClick={() => patchEmployee(live.id, { phone: phone.trim() })}>
          {t(lang, "save")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function personKs(reports: KsReport[], emp: Employee) {
  return reports.filter((r) => {
    if (r.trashedAt) return false;
    if (r.employeeId && r.employeeId === emp.id) return true;
    if (r.employeeName && r.employeeName === emp.name) return true;
    if (r.crew?.split(/[,&/]/).some((n) => n.trim() === emp.name)) return true;
    return false;
  });
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

void LANGS;
