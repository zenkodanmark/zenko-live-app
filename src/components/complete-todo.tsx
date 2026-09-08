import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { DriveFileThumb } from "@/components/drive-photo";
import { UserText } from "@/components/user-text";
import { ActionPng, BackArrow, SagPng } from "@/components/sag-icons";
import { GhostButton, PrimaryButton } from "@/components/zenko";
import { transcribeClip } from "@/lib/ai.functions";
import { writeJobNote } from "@/lib/drive.functions";
import { RECEIPTS_FOLDER_NAME } from "@/lib/drive";
import { compressImageFile, kindFromFile } from "@/lib/field-media";
import { t } from "@/lib/i18n";
import { maFolderName } from "@/lib/ma-public";
import { guessFromPhotoNote } from "@/lib/material";
import { gpsPatch, readGpsOrSite, stampPhotoFiles, todoAllPhotoIds } from "@/lib/photo-meta";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { uploadDraftsToFolder, uploadTodoPhotos, fillTodoTranslations } from "@/lib/todo-drive";
import { canMarkTodoDone, isPersonalTodo } from "@/lib/crew-todo";
import { browserListen, startRecording } from "@/lib/voice-client";
import type { Lang, Todo } from "@/lib/types";

type Draft = { id: string; dataUrl: string; name: string };

