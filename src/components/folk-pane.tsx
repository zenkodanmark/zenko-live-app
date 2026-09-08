import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DriveFileThumb } from "@/components/drive-photo";
import { PinEditor } from "@/components/pin-editor";
import { QuickCompose } from "@/components/quick-compose";
import { CloseX, PlusRound, SagPng } from "@/components/sag-icons";
import { OpenTodosSheet } from "@/components/todo-board";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { downloadHours, buildHoursPack } from "@/lib/bot-actions";
import { downloadCsv } from "@/lib/csv";
import { t, roleLabel } from "@/lib/i18n";
import { pladsPath, uploadPladsBytes } from "@/lib/plads-file";
import { copenhagenDate, copenhagenTime, hoursWorked, projectById } from "@/lib/seed";
import { todayLog, useYard } from "@/lib/store";
import { todoAssignedTo } from "@/lib/todo-people";
import type { DayLog, Employee, KsPhoto, Lang, Role } from "@/lib/types";

const FOLK_ADD = "/icons/folk/add.png";
const FOLK_PERSON = "/icons/folk/person.png";
const FOLK_TIME = "/icons/folk/time.png";

export function FolkPane({ lang }: { lang: Lang }) {
  const employees = useYard((s) => s.employees);
  const addEmployee = useYard((s) => s.addEmployee);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("svend");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const used = new Set(employees.map((e) => e.pin));
  const suggest = useMemo(() => {
    for (let i = 1000; i < 9999; i++) {
      const p = String(i);
      if (!used.has(p)) return p;
    }
    return "8888";
  }, [used]);
  const person = employees.find((e) => e.id === open) ?? null;

  function saveNew() {
    if (!name.trim() || pin.length !== 4) return;
    const id = addEmployee({ name: name.trim(), pin, role, language: "da", phone: phone.trim() || undefined });
    if (!id) {
      setNote(t(lang, "pinTaken"));
      return;
    }
    setName("");
    setPin("");
    setPhone("");
    setRole("svend");
    setNote("");
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-navy">{t(lang, "peopleTitle")}</h1>
        <button
          type="button"
          data-testid="folk-add"
          aria-label={t(lang, "createEmployee")}
          className="inline-flex shrink-0 items-center justify-center"
          onClick={() => {
            setNote("");
            if (!pin) setPin(suggest);
            setCreating(true);
          }}
        >
          <img src={FOLK_ADD} alt="" width={88} height={88} className="max-w-none shrink-0 object-contain" draggable={false} />
        </button>
      </div>
      <ul className="space-y-2">
        {employees.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              data-testid={`folk-person-${e.id}`}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-left shadow-card"
              onClick={() => setOpen(e.id)}
            >
              <FolkFace emp={e} px={56} />
              <span className="min-w-0 font-display text-title font-semibold text-ink">{e.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {creating ? (
        <Sheet title={t(lang, "createEmployee")} onClose={() => setCreating(false)}>
          <input
            className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm"
            placeholder={t(lang, "employeeName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm tracking-[0.4em]"
            placeholder={t(lang, "employeePin")}
            value={pin}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <input
            className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm"
            placeholder={t(lang, "peoplePhone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
          <p className="mt-1 text-xs text-muted">{t(lang, "suggestPin", { pin: suggest })}</p>
          <select className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="svend">{t(lang, "roleSvend")}</option>
            <option value="laerling">{t(lang, "roleLaerling")}</option>
            <option value="mester">{t(lang, "roleMester")}</option>
          </select>
          {note ? <p className="mt-2 text-sm text-brick">{note}</p> : null}
          <PrimaryButton className="mt-3" data-testid="folk-create-save" onClick={saveNew}>
            {t(lang, "save")}
          </PrimaryButton>
        </Sheet>
      ) : null}
      {person ? <PersonHome emp={person} lang={lang} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function PersonHome({ emp, lang, onClose }: { emp: Employee; lang: Lang; onClose: () => void }) {
  const todos = useYard((s) => s.todos);
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const [view, setView] = useState<"home" | "todos" | "compose" | "time" | "hours">("home");
  const openN = todos.filter((x) => todoAssignedTo(x, emp.id) && !x.done).length;
  const jobs = projects.filter((p) => p.status === "active");
  const assigned = jobs.find((p) => assignments.some((a) => a.employeeId === emp.id && a.projectId === p.id));
  const composeJob = assigned?.id ?? jobs[0]?.id ?? "";

  if (view === "todos") return <OpenTodosSheet lang={lang} assigneeId={emp.id} onClose={() => setView("home")} />;
  if (view === "time") return <TimeSheet emp={emp} lang={lang} onClose={() => setView("home")} />;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <GhostButton className="text-sand" onClick={onClose}>
          {t(lang, "backPeople")}
        </GhostButton>
        <p className="font-display text-lg">{emp.name}</p>
        <span className="w-16" />
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 shadow-card">
          <button
            type="button"
            data-testid="folk-todo-bar"
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setView("todos")}
          >
            <SagPng name="todo" px={56} />
            <span className="font-display text-title font-semibold text-ink">{t(lang, "rowTodo")}</span>
            <Chip tone={openN ? "brick" : "sand"}>{openN}</Chip>
          </button>
          <PlusRound
            label={t(lang, "todoCreate")}
            testId="folk-todo-plus"
            px={48}
            onClick={() => setView("compose")}
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 shadow-card">
          <button
            type="button"
            data-testid="folk-time-bar"
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setView("time")}
          >
            <img src={FOLK_TIME} alt="" width={56} height={56} className="max-w-none shrink-0 object-contain" draggable={false} />
            <span className="font-display text-title font-semibold text-ink">{t(lang, "personHours")}</span>
          </button>
          <PlusRound
            label={t(lang, "addHours")}
            testId="folk-time-plus"
            px={48}
            onClick={() => setView("hours")}
          />
        </div>
      </div>
      {view === "compose" ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <QuickCompose
            kind="todo"
            projectId={composeJob}
            lang={lang}
            allowNoJob
            assigneeId={emp.id}
            onClose={() => setView("home")}
            onCreated={() => setView("home")}
          />
        </div>
      ) : null}
      {view === "hours" ? <AddHoursSheet emp={emp} lang={lang} onClose={() => setView("home")} /> : null}
    </div>
  );
}

function TimeSheet({ emp, lang, onClose }: { emp: Employee; lang: Lang; onClose: () => void }) {
  const days = useYard((s) => s.days);
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const [job, setJob] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const hourRows = Object.values(days)
    .filter((d) => d.employeeId === emp.id && d.checkInAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  const jobsH = [...new Set(hourRows.map((d) => d.projectId).filter(Boolean))];
  const shownHours = hourRows.filter((d) => {
    if (from && d.date < from) return false;
    if (to && d.date > to) return false;
    if (job !== "all" && d.projectId !== job) return false;
    return true;
  });
  const hourTotal = shownHours.reduce((n, d) => n + hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now()), 0);

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
          <FolkProfile emp={emp} lang={lang} />
          <p className="mt-3 font-display text-title text-ink">{emp.name}</p>
          <p className="text-sm text-muted">{roleLabel(lang, emp.role)}</p>
          <PinEditor emp={emp} lang={lang} />
          <PhoneEditor emp={emp} lang={lang} />
        </Card>
        <FolkAssign emp={emp} lang={lang} />
        <Card>
          <SectionLabel>{t(lang, "personHours")}</SectionLabel>
          <label className="mt-2 block text-xs text-muted">
            {t(lang, "chooseProject")}
            <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="all">{t(lang, "filterAll")}</option>
              {jobsH.map((id) => (
                <option key={id} value={id}>
                  {projectById(id).name}
                </option>
              ))}
              {projects
                .filter((p) => p.status === "active" && !jobsH.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="mt-2 block text-xs text-muted">
            {t(lang, "hoursFrom")}
            <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="mt-2 block text-xs text-muted">
            {t(lang, "hoursTo")}
            <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
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
        <p className="text-xs text-muted">
          {t(lang, "datalonDays", { n: shownHours.length })} · {t(lang, "datalonHours", { h: hourTotal.toFixed(1).replace(".", ",") })}
        </p>
        {shownHours.length ? (
          <ul className="space-y-1.5">
            {shownHours.map((d) => (
              <HourRow key={`${d.employeeId}:${d.date}`} d={d} lang={lang} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t(lang, "noHours")}</p>
        )}
      </div>
    </div>
  );
}

function HourRow({ d, lang }: { d: DayLog; lang: Lang }) {
  const end = d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now();
  return (
    <li className="rounded-xl bg-paper px-3 py-2.5 shadow-card">
      <p className="text-sm font-medium">{d.date}</p>
      <p className="text-xs text-muted">
        {hoursWorked(d, end).toFixed(2).replace(".", ",")} t · {projectById(d.projectId).name}
        {d.checkInAt ? ` · ${copenhagenTime(d.checkInAt)}` : ""}
        {d.checkOutAt ? `–${copenhagenTime(d.checkOutAt)}` : ""}
        {d.photos.length ? ` · ${d.photos.length} KS-foto` : ""}
      </p>
      {d.workNote ? <p className="mt-0.5 text-xs">{d.workNote}</p> : null}
      {d.doubleBooked ? <Chip tone="brick">{t(lang, "datalonDouble")}</Chip> : null}
    </li>
  );
}

function FolkProfile({ emp, lang }: { emp: Employee; lang: Lang }) {
  const live = useYard((s) => s.employees.find((e) => e.id === emp.id) ?? emp);
  const patchEmployee = useYard((s) => s.patchEmployee);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

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
      const name = `profil-${live.name.replace(/\s+/g, "-")}.jpg`;
      const res = await uploadPladsBytes({
        path: pladsPath("profiler", live.id, name),
        contentBase64: base64,
        mimeType: file.type || "image/jpeg",
        kind: "profile",
        name,
      });
      if (res.fileId) {
        patchEmployee(live.id, { profileFileId: res.fileId });
        setNote(t(lang, "profileOk"));
      } else {
        setNote(t(lang, "profileFail"));
      }
    } catch {
      setNote(t(lang, "profileFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionLabel>{t(lang, "profilePhoto")}</SectionLabel>
      <button
        type="button"
        data-testid="folk-profile-photo"
        disabled={busy}
        className="mt-2 flex min-h-14 items-center gap-3 text-left"
        onClick={() => fileRef.current?.click()}
      >
        <FolkFace emp={live} px={72} />
        <span className="text-list leading-[1.4] text-ink">{live.name}</span>
      </button>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
    </div>
  );
}

function FolkAssign({ emp, lang }: { emp: Employee; lang: Lang }) {
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const setAssignment = useYard((s) => s.setAssignment);
  return (
    <Card>
      <SectionLabel>{t(lang, "folkAssign")}</SectionLabel>
      <div className="mt-1 space-y-1">
        {projects
          .filter((p) => p.status === "active")
          .map((p) => {
            const on = assignments.some((a) => a.employeeId === emp.id && a.projectId === p.id);
            return (
              <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={on} onChange={(ev) => setAssignment(emp.id, p.id, ev.target.checked)} />
                {p.name}
              </label>
            );
          })}
      </div>
    </Card>
  );
}

function AddHoursSheet({ emp, lang, onClose }: { emp: Employee; lang: Lang; onClose: () => void }) {
  const projects = useYard((s) => s.projects);
  const assignments = useYard((s) => s.assignments);
  const logHours = useYard((s) => s.logHours);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const assigned = projects.filter((p) => p.status === "active" && assignments.some((a) => a.employeeId === emp.id && a.projectId === p.id));
  const jobs = assigned.length ? assigned : projects.filter((p) => p.status === "active");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [date, setDate] = useState(copenhagenDate());
  const [inn, setInn] = useState("07:00");
  const [out, setOut] = useState("15:00");
  const [drafts, setDrafts] = useState<{ id: string; dataUrl: string; name: string }[]>([]);
  const [err, setErr] = useState("");

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const extra: { id: string; dataUrl: string; name: string }[] = [];
    let left = list.length;
    for (const file of [...list].slice(0, 8)) {
      const r = new FileReader();
      r.onload = () => {
        extra.push({
          id: `hr-${crypto.randomUUID().slice(0, 6)}`,
          dataUrl: typeof r.result === "string" ? r.result : "",
          name: file.name,
        });
        left -= 1;
        if (left <= 0) setDrafts((cur) => [...cur, ...extra].slice(0, 8));
      };
      r.onerror = () => {
        left -= 1;
        if (left <= 0) setDrafts((cur) => [...cur, ...extra].slice(0, 8));
      };
      r.readAsDataURL(file);
    }
  }

  function save() {
    if (!jobId || !date || !inn || !out) {
      setErr(t(lang, "hoursNeed"));
      return;
    }
    const checkInAt = cphIso(date, inn);
    const checkOutAt = cphIso(date, out);
    if (!checkInAt || !checkOutAt || checkOutAt <= checkInAt) {
      setErr(t(lang, "hoursNeed"));
      return;
    }
    const job = projectById(jobId);
    const photos: KsPhoto[] = drafts
      .filter((d) => d.dataUrl)
      .map((d) => ({
        id: d.id,
        dataUrl: d.dataUrl,
        takenAt: checkInAt,
        floor: "",
        room: "",
        point: "div",
        projectId: jobId,
        projectName: job.name,
        employeeId: emp.id,
        employeeName: emp.name,
        originalName: d.name,
        gpsSource: "unknown" as const,
        lat: null,
        lng: null,
      }));
    logHours({ employeeId: emp.id, projectId: jobId, date, checkInAt, checkOutAt, photos });
    onClose();
  }

  return (
    <Sheet title={t(lang, "addHours")} onClose={onClose}>
      <p className="text-sm text-muted">{emp.name}</p>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "chooseProject")}
        <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {jobs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "personHours")}
        <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted">
          {t(lang, "hoursIn")}
          <input type="time" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={inn} onChange={(e) => setInn(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          {t(lang, "hoursOut")}
          <input type="time" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={out} onChange={(e) => setOut(e.target.value)} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted">{t(lang, "hoursPhotos")}</p>
      {drafts.length ? (
        <ul className="mt-2 flex gap-1 overflow-x-auto">
          {drafts.map((d) => (
            <li key={d.id}>
              <img src={d.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
          {t(lang, "camera")}
        </GhostButton>
        <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
          {t(lang, "gallery")}
        </GhostButton>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => addFiles(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => addFiles(e.target.files)} />
      {err ? <p className="mt-2 text-sm text-brick">{err}</p> : null}
      <PrimaryButton className="mt-3" data-testid="folk-hours-save" onClick={save}>
        {t(lang, "save")}
      </PrimaryButton>
    </Sheet>
  );
}

function FolkFace({ emp, px = 56 }: { emp: Employee; px?: number }) {
  if (emp.profileFileId) {
    return (
      <span className="inline-flex shrink-0 overflow-hidden rounded-xl bg-paper ring-2 ring-navy" style={{ width: px, height: px }}>
        <DriveFileThumb fileId={emp.profileFileId} className="size-full object-cover" />
      </span>
    );
  }
  return <img src={FOLK_PERSON} alt="" width={px} height={px} className="max-w-none shrink-0 object-contain" draggable={false} />;
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

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-lg">{title}</p>
        <CloseX onClick={onClose} />
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">{children}</div>
    </div>
  );
}

function cphIso(date: string, hm: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m || !t) return "";
  const noon = new Date(`${date}T12:00:00Z`);
  const cphHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(noon),
  );
  const offsetH = cphHour - 12;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]) - offsetH, Number(t[2]), 0)).toISOString();
}
