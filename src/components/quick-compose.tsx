import { useRef, useState } from "react";
import { Card, PrimaryButton } from "@/components/zenko";
import { ActionPng, CloseX } from "@/components/sag-icons";
import { peekReportNumber } from "@/lib/drive-commit";
import { t } from "@/lib/i18n";
import { siteFallback } from "@/lib/geo";
import { gpsPatch, stampPhotoFiles } from "@/lib/photo-meta";
import { copenhagenDate } from "@/lib/seed";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { fillTodoTranslations, uploadDraftsToFolder, uploadTodoPhotos } from "@/lib/todo-drive";
import { isPersonalTodo } from "@/lib/crew-todo";
import type { Lang, LedelseStatus } from "@/lib/types";

export type ComposeKind = "todo" | "ks" | "tf" | "as" | "tb" | "er";

type Draft = { id: string; dataUrl: string; name: string };

function timed<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    void p.then((v) => {
      window.clearTimeout(timer);
      resolve(v);
    }).catch(() => {
      window.clearTimeout(timer);
      resolve(fallback);
    });
  });
}

export function QuickCompose({
  kind,
  projectId,
  lang,
  onClose,
  onCreated,
  allowNoJob,
  assigneeId,
  fromId,
  ledelseStatus,
  lockAssignee,
}: {
  kind: ComposeKind;
  projectId: string;
  lang: Lang;
  onClose: () => void;
  onCreated?: (id: string) => void;
  allowNoJob?: boolean;
  assigneeId?: string;
  fromId?: string;
  ledelseStatus?: LedelseStatus;
  lockAssignee?: boolean;
}) {
  const me = useSessionEmployee();
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const addTodo = useYard((s) => s.addTodo);
  const addKsReport = useYard((s) => s.addKsReport);
  const addTf = useYard((s) => s.addTf);
  const addSlip = useYard((s) => s.addSlip);
  const addOffer = useYard((s) => s.addOffer);
  const addEnt = useYard((s) => s.addEnt);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(assigneeId ? [assigneeId] : me?.id ? [me.id] : []);
  const [sagId, setSagId] = useState(projectId);
  const [due, setDue] = useState(copenhagenDate());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function addFiles(list: FileList | null, asFile = false) {
    if (!list?.length) return;
    if (asFile) {
      const next: Draft[] = [];
      for (const f of [...list]) {
        const dataUrl = await readDraft(f);
        if (dataUrl) next.push({ id: `qc-${crypto.randomUUID().slice(0, 8)}`, dataUrl, name: f.name || "fil" });
      }
      setDrafts((cur) => [...cur, ...next].slice(0, 8));
      return;
    }
    if (!me) {
      const next: Draft[] = [];
      for (const f of [...list]) {
        const dataUrl = await readDraft(f);
        if (dataUrl) next.push({ id: `qc-${crypto.randomUUID().slice(0, 8)}`, dataUrl, name: f.name || "foto" });
      }
      setDrafts((cur) => [...cur, ...next].slice(0, 8));
      return;
    }
    const job = sagId && !isPersonalTodo(sagId) ? lookupProject(sagId) : null;
    const gps = job ? siteFallback(job) : null;
    const stamped = await stampPhotoFiles([...list], { who: me.name, job: job?.name ?? t(lang, "todoNoJob"), gps });
    const next = stamped.map((p) => ({ id: `qc-${crypto.randomUUID().slice(0, 8)}`, dataUrl: p.dataUrl, name: p.name }));
    setDrafts((cur) => [...cur, ...next].slice(0, 8));
  }

  async function save() {
    if (busy) return;
    if (!title.trim() && !body.trim() && !drafts.length) {
      setErr(t(lang, "composeNeedOne"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const heading = title.trim() || body.trim().slice(0, 80) || t(lang, "chatPhotoOnly");
      const text = body.trim() || heading;
      const job = sagId && !isPersonalTodo(sagId) ? lookupProject(sagId) : null;
      const gps = job ? siteFallback(job) : null;
      let id = "";
      if (kind === "todo") {
        const ids = assigneeIds.length ? assigneeIds : [me?.id || "emp-ole"];
        const created = gpsPatch(gps, "create");
        const todoId = `td-${crypto.randomUUID().slice(0, 6)}`;
        let photoFileIds: string[] = [];
        if (drafts.length) {
          photoFileIds = await timed(
            uploadTodoPhotos(sagId || "personlig", todoId, drafts),
            12000,
            [],
          );
        }
        id = addTodo({
          id: todoId,
          projectId: sagId,
          assigneeId: ids[0]!,
          assigneeIds: ids,
          title: heading,
          body: text,
          due,
          photoFileIds,
          needsPhoto: false,
          lat: created.lat,
          lng: created.lng,
          gpsLabel: created.gpsLabel,
          original: text,
          sourceLang: lang,
          fromId: fromId ?? me?.id,
          ledelseStatus,
        }).id;
        void fillTodoTranslations(id, text, lang);
      } else {
        if (!sagId) {
          setErr(t(lang, "matPickJobNeed"));
          return;
        }
        const serial = useYard.getState().serial;
        const number =
          kind === "ks" ? peekReportNumber("ks", serial)
          : kind === "tf" ? peekReportNumber("tf", serial)
          : kind === "as" ? peekReportNumber("as", serial)
          : kind === "tb" ? peekReportNumber("tb", serial)
          : peekReportNumber("er", serial);
        let photoFileIds: string[] = [];
        if (drafts.length) {
          photoFileIds = await timed(
            uploadDraftsToFolder({ projectId: sagId, folderName: kind, drafts }),
            12000,
            [],
          );
        }
        if (kind === "ks") {
          id = addKsReport(sagId, "div", { deviations: text, task: heading, photoIds: photoFileIds, number }).id;
        } else if (kind === "tf") {
          id = addTf({ projectId: sagId, question: text, title: heading, photoIds: photoFileIds, number }).id;
        } else if (kind === "as") {
          id = addSlip({
            projectId: sagId,
            title: heading,
            location: "",
            body: text,
            masterSolution: text,
            customerPrice: "",
            hoursEst: 0,
            materialsEst: "",
            photoIds: photoFileIds,
            number,
          }).id;
        } else if (kind === "tb") {
          id = addOffer({
            projectId: sagId,
            title: heading,
            location: "",
            body: text,
            masterSolution: text,
            customerPrice: "",
            hoursEst: 0,
            materialsEst: "",
            photoIds: photoFileIds,
            number,
          }).id;
        } else {
          id = addEnt({ projectId: sagId, title: heading, location: "", body: text, noteHe: text, photoIds: photoFileIds, number }).id;
        }
      }
      onCreated?.(id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error && !/invariant/i.test(e.message) ? e.message : t(lang, "saveFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="todo-compose">
    <Card className="rounded-[20px]">
      <div className="mb-2 flex items-center gap-2">
        <p className="font-display text-title text-ink">
          {kind === "todo" ? t(lang, "rowTodo") : kind === "ks" ? t(lang, "rowKs") : kind === "tf" ? t(lang, "rowTf") : kind === "as" ? t(lang, "rowAs") : kind === "tb" ? t(lang, "rowTb") : t(lang, "rowEr")}
        </p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "chooseProject")}
        <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={sagId} onChange={(e) => setSagId(e.target.value)}>
          {allowNoJob && kind === "todo" ? <option value="">{t(lang, "todoNoJob")}</option> : null}
          {projects
            .filter((p) => p.status === "active" || p.id === sagId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      {kind === "todo" && !lockAssignee ? (
        <div className="mt-2">
          <p className="text-xs text-muted">{t(lang, "todoAssignees")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {employees.map((e) => {
              const on = assigneeIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    setAssigneeIds((cur) => (cur.includes(e.id) ? cur.filter((id) => id !== e.id) : [...cur, e.id]))
                  }
                  className={`min-h-10 rounded-full px-3 text-xs font-medium ${on ? "bg-navy text-sand" : "bg-sand text-ink"}`}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <input className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "composeTitle")} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="compose-title" />
      <textarea className="mt-2 min-h-24 w-full rounded-lg bg-sand px-3 py-2 text-sm" placeholder={t(lang, "composeBody")} value={body} onChange={(e) => setBody(e.target.value)} data-testid="compose-body" />
      {kind === "todo" ? (
        <label className="mt-2 block text-xs text-muted">
          {t(lang, "due")}
          <input type="date" className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      ) : null}
      {drafts.length ? (
        <ul className="mt-2 flex gap-1 overflow-x-auto">
          {drafts.map((d) => (
            <li key={d.id}>
              {d.dataUrl.startsWith("data:image") ? (
                <img src={d.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-lg bg-sand px-1 text-center text-[10px] text-navy">
                  {d.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-[24px] bg-sand px-2 py-2">
        <button type="button" aria-label={t(lang, "camera")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid="compose-cam" onClick={() => camRef.current?.click()}>
          <ActionPng name="camCompact" px={56} />
        </button>
        <button type="button" aria-label={t(lang, "gallery")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid="compose-gal" onClick={() => galRef.current?.click()}>
          <ActionPng name="gallery" px={56} />
        </button>
        <button type="button" aria-label="Fil" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid="compose-file" onClick={() => fileRef.current?.click()}>
          <ActionPng name="fileDoc" px={56} />
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
      <input ref={fileRef} type="file" className="hidden" multiple onChange={(e) => void addFiles(e.target.files, true)} />
      {err ? <p className="mt-2 text-sm text-brick">{err}</p> : null}
      <p className="mt-2 text-xs text-muted">{t(lang, "composeOr")}</p>
      <div className="sticky bottom-0 z-10 mt-3 bg-paper pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <PrimaryButton disabled={busy} onClick={() => void save()} data-testid="todo-save">
          {busy ? t(lang, "saving") : t(lang, "save")}
        </PrimaryButton>
      </div>
    </Card>
    </div>
  );
}

function readDraft(file: File) {
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => resolve("");
    r.readAsDataURL(file);
  });
}
