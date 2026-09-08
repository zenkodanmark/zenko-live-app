import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Square, Volume2 } from "lucide-react";
import { DriveFileThumb } from "@/components/drive-photo";
import { NeedOrderSheet } from "@/components/material-pane";
import { GpsLink } from "@/components/photo-strip";
import { UserText } from "@/components/user-text";
import { Card, Chip, GhostButton, SectionLabel } from "@/components/zenko";
import { ActionPng, BackArrow, SagPng, type SagPngName } from "@/components/sag-icons";
import { speakTranslation, transcribeClip, translateMessage } from "@/lib/ai.functions";
import { chatVisible, completeTranslations, driveOnlyFiles, driveOnlyPhotos, findChatWith, listChatRows, shownText, targetEmployeeIds, threadPeopleIds, threadPeopleLabel } from "@/lib/chat";
import { pileLabelKey } from "@/lib/board-piles";
import { chatDriveFolder, todoDriveFolder } from "@/lib/drive";
import { peekReportNumber, reportDriveFolder } from "@/lib/drive-commit";
import { appendChatLog, ensureAdminLog, placeFieldInSlot, writeJobNote } from "@/lib/drive.functions";
import { kindFromFile } from "@/lib/field-media";
import { t } from "@/lib/i18n";
import { connectorUserText } from "@/lib/connector-msg";
import { gpsPatch, readGpsOrSite } from "@/lib/photo-meta";
import { printDoc } from "@/lib/print";
import { copenhagenDate, copenhagenTime, isMasterRole } from "@/lib/seed";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { fillTodoTranslations, uploadDraftsToFolder } from "@/lib/todo-drive";
import { connectorsOffline, createSagOnDrive } from "@/lib/sag-drive";
import type { ChatFile, ChatMessage, ChatTarget, Employee, InboxClass, Lang } from "@/lib/types";
import type { ChatListRow } from "@/lib/chat";
import { browserListen, localSpeak, startRecording } from "@/lib/voice-client";

type DraftPhoto = { id: string; dataUrl: string; name: string; driveFileId?: string; lat?: number | null; lng?: number | null; gpsLabel?: string; at?: string };

const CHAT_CLASSIFY: InboxClass[] = ["tf", "extra", "ent", "ks", "materials"];
const CLASS_ICON: Record<InboxClass, SagPngName> = {
  tf: "tf",
  extra: "as",
  ent: "er",
  ks: "ks",
  materials: "ma",
  todo: "todo",
};

function firstNameOf(name: string) {
  return name.split(" ")[0] || name;
}

