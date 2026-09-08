import { useMemo, useRef, useState } from "react";
import { Camera, FileUp, Film, ImagePlus, Mic, Send, Square, Volume2 } from "lucide-react";
import { DriveFileThumb } from "@/components/drive-photo";
import { GpsLink } from "@/components/photo-strip";
import { UserText } from "@/components/user-text";
import { BackArrow } from "@/components/sag-icons";
import { Card, Chip, GhostButton, SectionLabel } from "@/components/zenko";
import { speakTranslation, transcribeClip, translateMessage } from "@/lib/ai.functions";
import { chatTargetLabel, chatVisible, goesToMaster, shownText, targetEmployeeIds } from "@/lib/chat";
import { chatDriveFolder, todoDriveFolder } from "@/lib/drive";
import { ensureAdminLog, appendChatLog, placeFieldInSlot, writeJobNote } from "@/lib/drive.functions";
import { kindFromFile, videoPoster } from "@/lib/field-media";
import { t } from "@/lib/i18n";
import { gpsPatch, readGpsOrSite, stampPhotoFiles } from "@/lib/photo-meta";
import { printDoc } from "@/lib/print";
import { copenhagenDate, copenhagenTime, isMasterRole } from "@/lib/seed";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import type { ChatFile, ChatMessage, ChatTarget, Employee, InboxClass, Lang } from "@/lib/types";
import { browserListen, localSpeak, startRecording } from "@/lib/voice-client";
import { uploadVoicePhoto } from "@/lib/voice-agent.functions";
import { splitDataUrl } from "@/lib/voice-agent";

type DraftPhoto = { id: string; dataUrl: string; name: string; driveFileId?: string; lat?: number | null; lng?: number | null; gpsLabel?: string; at?: string };