export function TodoActions({ todo, lang }: { todo: Todo; lang: Lang }) {
  const me = useSessionEmployee();
  const completeTodo = useYard((s) => s.completeTodo);
  const patchTodo = useYard((s) => s.patchTodo);
  const replyTodo = useYard((s) => s.replyTodo);
  const addReceipt = useYard((s) => s.addReceipt);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"levering" | "afhentet">("levering");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const need = Boolean(todo.needsPhoto) && !todo.donePhotoFileIds?.length && !todo.photoFileIds?.length && !drafts.length;

  async function addFiles(list: FileList | null) {
    if (!list?.length || !me) return;
    const job = isPersonalTodo(todo.projectId) ? null : lookupProject(todo.projectId);
    const gps = await readGpsOrSite(job);
    const stamped = await stampPhotoFiles([...list], { who: me.name, job: job?.name ?? t(lang, "todoNoJob"), gps });
    const next = stamped.map((p) => ({ id: `tdp-${crypto.randomUUID().slice(0, 6)}`, dataUrl: p.dataUrl, name: p.name }));
    if (!next.length) return;
    if (isPersonalTodo(todo.projectId) && !todo.orderId) {
      setDrafts((cur) => [...cur, ...next].slice(0, 8));
      return;
    }
    setBusy(true);
    setDrafts((cur) => [...cur, ...next].slice(0, 8));
    try {
      const ids = await uploadDraftsOf(next);
      if (!ids.length) {
        useYard.setState({ toast: t(lang, "driveFail") });
        return;
      }
      const t0 = useYard.getState().todos.find((x) => x.id === todo.id);
      patchTodo(todo.id, { photoFileIds: [...(t0?.photoFileIds ?? []), ...ids] });
      if (!isPersonalTodo(todo.projectId)) {
        void writeJobNote({
          data: {
            projectId: todo.projectId,
            folderName: todo.orderId
              ? `${RECEIPTS_FOLDER_NAME}/${maFolderName(useYard.getState().orders.find((o) => o.id === todo.orderId)?.number ?? "")}`
              : `06 To-do/${todo.id}`,
            name: `todo-${todo.id}-foto.json`,
            text: JSON.stringify({ id: todo.id, photoFileIds: ids, by: me.name, at: new Date().toISOString() }, null, 2),
          },
        });
      }
      setDrafts([]);
    } finally {
      setBusy(false);
    }
  }

  async function uploadDraftsOf(rows: Draft[]) {
    if (!rows.length) return [] as string[];
    if (isPersonalTodo(todo.projectId) && !todo.orderId) {
      return uploadTodoPhotos(todo.projectId || "personlig", todo.id, rows);
    }
    if (todo.orderId) {
      const order = useYard.getState().orders.find((o) => o.id === todo.orderId);
      const folder = order ? `${RECEIPTS_FOLDER_NAME}/${maFolderName(order.number)}` : RECEIPTS_FOLDER_NAME;
      return uploadDraftsToFolder({ projectId: todo.projectId, folderName: folder, drafts: rows });
    }
    return uploadTodoPhotos(todo.projectId, todo.id, rows);
  }

  async function uploadDrafts() {
    return uploadDraftsOf(drafts);
  }

  async function addPhotosOnly() {
    if (!me || !drafts.length) {
      camRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const ids = await uploadDrafts();
      if (ids.length) {
        const t0 = useYard.getState().todos.find((x) => x.id === todo.id);
        patchTodo(todo.id, { photoFileIds: [...(t0?.photoFileIds ?? []), ...ids] });
        if (!isPersonalTodo(todo.projectId)) {
          void writeJobNote({
            data: {
              projectId: todo.projectId,
              folderName: todo.orderId
                ? `${RECEIPTS_FOLDER_NAME}/${maFolderName(useYard.getState().orders.find((o) => o.id === todo.orderId)?.number ?? "")}`
                : `06 To-do/${todo.id}`,
              name: `todo-${todo.id}-foto.json`,
              text: JSON.stringify({ id: todo.id, photoFileIds: ids, by: me.name, at: new Date().toISOString() }, null, 2),
            },
          });
        }
      }
      setDrafts([]);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!me) return;
    if (todo.needsPhoto && !drafts.length && !todo.donePhotoFileIds?.length && !todo.photoFileIds?.length) return;
    setBusy(true);
    try {
      const job = isPersonalTodo(todo.projectId) ? null : lookupProject(todo.projectId);
      const gps = await readGpsOrSite(job);
      const extra = gpsPatch(gps, "create");
      const ids = await uploadDrafts();
      completeTodo(todo.id, me.id, { photoFileIds: ids, ...extra });
      if (todo.orderId) {
        const guessed = guessFromPhotoNote(note);
        const rec = addReceipt({
          orderId: todo.orderId,
          projectId: todo.projectId,
          employeeId: me.id,
          source,
          photoFileIds: ids,
          gpsLabel: extra.gpsLabel,
          lat: extra.lat,
          lng: extra.lng,
          note,
          guessedProduct: guessed.product,
          guessedQty: guessed.qty,
        });
        void writeJobNote({
          data: {
            projectId: todo.projectId,
            folderName: `${RECEIPTS_FOLDER_NAME}/${maFolderName(useYard.getState().orders.find((o) => o.id === todo.orderId)?.number ?? "")}`,
            name: `modtagelse-${rec.id}.json`,
            text: JSON.stringify(
              {
                id: rec.id,
                orderId: todo.orderId,
                source,
                note,
                guessedProduct: guessed.product,
                guessedQty: guessed.qty,
                photoFileIds: ids,
                gpsLabel: extra.gpsLabel,
                doneBy: me.name,
              },
              null,
              2,
            ),
          },
        });
      } else if (!isPersonalTodo(todo.projectId)) {
        void writeJobNote({
          data: {
            projectId: todo.projectId,
            folderName: `06 To-do/${todo.id}`,
            name: `todo-${todo.id}-udfort.json`,
            text: JSON.stringify(
              {
                id: todo.id,
                title: todo.title,
                createdAt: todo.createdAt,
                createdGps: todo.gpsLabel,
                doneAt: new Date().toISOString(),
                doneBy: me.name,
                doneGps: extra.gpsLabel,
                doneLat: extra.lat,
                doneLng: extra.lng,
                donePhotoFileIds: ids,
              },
              null,
              2,
            ),
          },
        });
      }
      setDrafts([]);
    } finally {
      setBusy(false);
    }
  }

  function sendReply() {
    if (!me || !reply.trim()) {
      setReplyOpen(true);
      return;
    }
    replyTodo(todo.id, me.id, reply);
    setReply("");
    setReplyOpen(false);
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted">{todo.needsPhoto ? t(lang, "todoNeedPhoto") : t(lang, "todoAddPhoto")}</p>
      {todo.orderId ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <GhostButton className={source === "levering" ? "bg-navy text-sand" : "bg-sand"} onClick={() => setSource("levering")}>
              {t(lang, "matLevering")}
            </GhostButton>
            <GhostButton className={source === "afhentet" ? "bg-navy text-sand" : "bg-sand"} onClick={() => setSource("afhentet")}>
              {t(lang, "matPickup")}
            </GhostButton>
          </div>
          <input
            className="min-h-11 w-full rounded-xl bg-sand px-3 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(lang, "matPhotoNote")}
          />
        </div>
      ) : null}
      {drafts.length ? (
        <ul className="flex gap-1 overflow-x-auto">
          {drafts.map((d) => (
            <li key={d.id}>
              <img src={d.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {replyOpen ? (
        <div className="space-y-2">
          <textarea
            className="min-h-20 w-full rounded-xl bg-sand px-3 py-2 text-sm"
            placeholder={t(lang, "todoReplyPh")}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <PrimaryButton disabled={!reply.trim()} onClick={sendReply}>
            {t(lang, "todoReplyBtn")}
          </PrimaryButton>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
          <Camera className="mr-1 size-4" />
          {t(lang, "camera")}
        </GhostButton>
        <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
          <ImagePlus className="mr-1 size-4" />
          {t(lang, "gallery")}
        </GhostButton>
      </div>
      <div className="flex flex-wrap gap-2">
        {canMarkTodoDone(todo, me) ? (
          <PrimaryButton disabled={busy || (todo.done ? true : need)} onClick={() => void finish()}>
            {t(lang, "todoDoneMark")}
          </PrimaryButton>
        ) : null}
        <GhostButton className="bg-sand" disabled={busy} onClick={() => void addPhotosOnly()}>
          {t(lang, "todoPhotoBtn")}
        </GhostButton>
        <GhostButton className="bg-sand" onClick={sendReply}>
          {t(lang, "todoReplyBtn")}
        </GhostButton>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
    </div>
  );
}

export function CompleteTodoBar({ todo, lang }: { todo: Todo; lang: Lang }) {
  return <TodoActions todo={todo} lang={lang} />;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

export function CrewTodoOpen({ td, lang, onClose }: { td: Todo; lang: Lang; onClose: () => void }) {
  const me = useSessionEmployee();
  const live = useYard((s) => s.todos.find((x) => x.id === td.id)) ?? td;
  const completeTodo = useYard((s) => s.completeTodo);
  const patchTodo = useYard((s) => s.patchTodo);
  const replyTodo = useYard((s) => s.replyTodo);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [reply, setReply] = useState(live.reply ?? "");
  const [full, setFull] = useState<string | null>(null);
  const photos = todoAllPhotoIds(live);

  useEffect(() => {
    const orig = (live.original ?? live.body ?? live.title).trim();
    if (!orig) return;
    if (live.translations?.[lang]) return;
    void fillTodoTranslations(live.id, orig, live.sourceLang ?? "da");
  }, [live.id, lang]);

  async function uploadFiles(list: File[]) {
    if (!me || !list.length) return;
    setBusy(true);
    try {
      const drafts: Draft[] = [];
      for (const file of list) {
        const kind = kindFromFile(file);
        let dataUrl = "";
        if (kind === "photo") {
          try {
            dataUrl = (await compressImageFile(file)).dataUrl;
          } catch {
            dataUrl = await readAsDataUrl(file);
          }
        } else {
          dataUrl = await readAsDataUrl(file);
        }
        if (dataUrl) drafts.push({ id: `tdp-${crypto.randomUUID().slice(0, 6)}`, dataUrl, name: file.name || `${kind}-${Date.now()}` });
      }
      if (!drafts.length) return;
      let ids: string[] = [];
      if (live.orderId) {
        const order = useYard.getState().orders.find((o) => o.id === live.orderId);
        const folder = order ? `${RECEIPTS_FOLDER_NAME}/${maFolderName(order.number)}` : RECEIPTS_FOLDER_NAME;
        ids = await uploadDraftsToFolder({ projectId: live.projectId, folderName: folder, drafts });
      } else if (!isPersonalTodo(live.projectId)) {
        ids = await uploadTodoPhotos(live.projectId, live.id, drafts);
      }
      if (!ids.length) {
        useYard.setState({ toast: t(lang, "driveFail") });
        return;
      }
      const cur = useYard.getState().todos.find((x) => x.id === live.id);
      patchTodo(live.id, { photoFileIds: [...(cur?.photoFileIds ?? []), ...ids] });
      if (!isPersonalTodo(live.projectId)) {
        void writeJobNote({
          data: {
            projectId: live.projectId,
            folderName: live.orderId
              ? `${RECEIPTS_FOLDER_NAME}/${maFolderName(useYard.getState().orders.find((o) => o.id === live.orderId)?.number ?? "")}`
              : `06 To-do/${live.id}`,
            name: `todo-${live.id}-foto.json`,
            text: JSON.stringify({ id: live.id, photoFileIds: ids, by: me.name, at: new Date().toISOString() }, null, 2),
          },
        });
      }
    } catch {
      useYard.setState({ toast: t(lang, "driveFail") });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!me || !canMarkTodoDone(live, me) || live.done) return;
    if (live.needsPhoto && !todoAllPhotoIds(live).length) {
      camRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const job = isPersonalTodo(live.projectId) ? null : lookupProject(live.projectId);
      const gps = await readGpsOrSite(job);
      completeTodo(live.id, me.id, gpsPatch(gps, "create"));
    } finally {
      setBusy(false);
    }
  }

  function sendReply() {
    if (!me || !reply.trim()) return;
    replyTodo(live.id, me.id, reply);
  }

  async function tapMic() {
    if (busy) return;
    if (rec && recRef.current) {
      setRec(false);
      setBusy(true);
      try {
        const clip = await recRef.current.stop();
        recRef.current = null;
        const stt = await transcribeClip({ data: { audioBase64: clip.base64, mime: clip.mime, language: lang } });
        const spoken = stt.ok ? stt.text : (await browserListen(lang)) || "";
        if (spoken) setReply((n) => (n ? `${n} ${spoken}` : spoken));
      } catch {
        recRef.current = null;
      }
      setBusy(false);
      return;
    }
    try {
      recRef.current = await startRecording();
      setRec(true);
    } catch {
      const spoken = await browserListen(lang);
      if (spoken) setReply((n) => (n ? `${n} ${spoken}` : spoken));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-sand" data-testid="crew-todo-open">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-sand px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackArrow onClick={onClose} label={t(lang, "back")} />
      </div>
      <div className="mx-auto max-w-lg space-y-5 px-4 pb-10">
        <UserText
          original={live.original ?? live.body ?? live.title}
          translations={live.translations}
          lang={lang}
          role={me?.role}
          className="font-sans text-3xl font-semibold leading-snug text-navy"
          linkClass="mt-2 text-sm underline underline-offset-2 text-muted"
        />
        {photos.length ? (
          <ul className="flex flex-wrap gap-2">
            {photos.map((id) => (
              <li key={id}>
                <button type="button" className="block" onClick={() => setFull(id)} aria-label={t(lang, "fieldPhoto")}>
                  <DriveFileThumb fileId={id} className="size-16 rounded-xl object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {canMarkTodoDone(live, me) && !live.done ? (
          <button
            type="button"
            data-testid="crew-todo-done"
            disabled={busy}
            onClick={() => void finish()}
            className="mx-auto flex size-[5.5rem] items-center justify-center rounded-full shadow-card"
            style={{ background: "#c45c3e" }}
            aria-label={t(lang, "todoDoneMark")}
          >
            <SagPng name="todo" px={72} />
          </button>
        ) : live.done ? (
          <p className="text-center text-base font-semibold text-navy">{t(lang, "todoDoneMark")}</p>
        ) : null}
        <div className="flex items-center justify-center gap-2 rounded-[24px] bg-paper px-2 py-2 shadow-card">
          <button type="button" aria-label={t(lang, "fieldPhoto")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" disabled={busy} onClick={() => camRef.current?.click()}>
            <ActionPng name="camCompact" px={64} />
          </button>
          <button type="button" aria-label={t(lang, "gallery")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" disabled={busy} onClick={() => galRef.current?.click()}>
            <ActionPng name="gallery" px={64} />
          </button>
          <button type="button" aria-label={t(lang, "fieldVideo")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" disabled={busy} onClick={() => vidRef.current?.click()}>
            <ActionPng name="video" px={64} />
          </button>
          <button type="button" aria-label={t(lang, "fieldFile")} className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ActionPng name="fileDoc" px={64} />
          </button>
        </div>
        <div className="flex items-stretch gap-2">
          <textarea
            className="min-h-[4.5rem] min-w-0 flex-1 rounded-[20px] bg-paper px-3 py-3 font-sans text-lg shadow-card outline-none"
            placeholder={t(lang, "todoSvarPh")}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onBlur={sendReply}
          />
          <button type="button" aria-label={t(lang, "fieldSpeak")} data-testid="crew-todo-mic" className={`inline-flex min-h-[3.25rem] min-w-[3.25rem] shrink-0 items-center justify-center ${rec ? "rounded-xl ring-2 ring-brick" : ""}`} onClick={() => void tapMic()}>
            <ActionPng name="mic" px={64} />
          </button>
        </div>
        {live.reply ? <p className="text-base text-ink">{live.reply}</p> : null}
        <input ref={camRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { void uploadFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={galRef} type="file" accept="image/*,image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => { void uploadFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { void uploadFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { void uploadFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {full ? (
        <button type="button" className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/80 p-4" onClick={() => setFull(null)}>
          <DriveFileThumb fileId={full} className="max-h-[90dvh] max-w-full rounded-[20px] object-contain" />
        </button>
      ) : null}
    </div>
  );
}
