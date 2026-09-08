import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Card, GhostButton, PrimaryButton } from "@/components/zenko";
import { CloseX } from "@/components/sag-icons";
import { writeJobNote } from "@/lib/drive.functions";
import { todoDriveFolder } from "@/lib/drive";
import { peekReportNumber, reportDriveFolder } from "@/lib/drive-commit";
import { t } from "@/lib/i18n";
import { connectorUserText } from "@/lib/connector-msg";
import { siteFallback } from "@/lib/geo";
import { gpsPatch, stampPhotoFiles } from "@/lib/photo-meta";
import { copenhagenDate } from "@/lib/seed";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { fillTodoTranslations, uploadTodoPhotos } from "@/lib/todo-drive";
import { uploadVoicePhoto } from "@/lib/voice-agent.functions";
import { splitDataUrl } from "@/lib/voice-agent";
import { isPersonalTodo } from "@/lib/crew-todo";
import type { Lang } from "@/lib/types";

export type ComposeKind = "todo" | "ks" | "tf" | "as" | "er";

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
}: {
  kind: ComposeKind;
  projectId: string;
  lang: Lang;
  onClose: () => void;
  onCreated?: (id: string) => void;
  allowNoJob?: boolean;
  assigneeId?: string;
}) {
  const me = useSessionEmployee();
  const employees = useYard((s) => s.employees);
  const projects = useYard((s) => s.projects);
  const addTodo = useYard((s) => s.addTodo);
  const addKsReport = useYard((s) => s.addKsReport);
  const addTf = useYard((s) => s.addTf);
  const addSlip = useYard((s) => s.addSlip);
  const addEnt = useYard((s) => s.addEnt);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(assigneeId ? [assigneeId] : me?.id ? [me.id] : []);
  const [sagId, setSagId] = useState(projectId);
  const [due, setDue] = useState(copenhagenDate());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function addFiles(list: FileList | null) {
    if (!list?.length || !me) return;
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
        if (sagId && !isPersonalTodo(sagId) && drafts.length) {
          photoFileIds = await timed(
            uploadTodoPhotos(sagId, todoId, drafts),
            12000,
            [],
          );
          if (photoFileIds.length < drafts.length) {
            setErr(t(lang, "driveFail"));
            return;
          }
        }
        if (sagId && !isPersonalTodo(sagId)) {
          const note = await timed(
            writeJobNote({
              data: {
                projectId: sagId,
                projectName: job?.name,
                folderName: todoDriveFolder(todoId),
                name: `todo-${todoId}.json`,
                text: JSON.stringify({ id: todoId, title: heading, createdAt: new Date().toISOString(), by: me?.name, gps: created, photoFileIds }, null, 2),
              },
            }),
            12000,
            { ok: false as const, fileId: "", error: t(lang, "driveFail") },
          );
          if (!note.ok) {
            setErr(connectorUserText(lang, note.error, "loginRequired" in note ? Boolean(note.loginRequired) : false));
            return;
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
            driveFileId: note.fileId,
          }).id;
        } else {
          id = addTodo({
            id: todoId,
            projectId: sagId,
            assigneeId: ids[0]!,
            assigneeIds: ids,
            title: heading,
            body: text,
            due,
            photoFileIds: [],
            needsPhoto: false,
            lat: created.lat,
            lng: created.lng,
            gpsLabel: created.gpsLabel,
            original: text,
            sourceLang: lang,
          }).id;
        }
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
          : peekReportNumber("er", serial);
        const folderName =
          kind === "ks" ? reportDriveFolder("ks", number, "div")
          : kind === "tf" ? reportDriveFolder("tf", number)
          : kind === "as" ? reportDriveFolder("as", number)
          : reportDriveFolder("er", number);
        const photoFileIds: string[] = [];
        for (const d of drafts) {
          const split = splitDataUrl(d.dataUrl);
          if (!split.base64) continue;
          const up = await uploadVoicePhoto({
            data: {
              projectId: sagId,
              projectName: job?.name,
              name: d.name,
              mimeType: split.mime,
              contentBase64: split.base64,
              folderName,
            },
          });
          if (up.fileId) photoFileIds.push(up.fileId);
        }
        if (drafts.length && photoFileIds.length < drafts.length) {
          setErr(t(lang, "driveFail"));
          return;
        }
        const note = await timed(
          writeJobNote({
            data: {
              projectId: sagId,
              projectName: job?.name,
              folderName,
              name: `${number}.json`,
              text: JSON.stringify({
                number,
                kind,
                title: heading,
                body: text,
                createdAt: new Date().toISOString(),
                by: me?.name,
                photoFileIds,
              }, null, 2),
            },
          }),
          12000,
          { ok: false as const, fileId: "", error: t(lang, "driveFail") },
        );
        if (!note.ok) {
          setErr(connectorUserText(lang, note.error, "loginRequired" in note ? Boolean(note.loginRequired) : false));
          return;
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
        } else {
          id = addEnt({ projectId: sagId, title: heading, location: "", body: text, noteHe: text, photoIds: photoFileIds, number }).id;
        }
      }
      onCreated?.(id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, "driveFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <div className="mb-2 flex items-center gap-2">
        <p className="font-display text-title text-ink">
          {kind === "todo" ? t(lang, "rowTodo") : kind === "ks" ? t(lang, "rowKs") : kind === "tf" ? t(lang, "rowTf") : kind === "as" ? t(lang, "rowAs") : t(lang, "rowEr")}
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
      {kind === "todo" ? (
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
      <input className="mt-2 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "composeTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="mt-2 min-h-24 w-full rounded-lg bg-sand px-3 py-2 text-sm" placeholder={t(lang, "composeBody")} value={body} onChange={(e) => setBody(e.target.value)} />
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
              <img src={d.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
          <Camera className="mr-1 size-4" />
          {t(lang, "camera")}
        </GhostButton>
        <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
          <ImagePlus className="mr-1 size-4" />
          {t(lang, "gallery")}
        </GhostButton>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
      {err ? <p className="mt-2 text-sm text-brick">{err}</p> : null}
      <p className="mt-2 text-xs text-muted">{t(lang, "composeOr")}</p>
      <div className="sticky bottom-0 z-10 mt-3 bg-paper pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          {busy ? t(lang, "saving") : t(lang, "save")}
        </PrimaryButton>
      </div>
    </Card>
  );
}