export function ChatPane({ lang, projectId }: { lang: Lang; projectId: string }) {
  const emp = useSessionEmployee();
  const employees = useYard((s) => s.employees);
  const assignments = useYard((s) => s.assignments);
  const chats = useYard((s) => s.chats);
  const addChat = useYard((s) => s.addChat);
  const patchChat = useYard((s) => s.patchChat);
  const addTodo = useYard((s) => s.addTodo);
  const classifyChat = useYard((s) => s.classifyChat);
  const archiveChat = useYard((s) => s.archiveChat);
  const hideChat = useYard((s) => s.hideChat);
  const threads = useYard((s) => s.threads) ?? [];
  const saveChatThread = useYard((s) => s.saveChatThread);
  const logs = useYard((s) => s.logs);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [needTo, setNeedTo] = useState(false);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => {
    if (!emp) return [];
    const master = isMasterRole(emp.role);
    return chats
      .filter((m) => chatVisible(m, emp, assignments))
      .filter((m) => (master ? (showArchive ? Boolean(m.archivedAt) : !m.archivedAt) : true))
      .filter((m) => (threadId ? m.threadId === threadId || m.id === threads.find((th) => th.id === threadId)?.rootId : true))
      .slice(0, 80);
  }, [assignments, chats, emp, threadId, threads, showArchive]);
  const savedThreads = threads.filter((th) => th.projectId === projectId || chats.some((c) => c.id === th.rootId));
  if (!emp) return null;
  const me = emp;
  const master = isMasterRole(me.role);
  const people = employees.filter((e) => e.id !== me.id);

  function currentTarget(): ChatTarget | null {
    if (threadId) {
      const inThread = chats.filter((m) => m.threadId === threadId);
      const ids = new Set<string>();
      for (const m of inThread) {
        ids.add(m.fromId);
        for (const id of targetEmployeeIds(m.to)) ids.add(id);
      }
      ids.delete(me.id);
      const list = [...ids];
      if (list.length === 1) return { kind: "employee", id: list[0]! };
      if (list.length > 1) return { kind: "employees", ids: list };
    }
    if (!picked.length) return null;
    if (picked.length === 1) return { kind: "employee", id: picked[0]! };
    return { kind: "employees", ids: picked };
  }

  function togglePerson(id: string) {
    setNeedTo(false);
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const job = lookupProject(projectId);
    const gps = await readGpsOrSite(job);
    const nextPhotos: DraftPhoto[] = [];
    const nextFiles: ChatFile[] = [];
    for (const file of [...list]) {
      const kind = kindFromFile(file);
      if (kind === "photo") {
        try {
          const stamped = await stampPhotoFiles([file], { who: me.name, job: job.name, gps });
          for (const p of stamped) {
            nextPhotos.push({
              id: `chp-${crypto.randomUUID().slice(0, 8)}`,
              dataUrl: p.dataUrl,
              name: p.name,
              at: new Date().toISOString(),
              lat: gps?.lat ?? null,
              lng: gps?.lng ?? null,
              gpsLabel: gpsPatch(gps, "create").gpsLabel,
            });
          }
        } catch {
          /* skip */
        }
        continue;
      }
      let dataUrl: string | undefined;
      if (kind === "video") dataUrl = await videoPoster(file);
      nextFiles.push({
        id: `chf-${crypto.randomUUID().slice(0, 8)}`,
        kind,
        name: file.name || `${kind}-${Date.now()}`,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    }
    if (nextPhotos.length) setPhotos((cur) => [...cur, ...nextPhotos]);
    if (nextFiles.length) setFiles((cur) => [...cur, ...nextFiles]);
  }

  async function translateAll(raw: string, from: Lang) {
    const res = await translateMessage({ data: { text: raw, from } });
    if (res.ok) return res.translations;
    return { [from]: raw } as Partial<Record<Lang, string>>;
  }

  async function send(raw: string, viaVoice: boolean, asTodo = false) {
    const body = raw.trim();
    const attached = photos;
    const attachedFiles = files;
    if (!body && !attached.length && !attachedFiles.length) return;
    const to = currentTarget();
    if (!to) {
      setNeedTo(true);
      return;
    }
    const target = to;
    const line = body || t(lang, "chatPhotoOnly");
    const job = lookupProject(projectId);
    const gps = await readGpsOrSite(job);
    const geo = gpsPatch(gps, "create");
    const tid = threadId ?? `thr-${crypto.randomUUID().slice(0, 8)}`;
    const assigneeIds = targetEmployeeIds(target);
    if (asTodo && !assigneeIds.length) {
      setNeedTo(true);
      return;
    }
    const photoFileIds: string[] = [];
    let todoId = "";
    if (asTodo) {
      const created = addTodo({
        projectId,
        assigneeId: assigneeIds[0]!,
        assigneeIds,
        title: line.slice(0, 80),
        due: copenhagenDate(),
        body: line,
        photoFileIds: [],
        lat: geo.lat,
        lng: geo.lng,
        gpsLabel: geo.gpsLabel,
        original: line,
        sourceLang: lang,
      });
      todoId = created.id;
    }
    const folderName = asTodo && todoId ? todoDriveFolder(todoId) : chatDriveFolder(tid);
    const uploaded: DraftPhoto[] = [];
    for (const p of attached) {
      const split = splitDataUrl(p.dataUrl);
      let driveFileId = p.driveFileId ?? "";
      if (split.base64) {
        const up = await uploadVoicePhoto({
          data: {
            projectId,
            name: p.name,
            mimeType: split.mime || "image/jpeg",
            contentBase64: split.base64,
            folderName,
          },
        });
        if (up.fileId) driveFileId = up.fileId;
      }
      if (driveFileId) photoFileIds.push(driveFileId);
      uploaded.push({ ...p, driveFileId, dataUrl: "" });
    }
    if (asTodo && todoId && photoFileIds.length) {
      useYard.getState().patchTodo(todoId, { photoFileIds });
    }
    const row = addChat({
      fromId: me.id,
      to: target,
      projectId,
      sourceLang: lang,
      original: line,
      translations: { [lang]: line, da: line },
      viaVoice,
      photos: uploaded.length ? uploaded : undefined,
      files: attachedFiles.length ? attachedFiles : undefined,
      threadId: tid,
      lat: geo.lat,
      lng: geo.lng,
      gpsLabel: geo.gpsLabel,
    });
    saveChatThread(row.id);
    setThreadId(tid);
    setText("");
    setPhotos([]);
    setFiles([]);
    setNeedTo(false);
    function driveLog(translations: Partial<Record<Lang, string>>) {
      const payload = {
        id: row.id,
        at: row.at,
        from: me.name,
        fromId: me.id,
        to: target,
        projectId,
        original: line,
        sourceLang: lang,
        translations,
        gps: geo,
        photos: uploaded.map((p) => ({ fileId: p.driveFileId, name: p.name, lat: p.lat, lng: p.lng, gpsLabel: p.gpsLabel, at: p.at })),
        files: attachedFiles.map((f) => ({ name: f.name, kind: f.kind })),
        todoId: todoId || undefined,
      };
      void writeJobNote({
        data: {
          projectId,
          folderName,
          name: asTodo && todoId ? `todo-${todoId}.json` : `chat-${row.id}.json`,
          text: JSON.stringify(payload, null, 2),
        },
      });
      void appendChatLog({
        data: {
          projectId,
          title: line.slice(0, 40),
          employeeName: me.name,
          text: [
            `CHAT ${projectId}`,
            `Fra: ${me.name}`,
            `Til: ${target.kind === "employees" || target.kind === "employee" ? targetEmployeeIds(target).join(",") : target.kind}`,
            `Sprog: ${lang}`,
            `Tid: ${row.at}`,
            `GPS: ${geo.gpsLabel ?? "—"}`,
            `Original (${lang}): ${line}`,
            translations.da && translations.da !== line ? `DA: ${translations.da}` : "",
            uploaded.length ? `Billeder: ${uploaded.map((p) => p.driveFileId || p.name).join(", ")}` : "",
            attachedFiles.length ? `Filer: ${attachedFiles.map((f) => f.name).join(", ")}` : "",
            todoId ? `To-do: ${todoId}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
    }
    driveLog({ [lang]: line, da: line });
    if (body) {
      void translateAll(body, lang).then((translations) => {
        patchChat(row.id, { translations });
        driveLog(translations);
        if (asTodo && todoId) useYard.getState().patchTodo(todoId, { translations, sourceLang: lang, original: line });
      });
    }
    const dump = useYard
      .getState()
      .logs.slice(0, 80)
      .map((l) => `${l.at} ${l.kind} ${l.text}`)
      .join("\n");
    void ensureAdminLog({ data: { text: dump, date: copenhagenDate() } }).then((r) => {
      if (r.ok && r.folderId) useYard.getState().setAdminFolder(r.folderId);
    });
  }

  async function hear(msgText: string) {
    const res = await speakTranslation({ data: { text: msgText, lang } });
    if (res.ok) {
      const audio = new Audio(res.audio);
      void audio.play();
      return;
    }
    localSpeak(msgText, lang);
  }

  async function toggleRec() {
    if (rec && recRef.current) {
      setRec(false);
      setBusy(true);
      try {
        const clip = await recRef.current.stop();
        recRef.current = null;
        const stt = await transcribeClip({ data: { audioBase64: clip.base64, mime: clip.mime, language: lang } });
        if (stt.ok) {
          setText(stt.text);
          await send(stt.text, true);
          void hear(stt.text);
          setBusy(false);
          return;
        }
        const fallback = await browserListen(lang);
        if (fallback) await send(fallback, true);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      recRef.current = await startRecording();
      setRec(true);
    } catch {
      const spoken = await browserListen(lang);
      if (spoken) await send(spoken, true);
    }
  }

  function classify(msg: ChatMessage, classifiedAs: InboxClass) {
    const res = classifyChat(msg.id, classifiedAs, me.id);
    const item = useYard.getState().fieldItems.find((f) => f.reportId === res.reportId) ?? useYard.getState().fieldItems[0];
    if (item) {
      void placeFieldInSlot({
        data: {
          projectId: item.projectId,
          classifiedAs,
          name: item.name,
          note: item.note || msg.original,
          employeeName: item.employeeName,
          reportNumber: res.reportNumber,
        },
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[20px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>{t(lang, "chatTitle")}</SectionLabel>
          {master ? (
            <div className="flex gap-1">
              <GhostButton className="min-h-10 bg-sand text-xs" onClick={() => setShowArchive((v) => !v)}>
                {showArchive ? t(lang, "chatLive") : t(lang, "chatArchiveOpen")}
              </GhostButton>
              <GhostButton className="min-h-10 bg-sand text-xs" onClick={() => setPdfOpen(true)}>
                {t(lang, "chatPdf")}
              </GhostButton>
            </div>
          ) : null}
        </div>
        <p className="mb-3 text-sm text-muted">{t(lang, "chatHint")}</p>
        {threadId ? (
          <GhostButton className="mb-3 bg-sand" onClick={() => setThreadId(null)}>
            {t(lang, "chatThreadBack")}
          </GhostButton>
        ) : null}
        {!threadId ? (
          <>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t(lang, "chatTo")}</p>
            <p className="mb-1.5 text-xs text-muted">{t(lang, "chatPickRecipients")}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {people.map((p) => (
                <TargetChip key={p.id} active={picked.includes(p.id)} onClick={() => togglePerson(p.id)}>
                  {p.name}
                </TargetChip>
              ))}
            </div>
            {needTo ? <p className="mb-2 text-sm text-brick">{t(lang, "chatNeedTo")}</p> : null}
          </>
        ) : null}
        {!threadId ? (
          <div>
        {photos.length || files.length ? (
          <ul className="mb-2 flex gap-2 overflow-x-auto">
            {photos.map((p) => (
              <li key={p.id}>
                <img src={p.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
              </li>
            ))}
            {files.map((f) => (
              <li key={f.id} className="flex size-16 items-center justify-center rounded-lg bg-sand px-1 text-center text-xs leading-tight">
                {f.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mb-2 flex flex-wrap gap-2">
          <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
            <Camera className="mr-1 size-4" />
            {t(lang, "camera")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
            <ImagePlus className="mr-1 size-4" />
            {t(lang, "gallery")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => vidRef.current?.click()}>
            <Film className="mr-1 size-4" />
            {t(lang, "chatVideo")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1 size-4" />
            {t(lang, "chatFile")}
          </GhostButton>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <div className="flex gap-2">
          <input
            className="min-h-12 flex-1 rounded-xl bg-sand px-3 text-sm"
            placeholder={threadId ? t(lang, "chatReplyPh") : t(lang, "chatPlaceholder")}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send(text, false);
            }}
          />
          <button
            type="button"
            className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl ${rec ? "bg-brick text-sand" : "bg-navy text-sand"}`}
            onClick={() => void toggleRec()}
            aria-label={rec ? t(lang, "chatStop") : t(lang, "chatSpeak")}
          >
            {rec ? <Square className="size-5" /> : <Mic className="size-5" />}
          </button>
          <button
            type="button"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-navy px-3 text-xs font-semibold text-sand disabled:opacity-40"
            disabled={busy || (!text.trim() && !photos.length && !files.length)}
            onClick={() => void send(text, false, true)}
          >
            {t(lang, "sendAsTodo")}
          </button>
          <button
            type="button"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brick text-sand disabled:opacity-40"
            disabled={busy || (!text.trim() && !photos.length && !files.length)}
            onClick={() => void send(text, false)}
            aria-label={t(lang, "chatSend")}
          >
            <Send className="size-5" />
          </button>
        </div>
        {rec ? <p className="mt-2 text-xs text-brick">{t(lang, "chatListening")}</p> : null}
        {busy && !rec ? <p className="mt-2 text-xs text-muted">{t(lang, "voiceThink")}</p> : null}
          </div>
        ) : null}
      </Card>
      {savedThreads.length ? (
        <Card className="rounded-[20px]">
          <SectionLabel>{t(lang, "chatThreads")}</SectionLabel>
          <ul className="space-y-1.5">
            {savedThreads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  className={`block min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm ${threadId === th.id ? "bg-navy text-sand" : "bg-sand"}`}
                  onClick={() => setThreadId(th.id === threadId ? null : th.id)}
                >
                  {th.title}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="rounded-[20px]">
        <ul className="max-h-[52vh] space-y-2 overflow-y-auto">
          {visible.length === 0 ? <p className="text-sm text-muted">{t(lang, "chatEmpty")}</p> : null}
          {visible.map((m) => (
            <ChatBubble
              key={m.id}
              msg={m}
              lang={lang}
              me={me}
              people={employees}
              onHear={hear}
              onTodo={() => {
                const ids = m.fromId === me.id ? targetEmployeeIds(m.to) : [m.fromId];
                const who = ids.length ? ids : targetEmployeeIds(m.to);
                addTodo({
                  projectId: m.projectId,
                  assigneeId: who[0] ?? m.fromId,
                  assigneeIds: who.length ? who : [m.fromId],
                  title: (m.translations.da ?? m.original).slice(0, 80),
                  due: copenhagenDate(),
                  body: m.translations.da ?? m.original,
                  photoFileIds: (m.photos ?? []).map((p) => p.driveFileId).filter((id): id is string => Boolean(id)),
                  lat: m.lat ?? null,
                  lng: m.lng ?? null,
                  gpsLabel: m.gpsLabel,
                });
              }}
              onClassify={master ? (as) => classify(m, as) : undefined}
              onArchive={master ? () => archiveChat(m.id) : undefined}
              onRemove={!master ? () => hideChat(m.id, me.id) : undefined}
              onSaveThread={() => {
                const th = saveChatThread(m.id);
                if (th) setThreadId(th.id);
              }}
              onOpenThread={m.threadId ? () => setThreadId(m.threadId!) : undefined}
            />
          ))}
        </ul>
        {threadId ? (
          <div className="mt-3 border-t border-line pt-3">
            {needTo ? <p className="mb-2 text-sm text-brick">{t(lang, "chatNeedTo")}</p> : null}
        {photos.length || files.length ? (
          <ul className="mb-2 flex gap-2 overflow-x-auto">
            {photos.map((p) => (
              <li key={p.id}>
                <img src={p.dataUrl} alt="" className="size-16 rounded-lg object-cover" />
              </li>
            ))}
            {files.map((f) => (
              <li key={f.id} className="flex size-16 items-center justify-center rounded-lg bg-sand px-1 text-center text-xs leading-tight">
                {f.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mb-2 flex flex-wrap gap-2">
          <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
            <Camera className="mr-1 size-4" />
            {t(lang, "camera")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
            <ImagePlus className="mr-1 size-4" />
            {t(lang, "gallery")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => vidRef.current?.click()}>
            <Film className="mr-1 size-4" />
            {t(lang, "chatVideo")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1 size-4" />
            {t(lang, "chatFile")}
          </GhostButton>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
        <div className="flex gap-2">
          <input
            className="min-h-12 flex-1 rounded-xl bg-sand px-3 text-sm"
            placeholder={threadId ? t(lang, "chatReplyPh") : t(lang, "chatPlaceholder")}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send(text, false);
            }}
          />
          <button
            type="button"
            className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl ${rec ? "bg-brick text-sand" : "bg-navy text-sand"}`}
            onClick={() => void toggleRec()}
            aria-label={rec ? t(lang, "chatStop") : t(lang, "chatSpeak")}
          >
            {rec ? <Square className="size-5" /> : <Mic className="size-5" />}
          </button>
          <button
            type="button"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-navy px-3 text-xs font-semibold text-sand disabled:opacity-40"
            disabled={busy || (!text.trim() && !photos.length && !files.length)}
            onClick={() => void send(text, false, true)}
          >
            {t(lang, "sendAsTodo")}
          </button>
          <button
            type="button"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brick text-sand disabled:opacity-40"
            disabled={busy || (!text.trim() && !photos.length && !files.length)}
            onClick={() => void send(text, false)}
            aria-label={t(lang, "chatSend")}
          >
            <Send className="size-5" />
          </button>
        </div>
        {rec ? <p className="mt-2 text-xs text-brick">{t(lang, "chatListening")}</p> : null}
        {busy && !rec ? <p className="mt-2 text-xs text-muted">{t(lang, "voiceThink")}</p> : null}
          </div>
        ) : null}
        {master ? <LogSearch lang={lang} logs={logs} /> : null}
      </Card>
      {pdfOpen ? <ChatPdfSheet lang={lang} msgs={visible} people={employees} onClose={() => setPdfOpen(false)} /> : null}
    </div>
  );
}

function TargetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-10 rounded-full px-3 text-xs font-medium ${active ? "bg-navy text-sand" : "bg-sand text-ink"}`}>
      {children}
    </button>
  );
}

function ChatBubble({
  msg,
  lang,
  me,
  people,
  onHear,
  onTodo,
  onClassify,
  onSaveThread,
  onOpenThread,
  onArchive,
  onRemove,
}: {
  msg: ChatMessage;
  lang: Lang;
  me: Employee;
  people: Employee[];
  onHear: (text: string) => void;
  onTodo: () => void;
  onClassify?: (as: InboxClass) => void;
  onSaveThread: () => void;
  onOpenThread?: () => void;
  onArchive?: () => void;
  onRemove?: () => void;
}) {
  const mine = msg.fromId === me.id && !msg.fromAgent;
  const who = people.find((p) => p.id === msg.fromId);
  const body = shownText(msg, lang, me.role);
  const fromCrew = !isMasterRole(who?.role ?? "svend");
  const target = msg.to;
  const toLabel = chatTargetLabel(target, people, t(lang, "chatToOnJob"), t(lang, "chatToMaster"));
  const showClass = Boolean(onClassify && fromCrew && goesToMaster(msg.to, people) && !msg.classifiedAs && !msg.fromAgent);
  const whoName = msg.fromAgent ? t(lang, "voiceAgent") : (who?.name ?? "—");
  return (
    <li className={`rounded-xl px-3 py-2 ${mine ? "bg-navy text-sand" : "bg-sand text-ink"}`}>
      <p className={`text-xs ${mine ? "text-sand/70" : "text-muted"}`}>
        {whoName} · {copenhagenTime(msg.at)}
        {msg.fromAgent ? "" : msg.viaVoice ? " · tal" : ""}
        {toLabel && !msg.fromAgent ? ` · ${toLabel}` : ""}
        {msg.lat != null && msg.lng != null ? (
          <>
            {" · "}
            <GpsLink lat={msg.lat} lng={msg.lng} label={msg.gpsLabel || t(lang, "gpsMaps")} className={mine ? "text-sand/70" : "text-muted"} />
          </>
        ) : msg.gpsLabel ? (
          ` · ${msg.gpsLabel}`
        ) : (
          ""
        )}
      </p>
      <UserText
        original={msg.original}
        translations={msg.translations}
        lang={lang}
        role={me.role}
        className="mt-1 text-sm leading-relaxed"
        linkClass={`mt-1 text-xs underline underline-offset-2 ${mine ? "text-sand/70" : "text-muted"}`}
      />
      {msg.photos?.length ? (
        <ul className="mt-2 grid grid-cols-3 gap-1">
          {msg.photos.map((p) => (
            <li key={p.id}>
              {p.dataUrl ? (
                <img src={p.dataUrl} alt="" className="aspect-square w-full rounded-md object-cover" />
              ) : p.driveFileId ? (
                <DriveFileThumb fileId={p.driveFileId} className="aspect-square w-full rounded-md object-cover" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {msg.files?.length ? (
        <ul className="mt-1 space-y-1">
          {msg.files.map((f) => (
            <li key={f.id} className={`text-xs ${mine ? "text-sand/80" : "text-muted"}`}>
              {f.kind} · {f.name}
            </li>
          ))}
        </ul>
      ) : null}
      {msg.classifiedAs ? (
        <p className={`mt-1 text-xs ${mine ? "text-sand/70" : "text-muted"}`}>
          {t(lang, "chatClassed")}: {t(lang, classKey(msg.classifiedAs))}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={() => onHear(body)}>
          <Volume2 className="mr-1 inline size-3.5" />
          {t(lang, "chatHear")}
        </GhostButton>
        {isMasterRole(me.role) && !msg.fromAgent ? (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onTodo}>
            {t(lang, "addAsTodo")}
          </GhostButton>
        ) : !msg.fromAgent ? (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onTodo}>
            {t(lang, "sendAsTodo")}
          </GhostButton>
        ) : null}
        {onArchive && !msg.fromAgent ? (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onArchive}>
            {t(lang, "chatArchive")}
          </GhostButton>
        ) : null}
        {onRemove && !msg.fromAgent ? (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onRemove}>
            {t(lang, "chatRemove")}
          </GhostButton>
        ) : null}
        {msg.threadId ? (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onOpenThread}>
            {t(lang, "chatSavedThread")}
          </GhostButton>
        ) : (
          <GhostButton className={`min-h-9 px-2 text-xs ${mine ? "text-sand" : "text-navy"}`} onClick={onSaveThread}>
            {t(lang, "chatSaveThread")}
          </GhostButton>
        )}
      </div>
      {showClass ? (
        <div className="mt-2">
          <p className={`mb-1 text-xs ${mine ? "text-sand/70" : "text-muted"}`}>{t(lang, "chatClassify")}</p>
          <div className="flex flex-wrap gap-1">
            {(["extra", "materials", "tf", "ent", "ks"] as InboxClass[]).map((k) => (
              <GhostButton key={k} className="min-h-9 bg-paper px-2 text-xs text-navy" onClick={() => onClassify?.(k)}>
                {t(lang, classKey(k))}
              </GhostButton>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function classKey(k: InboxClass): "fieldAsExtra" | "fieldAsMaterials" | "fieldAsTf" | "fieldAsEnt" | "fieldAsKs" {
  if (k === "extra") return "fieldAsExtra";
  if (k === "materials") return "fieldAsMaterials";
  if (k === "tf") return "fieldAsTf";
  if (k === "ks") return "fieldAsKs";
  return "fieldAsEnt";
}

function ChatPdfSheet({
  lang,
  msgs,
  people,
  onClose,
}: {
  lang: Lang;
  msgs: ChatMessage[];
  people: Employee[];
  onClose: () => void;
}) {
  const projects = useYard((s) => s.projects);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sand">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <BackArrow onClick={onClose} label={t(lang, "back")} />
        <p className="font-display text-lg">{t(lang, "chatPdf")}</p>
        <GhostButton className="text-sand" onClick={() => printDoc()}>
          {t(lang, "print")}
        </GhostButton>
      </div>
      <article className="mx-auto max-w-2xl bg-paper px-6 py-8 text-ink">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Zenko Danmark</p>
        <h1 className="font-display text-3xl text-navy">{t(lang, "chatTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{copenhagenDate()} · {msgs.length}</p>
        <ul className="mt-6 space-y-4">
          {msgs.map((m) => {
            const who = people.find((p) => p.id === m.fromId)?.name ?? m.fromId;
            const job = projects.find((p) => p.id === m.projectId)?.name ?? m.projectId;
            const da = m.translations.da ?? m.original;
            return (
              <li key={m.id} className="break-inside-avoid border-b border-line pb-3">
                <p className="text-xs text-muted">
                  {who} · {copenhagenTime(m.at)} · {job}
                  {m.gpsLabel ? ` · ${m.gpsLabel}` : ""}
                </p>
                <p className="mt-1 text-sm">{da}</p>
                {m.original !== da ? (
                  <p className="mt-1 text-xs text-muted">
                    {t(lang, "chatOriginalLink")}: {m.original} ({m.sourceLang})
                  </p>
                ) : null}
                {m.photos?.length ? (
                  <ul className="mt-2 grid grid-cols-3 gap-1">
                    {m.photos.map((p) => (
                      <li key={p.id}>
                        {p.dataUrl ? (
                          <img src={p.dataUrl} alt="" className="aspect-square w-full rounded-md object-cover" />
                        ) : p.driveFileId ? (
                          <DriveFileThumb fileId={p.driveFileId} className="aspect-square w-full rounded-md object-cover" />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </article>
    </div>
  );
}

function LogSearch({ lang, logs }: { lang: Lang; logs: ReturnType<typeof useYard.getState>["logs"] }) {
  const [q, setQ] = useState("");
  const hits = q.trim()
    ? logs.filter((l) => `${l.text} ${l.kind}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12)
    : [];
  return (
    <div className="mt-4 border-t border-line pt-3">
      <SectionLabel>{t(lang, "logSearch")}</SectionLabel>
      <input className="min-h-11 w-full rounded-lg bg-sand px-3 text-sm" placeholder={t(lang, "logSearch")} value={q} onChange={(e) => setQ(e.target.value)} />
      {q && hits.length === 0 ? <p className="mt-2 text-xs text-muted">{t(lang, "logEmpty")}</p> : null}
      <ul className="mt-2 space-y-1">
        {hits.map((l) => (
          <li key={l.id} className="text-xs leading-relaxed">
            <Chip tone="sand">{l.kind}</Chip> {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