export function ChatPane({ lang, projectId }: { lang: Lang; projectId: string }) {
  const emp = useSessionEmployee();
  const employees = useYard((s) => s.employees);
  const assignments = useYard((s) => s.assignments);
  const chats = useYard((s) => s.chats);
  const addChat = useYard((s) => s.addChat);
  const patchChat = useYard((s) => s.patchChat);
  const addTodo = useYard((s) => s.addTodo);
  const classifyChat = useYard((s) => s.classifyChat);
  const hideChat = useYard((s) => s.hideChat);
  const threads = useYard((s) => s.threads) ?? [];
  const saveChatThread = useYard((s) => s.saveChatThread);
  const ensureChatThread = useYard((s) => s.ensureChatThread);
  const markThreadSeen = useYard((s) => s.markThreadSeen);
  const threadSeenAt = useYard((s) => s.threadSeenAt) ?? {};
  const logs = useYard((s) => s.logs);
  const projects = useYard((s) => s.projects);
  const openChatWith = useYard((s) => s.openChatWith);
  const setOpenChatWith = useYard((s) => s.setOpenChatWith);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [needTo, setNeedTo] = useState(false);
  const [needId, setNeedId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [readHint, setReadHint] = useState(false);
  const [classAsk, setClassAsk] = useState<{ msg: ChatMessage; kind: InboxClass } | null>(null);
  const [newJobName, setNewJobName] = useState("");
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const lists = useMemo(() => {
    if (!emp) return { active: [], saved: [] };
    return listChatRows(chats, threads, employees, emp, assignments, threadSeenAt);
  }, [assignments, chats, emp, employees, threadSeenAt, threads]);
  const visible = useMemo(() => {
    if (!emp || !threadId) return [];
    return chats
      .filter((m) => chatVisible(m, emp, assignments))
      .filter((m) => {
        if (m.threadId === threadId) return true;
        if (threadId.startsWith("msg-") && (`msg-${m.id}` === threadId || m.id === threadId.slice(4))) return true;
        const th = threads.find((t) => t.id === threadId);
        return Boolean(th && (m.id === th.rootId || m.threadId === th.id));
      })
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-80);
  }, [assignments, chats, emp, threadId, threads]);

  useEffect(() => {
    if (!openChatWith || !emp) return;
    const other = openChatWith;
    setOpenChatWith(null);
    const hit = findChatWith(chats, threads, employees, emp, assignments, other, threadSeenAt);
    setPicked([other]);
    setComposing(true);
    setText("");
    setPhotos([]);
    setFiles([]);
    setNeedTo(false);
    if (hit) {
      const msgs = chats.filter((m) => m.threadId === hit.id || m.id === hit.rootId || `msg-${m.id}` === hit.id);
      const withThread = msgs.find((m) => m.threadId)?.threadId;
      const openId = withThread || hit.id;
      setThreadId(openId);
      markThreadSeen(emp.id, openId);
    } else {
      setThreadId(null);
    }
  }, [openChatWith, emp]);
  if (!emp) return null;
  const me = emp;
  const master = isMasterRole(me.role);
  const people = employees;
  const inThread = composing || Boolean(threadId);

  function currentTarget(): ChatTarget | null {
    if (picked.length === 1) return { kind: "employee", id: picked[0]! };
    if (picked.length > 1) return { kind: "employees", ids: picked };
    if (threadId) {
      const ids = threadPeopleIds(visible).filter(Boolean);
      if (ids.length === 1) return { kind: "employee", id: ids[0]! };
      if (ids.length > 1) return { kind: "employees", ids: ids };
    }
    return null;
  }

  function togglePerson(id: string) {
    setNeedTo(false);
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function openNew() {
    setComposing(true);
    setThreadId(null);
    setPicked([]);
    setText("");
    setPhotos([]);
    setFiles([]);
    setNeedTo(false);
  }

  function openRow(id: string, rootId: string) {
    const msgs = chats.filter((m) => m.threadId === id || m.id === rootId || `msg-${m.id}` === id);
    const ids = threadPeopleIds(msgs.length ? msgs : chats.filter((m) => m.id === rootId));
    setPicked(ids);
    setComposing(true);
    const withThread = msgs.find((m) => m.threadId)?.threadId;
    const openId = withThread || id;
    setThreadId(openId);
    markThreadSeen(me.id, openId);
    if (withThread && withThread !== id) markThreadSeen(me.id, id);
  }

  function closeThread() {
    setComposing(false);
    setThreadId(null);
    setPicked([]);
    setText("");
    setPhotos([]);
    setFiles([]);
    setActionMsg(null);
  }

  async function addFiles(list: File[] | FileList | null) {
    const pickedFiles = list ? [...list] : [];
    if (!pickedFiles.length) return;
    const job = lookupProject(projectId);
    const nextPhotos: DraftPhoto[] = [];
    const nextFiles: ChatFile[] = [];
    for (const file of pickedFiles) {
      const kind = kindFromFile(file);
      const dataUrl = await readDataUrl(file);
      if (!dataUrl) continue;
      if (kind === "photo") {
        nextPhotos.push({
          id: `chp-${crypto.randomUUID().slice(0, 8)}`,
          dataUrl,
          name: file.name || "foto.jpg",
          at: new Date().toISOString(),
        });
        continue;
      }
      nextFiles.push({
        id: `chf-${crypto.randomUUID().slice(0, 8)}`,
        kind,
        name: file.name || `${kind}-${Date.now()}`,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    }
    if (nextPhotos.length) setPhotos((cur) => [...cur, ...nextPhotos].slice(0, 8));
    if (nextFiles.length) setFiles((cur) => [...cur, ...nextFiles]);
    if (nextPhotos.length) {
      void readGpsOrSite(job).then((gps) => {
        const geo = gpsPatch(gps, "create");
        setPhotos((cur) =>
          cur.map((p) =>
            nextPhotos.some((n) => n.id === p.id)
              ? { ...p, lat: gps?.lat ?? null, lng: gps?.lng ?? null, gpsLabel: geo.gpsLabel }
              : p,
          ),
        );
      });
    }
  }

  async function translateAll(raw: string, from: Lang) {
    for (let i = 0; i < 2; i++) {
      try {
        const res = await translateMessage({ data: { text: raw, from } });
        const got = res.translations ?? {};
        if (res.ok && (from === "da" || (got.da && got.da !== raw))) {
          return completeTranslations(raw, from, got);
        }
      } catch {
        /* retry */
      }
    }
    return completeTranslations(raw, from);
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
    const fromPhoto = attached.find((p) => p.lat != null || p.gpsLabel);
    const geo = {
      lat: fromPhoto?.lat ?? null,
      lng: fromPhoto?.lng ?? null,
      gpsLabel: fromPhoto?.gpsLabel,
    };
    const tid = threadId ?? `thr-${crypto.randomUUID().slice(0, 8)}`;
    const assigneeIds = targetEmployeeIds(target);
    if (asTodo && !assigneeIds.length) {
      setNeedTo(true);
      return;
    }
    const sourceLang = me.language;
    const localPhotos = attached.map((p) => ({ ...p }));
    const localFiles = attachedFiles.map((f) => ({ ...f }));
    const mediaDrafts = [
      ...attached.map((p) => ({ dataUrl: p.dataUrl, name: p.name })),
      ...attachedFiles.filter((f) => f.dataUrl).map((f) => ({ dataUrl: f.dataUrl as string, name: f.name })),
    ];
    setBusy(true);
    const pendingTodoId = asTodo ? `td-${crypto.randomUUID().slice(0, 6)}` : "";
    let photoIds: string[] = [];
    let extraIds: string[] = [];
    if (mediaDrafts.length) {
      try {
        const fileIds = await uploadDraftsToFolder({
          projectId: projectId || job?.id || "",
          folderName: asTodo && pendingTodoId ? todoDriveFolder(pendingTodoId) : chatDriveFolder(),
          drafts: mediaDrafts,
        });
        if (!fileIds.length) useYard.setState({ toast: t(lang, connectorsOffline() ? "googleNotConnected" : "driveFail") });
        else if (fileIds.length < mediaDrafts.length) useYard.setState({ toast: t(lang, connectorsOffline() ? "googleNotConnected" : "driveFail") });
        photoIds = fileIds.slice(0, localPhotos.length);
        extraIds = fileIds.slice(localPhotos.length);
      } catch {
        useYard.setState({ toast: t(lang, connectorsOffline() ? "googleNotConnected" : "driveFail") });
      }
      if (!body && !photoIds.length && !extraIds.length) {
        setBusy(false);
        return;
      }
    }
    const storedPhotos = driveOnlyPhotos(
      localPhotos.map((p, i) => ({
        id: p.id,
        name: p.name,
        at: p.at,
        lat: p.lat,
        lng: p.lng,
        gpsLabel: p.gpsLabel,
        driveFileId: photoIds[i] || p.driveFileId,
      })),
    )?.filter((p) => p.driveFileId);
    const storedFiles = driveOnlyFiles(
      localFiles.map((f, i) => ({
        id: f.id,
        kind: f.kind,
        name: f.name,
        mimeType: f.mimeType,
        driveFileId: extraIds[i] || f.driveFileId,
      })),
    )?.filter((f) => f.driveFileId);
    const row = addChat({
      fromId: me.id,
      to: target,
      projectId,
      sourceLang,
      original: line,
      translations: completeTranslations(line, sourceLang, { [sourceLang]: line }),
      viaVoice,
      photos: storedPhotos,
      files: storedFiles,
      threadId: tid,
      lat: geo.lat,
      lng: geo.lng,
      gpsLabel: geo.gpsLabel,
    });
    let todoId = "";
    if (asTodo && pendingTodoId) {
      const note = await writeJobNote({
        data: {
          projectId,
          projectName: job?.name,
          folderName: todoDriveFolder(pendingTodoId),
          name: `todo-${pendingTodoId}.json`,
          text: JSON.stringify({
            id: pendingTodoId,
            title: line.slice(0, 80),
            createdAt: new Date().toISOString(),
            by: me.name,
            photoFileIds: photoIds.filter(Boolean),
          }, null, 2),
        },
      });
      if (!note.ok) {
        useYard.setState({ toast: connectorUserText(lang, note.error, note.loginRequired) });
      } else {
        const created = addTodo({
          id: pendingTodoId,
          projectId,
          assigneeId: assigneeIds[0] ?? me.id,
          assigneeIds,
          title: line.slice(0, 80),
          due: copenhagenDate(),
          body: line,
          photoFileIds: photoIds.filter(Boolean),
          lat: geo.lat,
          lng: geo.lng,
          gpsLabel: geo.gpsLabel,
          original: line,
          sourceLang,
          fromChatId: row.id,
          driveFileId: note.fileId,
        });
        todoId = created.id;
        patchChat(row.id, { classifiedAs: "todo", classifiedAt: new Date().toISOString() });
      }
    }
    ensureChatThread(row.id);
    setThreadId(tid);
    setComposing(true);
    setText("");
    setPhotos([]);
    setFiles([]);
    setNeedTo(false);
    void readGpsOrSite(job).then((gps) => {
      if (!gps) return;
      const g = gpsPatch(gps, "create");
      patchChat(row.id, { lat: g.lat, lng: g.lng, gpsLabel: g.gpsLabel });
    });
    function driveLog(translations: Partial<Record<Lang, string>>) {
      const payload = {
        id: row.id,
        at: row.at,
        from: me.name,
        fromId: me.id,
        to: target,
        projectId,
        original: line,
        sourceLang,
        translations,
        gps: geo,
        photos: (storedPhotos ?? []).map((p) => ({ fileId: p.driveFileId, name: p.name, lat: p.lat, lng: p.lng, gpsLabel: p.gpsLabel, at: p.at })),
        files: (storedFiles ?? []).map((f) => ({ name: f.name, kind: f.kind, fileId: f.driveFileId })),
        todoId: todoId || undefined,
      };
      void writeJobNote({
        data: {
          projectId,
          folderName: asTodo && todoId ? todoDriveFolder(todoId) : chatDriveFolder(),
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
            `Til: ${targetEmployeeIds(target).join(",")}`,
            `Sprog: ${sourceLang}`,
            `Tid: ${row.at}`,
            `Original (${sourceLang}): ${line}`,
            translations.da && translations.da !== line ? `DA: ${translations.da}` : "",
            storedPhotos?.length ? `Billeder: ${storedPhotos.map((p) => p.driveFileId || p.name).join(", ")}` : "",
            todoId ? `To-do: ${todoId}` : "",
          ].filter(Boolean).join("\n"),
        },
      });
    }
    driveLog({ [sourceLang]: line, da: line });
    if (body) {
      void translateAll(body, sourceLang).then((translations) => {
        patchChat(row.id, { translations });
        driveLog(translations);
        if (asTodo && todoId) void fillTodoTranslations(todoId, line, sourceLang);
      });
    } else if (asTodo && todoId) {
      void fillTodoTranslations(todoId, line, sourceLang);
    }
    const dump = useYard
      .getState()
      .logs.slice(0, 80)
      .map((l) => `${l.at} ${l.kind} ${l.text}`)
      .join("\n");
    void ensureAdminLog({ data: { text: dump, date: copenhagenDate() } }).then((r) => {
      if (r.ok && r.folderId) useYard.getState().setAdminFolder(r.folderId);
    });
    setBusy(false);
  }

  async function hear(msgText: string) {
    const speakLang = isMasterRole(me.role) ? "da" : me.language;
    const res = await speakTranslation({ data: { text: msgText, lang: speakLang } });
    if (res.ok) {
      const audio = new Audio(res.audio);
      void audio.play();
      return;
    }
    localSpeak(msgText, speakLang);
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

  async function applyClassify(msg: ChatMessage, classifiedAs: InboxClass, jobId: string) {
    if (msg.projectId !== jobId) patchChat(msg.id, { projectId: jobId });
    if (classifiedAs === "todo") return;
    if (classifiedAs === "materials") {
      const res = classifyChat(msg.id, classifiedAs, me.id);
      if (res.needId) setNeedId(res.needId);
      setClassAsk(null);
      setNewJobName("");
      return;
    }
    const job = lookupProject(jobId);
    const serial = useYard.getState().serial;
    const kind = classifiedAs === "extra" ? "as" : classifiedAs === "ent" ? "er" : classifiedAs === "ks" ? "ks" : "tf";
    const number = peekReportNumber(kind, serial);
    const folderName = reportDriveFolder(kind, number, "div");
    const note = await writeJobNote({
      data: {
        projectId: jobId,
        projectName: job.name,
        folderName,
        name: `${number}.json`,
        text: JSON.stringify({
          number,
          kind: classifiedAs,
          title: (msg.translations.da ?? msg.original).slice(0, 80),
          body: msg.translations.da ?? msg.original,
          fromChatId: msg.id,
          photoFileIds: (msg.photos ?? []).map((p) => p.driveFileId).filter(Boolean),
          createdAt: new Date().toISOString(),
        }, null, 2),
      },
    });
    if (!note.ok) {
      useYard.setState({ toast: connectorUserText(lang, note.error, note.loginRequired) });
      return;
    }
    const res = classifyChat(msg.id, classifiedAs, me.id);
    const item = useYard.getState().fieldItems.find((f) => f.reportId === res.reportId) ?? useYard.getState().fieldItems[0];
    if (item) {
      void placeFieldInSlot({
        data: {
          projectId: jobId,
          classifiedAs,
          name: item.name,
          note: item.note || msg.original,
          employeeName: item.employeeName,
          reportNumber: res.reportNumber,
        },
      });
    }
    setClassAsk(null);
    setNewJobName("");
  }

  function classify(msg: ChatMessage, classifiedAs: InboxClass) {
    const known = projects.some((p) => p.id === msg.projectId);
    if (!msg.projectId || !known) {
      setClassAsk({ msg, kind: classifiedAs });
      return;
    }
    void applyClassify(msg, classifiedAs, msg.projectId);
  }

  async function makeTodoFrom(msg: ChatMessage) {
    const ids = picked.length ? picked : msg.fromId === me.id ? targetEmployeeIds(msg.to) : [msg.fromId];
    const who = ids.length ? ids : [me.id];
    const todoId = `td-${crypto.randomUUID().slice(0, 6)}`;
    const job = lookupProject(msg.projectId);
    const note = await writeJobNote({
      data: {
        projectId: msg.projectId,
        projectName: job.name,
        folderName: todoDriveFolder(todoId),
        name: `todo-${todoId}.json`,
        text: JSON.stringify({
          id: todoId,
          title: (msg.translations.da ?? msg.original).slice(0, 80),
          createdAt: new Date().toISOString(),
          photoFileIds: (msg.photos ?? []).map((p) => p.driveFileId).filter(Boolean),
        }, null, 2),
      },
    });
    if (!note.ok) {
      useYard.setState({ toast: connectorUserText(lang, note.error, note.loginRequired) });
      return;
    }
    const created = addTodo({
      id: todoId,
      projectId: msg.projectId,
      assigneeId: who[0] ?? me.id,
      assigneeIds: who,
      title: (msg.translations.da ?? msg.original).slice(0, 80),
      due: copenhagenDate(),
      body: msg.translations.da ?? msg.original,
      photoFileIds: (msg.photos ?? []).map((p) => p.driveFileId).filter((id): id is string => Boolean(id)),
      lat: msg.lat ?? null,
      lng: msg.lng ?? null,
      gpsLabel: msg.gpsLabel,
      original: msg.original,
      sourceLang: msg.sourceLang,
      translations: msg.translations,
      fromChatId: msg.id,
      driveFileId: note.fileId,
    });
    patchChat(msg.id, { classifiedAs: "todo", classifiedAt: new Date().toISOString() });
    void fillTodoTranslations(created.id, msg.original, msg.sourceLang);
  }

  const headerNames = picked.length
    ? picked.map((id) => people.find((p) => p.id === id)?.name ?? "").filter(Boolean).join(", ")
    : threadPeopleLabel(visible, people);

  function saveRow(row: ChatListRow) {
    saveChatThread(row.rootId);
  }

  function blockedSave() {
    setReadHint(true);
    window.setTimeout(() => setReadHint(false), 2200);
  }

  return (
    <div className="space-y-4">
      {!inThread ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-4xl text-navy">{t(lang, "chatTitle")}</h1>
              {master ? (
                <GhostButton className="mt-2 min-h-11 bg-sand text-xs" onClick={() => setPdfOpen(true)}>
                  {t(lang, "chatPdf")}
                </GhostButton>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t(lang, "chatNew")}
              data-testid="chat-new"
              className="shrink-0"
              onClick={openNew}
            >
              <ActionPng name="chatPlus" px={64} />
            </button>
          </div>
          <button
            type="button"
            data-testid="chat-saved-toggle"
            className="text-left text-sm font-semibold text-navy"
            onClick={() => setShowSaved((v) => !v)}
          >
            {t(lang, "chatSavedChats")}
          </button>
          {showSaved ? (
            lists.saved.length ? (
              <ul className="space-y-2" data-testid="chat-saved-list">
                {lists.saved.map((row) => (
                  <li key={row.id}>
                    <ChatListButton row={row} lang={lang} onOpen={() => openRow(row.id, row.rootId)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-list leading-[1.4] text-ink" data-testid="chat-saved-empty">
                {t(lang, "chatSavedEmpty")}
              </p>
            )
          ) : null}
          {readHint ? (
            <p className="text-sm font-medium text-brick" data-testid="chat-read-first">
              {t(lang, "chatReadFirst")}
            </p>
          ) : null}
          {lists.active.length === 0 && !showSaved ? <p className="text-list leading-[1.4] text-ink">{t(lang, "chatEmpty")}</p> : null}
          <ul className="space-y-2" data-testid="chat-active-list">
            {lists.active.map((row) => (
              <li key={row.id}>
                <ChatSwipeRow
                  row={row}
                  lang={lang}
                  onOpen={() => openRow(row.id, row.rootId)}
                  onSave={() => saveRow(row)}
                  onBlocked={blockedSave}
                />
              </li>
            ))}
          </ul>
          {master ? <LogSearch lang={lang} logs={logs} /> : null}
        </>
      ) : (
        <div className="chat-thread fixed inset-0 z-[55] flex flex-col pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <div className="flex shrink-0 items-center gap-2 px-3 py-2">
            <ThreadBack onClick={closeThread} label={t(lang, "back")} />
            <p className="min-w-0 flex-1 truncate text-center text-[15px] font-medium text-[#fffaf6]">{headerNames || t(lang, "chatNew")}</p>
            <span className="inline-flex size-11 shrink-0" aria-hidden />
          </div>
          <div className="shrink-0 px-3 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => (
                <TargetChip key={p.id} active={picked.includes(p.id)} onClick={() => togglePerson(p.id)}>
                  {p.name}
                </TargetChip>
              ))}
            </div>
            {needTo ? <p className="mt-2 text-sm text-[#c45c3e]">{t(lang, "chatNeedTo")}</p> : null}
          </div>
          <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {visible.length === 0 ? <p className="text-sm text-[#9aa3a6]">{t(lang, "chatEmpty")}</p> : null}
            {visible.map((m, i) => (
              <ChatBubble
                key={m.id}
                msg={m}
                lang={lang}
                me={me}
                people={employees}
                last={i === visible.length - 1}
                onMore={() => setActionMsg(m)}
              />
            ))}
          </ul>
          <div className="shrink-0 px-3 pb-2">
            {photos.length || files.length ? (
              <div className="mb-2">
                <ul className="flex gap-2 overflow-x-auto">
                  {photos.map((p) => (
                    <li key={p.id} className="relative shrink-0">
                      <img src={p.dataUrl} alt="" className="size-16 rounded-[20px] object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-[#1c2428]/80 text-xs text-[#fffaf6]"
                        onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                        aria-label="Fjern"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {files.map((f) => (
                    <li key={f.id} className="flex size-16 items-center justify-center rounded-[20px] bg-[#fffaf6] px-1 text-center text-[10px] leading-tight text-[#1c1917]">
                      {f.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mx-auto flex w-full max-w-lg items-stretch overflow-hidden" style={{ borderRadius: 28 }}>
              <textarea
                rows={4}
                className="min-h-[6.5rem] min-w-0 flex-1 resize-none bg-[#fffaf6] px-4 py-3 text-base leading-snug text-[#1c1917] placeholder:text-[#9aa3a6]"
                placeholder={t(lang, "chatReplyPh")}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="button"
                className="inline-flex w-[104px] shrink-0 items-center justify-center disabled:opacity-40"
                style={{ minWidth: 104, minHeight: 104, background: "#c45c3e" }}
                disabled={busy || (!text.trim() && !photos.length && !files.length)}
                onClick={() => void send(text, false)}
                aria-label={t(lang, "chatSend")}
              >
                <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden>
                  <path fill="#fff" d="M3.2 20.7 21.5 12 3.2 3.3v6.6l11.2 2.1L3.2 14.1z" />
                </svg>
              </button>
            </div>
            <div className="mx-auto mt-2 flex w-full max-w-lg items-center justify-center overflow-hidden bg-[#fffaf6]" style={{ borderRadius: 28 }}>
              <FilePick
                label={t(lang, "camera")}
                hideLabel
                icon={<ActionPng name="camCompact" px={88} />}
                accept="image/*"
                capture
                testId="chat-camera-input"
                onFiles={(list) => void addFiles(list)}
                className="inline-flex h-[104px] min-w-0 flex-1 items-center justify-center"
              />
              <FilePick
                label={t(lang, "gallery")}
                hideLabel
                icon={<ActionPng name="gallery" px={88} />}
                accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                testId="chat-gallery-input"
                onFiles={(list) => void addFiles(list)}
                className="inline-flex h-[104px] min-w-0 flex-1 items-center justify-center"
              />
              <FilePick
                label={t(lang, "chatVideo")}
                hideLabel
                icon={<ActionPng name="video" px={88} />}
                accept="video/*"
                capture
                onFiles={(list) => void addFiles(list)}
                className="inline-flex h-[104px] min-w-0 flex-1 items-center justify-center"
              />
              <FilePick
                label={t(lang, "chatFile")}
                hideLabel
                icon={<ActionPng name="fileDoc" px={88} />}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                multiple
                onFiles={(list) => void addFiles(list)}
                className="inline-flex h-[104px] min-w-0 flex-1 items-center justify-center"
              />
              <button
                type="button"
                className={`inline-flex h-[104px] min-w-0 flex-1 items-center justify-center ${rec ? "ring-2 ring-inset ring-[#c45c3e]" : ""}`}
                onClick={() => void toggleRec()}
                aria-label={rec ? t(lang, "chatStop") : t(lang, "chatSpeak")}
              >
                {rec ? <Square className="size-10 text-[#c45c3e]" /> : <ActionPng name="mic" px={88} />}
              </button>
            </div>
            {rec ? <p className="mt-2 text-xs text-[#c45c3e]">{t(lang, "chatListening")}</p> : null}
            {busy && !rec ? <p className="mt-2 text-xs text-[#9aa3a6]">{t(lang, "voiceThink")}</p> : null}
          </div>
          {actionMsg ? (
            <MsgActionSheet
              lang={lang}
              msg={actionMsg}
              onClose={() => setActionMsg(null)}
              onHear={() => {
                hear(shownText(actionMsg, me.language, me.role));
                setActionMsg(null);
              }}
              onTodo={() => {
                makeTodoFrom(actionMsg);
                setActionMsg(null);
              }}
              onClassify={
                master
                  ? (as) => {
                      classify(actionMsg, as);
                      setActionMsg(null);
                    }
                  : undefined
              }
              onRemove={() => {
                hideChat(actionMsg.id, me.id);
                setActionMsg(null);
              }}
            />
          ) : null}
        </div>
      )}
      {pdfOpen ? <ChatPdfSheet lang={lang} msgs={chats.filter((m) => chatVisible(m, me, assignments))} people={employees} onClose={() => setPdfOpen(false)} /> : null}
      {needId ? <NeedOrderSheet lang={lang} needId={needId} onClose={() => setNeedId(null)} /> : null}
      {classAsk ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-sand px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]" data-testid="chat-need-job">
          <p className="font-display text-title text-ink">{t(lang, "chatNeedJob")}</p>
          <ul className="mt-3 space-y-1.5">
            {projects.filter((p) => p.status === "active").map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full rounded-xl bg-paper px-3 py-3 text-left text-list shadow-card"
                  onClick={() => applyClassify(classAsk.msg, classAsk.kind, p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <input
            className="mt-4 min-h-11 w-full rounded-xl bg-paper px-3 text-list"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            placeholder={t(lang, "chatCreateJob")}
          />
          <GhostButton
            className="mt-2 bg-paper"
            onClick={() => {
              const name = newJobName.trim();
              if (!name) return;
              void (async () => {
                const res = await createSagOnDrive({
                  name,
                  address: "",
                  lat: 0,
                  lng: 0,
                  createdBy: me.id,
                  lang,
                });
                if (!res.ok) return;
                applyClassify(classAsk.msg, classAsk.kind, res.id);
                setNewJobName("");
              })();
            }}
          >
            {t(lang, "chatCreateJob")}
          </GhostButton>
          <GhostButton className="mt-2" onClick={() => { setClassAsk(null); setNewJobName(""); }}>
            {t(lang, "close")}
          </GhostButton>
        </div>
      ) : null}
    </div>
  );
}

function ChatSwipeRow({
  row,
  lang,
  onOpen,
  onSave,
  onBlocked,
}: {
  row: ChatListRow;
  lang: Lang;
  onOpen: () => void;
  onSave: () => void;
  onBlocked: () => void;
}) {
  const x0 = useRef<number | null>(null);
  const y0 = useRef(0);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  function down(e: PointerEvent<HTMLDivElement>) {
    x0.current = e.clientX;
    y0.current = e.clientY;
    dragging.current = false;
    moved.current = false;
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (x0.current == null) return;
    const d = e.clientX - x0.current;
    const adx = Math.abs(d);
    const ady = Math.abs(e.clientY - y0.current);
    if (!dragging.current) {
      if (adx < 10 && ady < 10) return;
      if (ady > adx) {
        x0.current = null;
        return;
      }
      dragging.current = true;
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const next = Math.max(-120, Math.min(0, d));
    dxRef.current = next;
    setDx(next);
  }

  function up() {
    if (dragging.current && dxRef.current < -56) {
      if (row.unread > 0) onBlocked();
      else onSave();
    }
    x0.current = null;
    dragging.current = false;
    dxRef.current = 0;
    setDx(0);
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl" data-testid={`chat-row-${row.id}`}>
      <div className="absolute inset-y-0 right-0 flex w-[7.5rem] items-center justify-center bg-brick text-sm font-semibold text-sand" aria-hidden>
        {t(lang, "chatGem")}
      </div>
      <div
        className="relative"
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <ChatListButton row={row} lang={lang} onOpen={() => { if (!moved.current) onOpen(); }} />
      </div>
    </div>
  );
}

function ChatListButton({ row, lang, onOpen }: { row: ChatListRow; lang: Lang; onOpen: () => void }) {
  const hot = row.unread > 0;
  const initials = (row.peopleLabel || row.title)
    .split(",")[0]
    ?.trim()
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  return (
    <button
      type="button"
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${hot ? "bg-brick text-sand ring-2 ring-brick-soft" : "bg-paper text-ink shadow-card"}`}
      onClick={onOpen}
    >
      <span className={`relative inline-flex size-12 shrink-0 items-center justify-center rounded-full font-display text-base font-semibold ${hot ? "bg-sand text-brick" : "bg-navy text-sand"}`}>
        {initials}
        {hot ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-sand ring-2 ring-brick" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-title text-ink">{row.peopleLabel || row.title}</span>
          <span className={`shrink-0 text-sender ${hot ? "font-bold text-sand" : "text-ink"}`}>{copenhagenTime(row.at)}</span>
        </span>
        <span className={`mt-0.5 block truncate text-list leading-[1.4] ${hot ? "font-semibold text-sand" : "text-ink"}`}>{row.title}</span>
      </span>
      {hot ? (
        <span className="inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-sand px-2 text-sm font-bold text-brick">
          {row.unread}
        </span>
      ) : null}
      <span className="sr-only">{hot ? t(lang, "chatUnread") : ""}</span>
    </button>
  );
}

export function UnreadChatBanner({ lang, count, onOpen }: { lang: Lang; count: number; onOpen: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-brick px-4 py-3 text-left text-sand shadow-card"
    >
      <span>
        <span className="block font-display text-2xl leading-none">{t(lang, "chatNewCount", { n: count })}</span>
        <span className="text-sm text-sand/90">{t(lang, "chatHintShort")}</span>
      </span>
      <span className="rounded-full bg-sand px-3 py-1 text-sm font-bold text-brick">{t(lang, "chatOpen")}</span>
    </button>
  );
}

function FilePick({
  label,
  icon,
  accept,
  capture,
  multiple,
  testId,
  onFiles,
  className,
  hideLabel,
}: {
  label: string;
  icon: ReactNode;
  accept: string;
  capture?: boolean;
  multiple?: boolean;
  testId?: string;
  onFiles: (files: File[]) => void;
  className: string;
  hideLabel?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className={`${className} cursor-pointer`} title={label}>
      {icon}
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        data-testid={testId}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const list = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (list.length) onFiles(list);
        }}
      />
    </label>
  );
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => resolve("");
    r.readAsDataURL(file);
  });
}

function ThreadBack({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid="back-arrow"
      onClick={onClick}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#fffaf6]"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M15 5 8 12l7 7" fill="none" stroke="#1c2428" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function TargetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full px-3 text-xs font-medium ${active ? "bg-[#fffaf6] text-[#1c1917]" : "border border-[#fffaf6]/70 bg-transparent text-[#fffaf6]"}`}
    >
      {children}
    </button>
  );
}

function ChatBubble({
  msg,
  lang,
  me,
  people,
  last,
  onMore,
}: {
  msg: ChatMessage;
  lang: Lang;
  me: Employee;
  people: Employee[];
  last: boolean;
  onMore: () => void;
}) {
  const mine = msg.fromId === me.id && !msg.fromAgent;
  const who = people.find((p) => p.id === msg.fromId);
  const viewLang = isMasterRole(me.role) ? "da" : me.language;
  const whoName = msg.fromAgent ? t(lang, "voiceAgent") : (who?.name ?? "—");
  const hold = useRef<number | null>(null);
  function down() {
    hold.current = window.setTimeout(() => onMore(), 450);
  }
  function up() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className="chat-lap-paper max-w-[82%] px-3.5 py-2.5"
        style={{ background: mine ? "#fffaf6" : "#fffaf6" }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      >
        <UserText
          original={msg.original}
          translations={msg.translations}
          lang={viewLang}
          role={me.role}
          className="chat-lap"
          linkClass="mt-1 text-xs font-medium text-[#1c1917]/60 underline underline-offset-2"
        />
        {msg.photos?.length ? (
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {msg.photos.map((p) => (
              <li key={p.id}>
                {p.dataUrl ? (
                  <img src={p.dataUrl} alt="" className="aspect-square w-full min-h-28 rounded-[20px] object-cover" />
                ) : p.driveFileId ? (
                  <DriveFileThumb fileId={p.driveFileId} className="aspect-square w-full min-h-28 rounded-[20px] object-cover" />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {msg.files?.length ? (
          <ul className="mt-1 space-y-1">
            {msg.files.map((f) => (
              <li key={f.id} className="text-xs text-[#1c1917]/70">
                {f.kind} · {f.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="mt-1 px-1 text-sm text-[#9aa3a6]">
        {copenhagenTime(msg.at)} · {firstNameOf(whoName)}
      </p>
      {last ? (
        <button
          type="button"
          data-testid="chat-more"
          aria-label="Mere"
          onClick={onMore}
          className="mt-1 inline-flex size-8 items-center justify-center rounded-full bg-[#fffaf6] text-[#1c1917]"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M6 9l6 6 6-6" fill="none" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </li>
  );
}

function MsgActionSheet({
  lang,
  msg,
  onClose,
  onHear,
  onTodo,
  onClassify,
  onRemove,
}: {
  lang: Lang;
  msg: ChatMessage;
  onClose: () => void;
  onHear: () => void;
  onTodo: () => void;
  onClassify?: (as: InboxClass) => void;
  onRemove: () => void;
}) {
  const y0 = useRef<number | null>(null);
  function down(e: PointerEvent<HTMLDivElement>) {
    y0.current = e.clientY;
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (y0.current != null && e.clientY - y0.current > 56) onClose();
    y0.current = null;
  }
  const showClass = Boolean(onClassify && !msg.classifiedAs && !msg.fromAgent);
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/40" onClick={onClose} data-testid="chat-action-sheet">
      <div
        className="w-full bg-[#fffaf6] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderRadius: "28px 28px 0 0" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={down}
        onPointerUp={up}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#1c1917]/20" />
        <div className="flex flex-wrap justify-center gap-2">
          {!msg.fromAgent ? (
            <button type="button" className="inline-flex size-14 flex-col items-center justify-center" onClick={onTodo} aria-label={t(lang, "sendAsTodo")}>
              <SagPng name="todo" px={44} />
            </button>
          ) : null}
          {showClass
            ? CHAT_CLASSIFY.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="inline-flex size-14 items-center justify-center"
                  data-testid={`chat-class-${k}`}
                  onClick={() => onClassify?.(k)}
                  aria-label={t(lang, pileLabelKey(k))}
                >
                  <SagPng name={CLASS_ICON[k]} px={44} />
                </button>
              ))
            : null}
          <button type="button" className="inline-flex min-h-14 min-w-14 flex-col items-center justify-center px-2 text-xs text-[#1c1917]" onClick={onHear}>
            <Volume2 className="size-5" />
            {t(lang, "chatHear")}
          </button>
          {!msg.fromAgent ? (
            <button type="button" className="inline-flex min-h-14 items-center px-2 text-xs text-[#1c1917]" onClick={onRemove}>
              {t(lang, "chatRemove")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
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
        <p className="mt-1 text-sm text-muted">
          {copenhagenDate()} · {msgs.length}
        </p>
        <ul className="mt-6 space-y-4">
          {msgs.map((m) => {
            const who = people.find((p) => p.id === m.fromId)?.name ?? m.fromId;
            const job = projects.find((p) => p.id === m.projectId)?.name ?? m.projectId;
            const da = m.translations.da ?? m.original;
            return (
              <li key={m.id} className="break-inside-avoid border-b border-line pb-3">
                <p className="text-xs text-muted">
                  {who} · {copenhagenTime(m.at)} · {job}
                  {m.lat != null && m.lng != null ? (
                    <>
                      {" · "}
                      <GpsLink lat={m.lat} lng={m.lng} label={m.gpsLabel || t(lang, "gpsMaps")} />
                    </>
                  ) : null}
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
    <Card className="rounded-[20px]">
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
    </Card>
  );
}
