import { useEffect, useRef, useState } from "react";
import { ActionPng } from "@/components/sag-icons";
import { loadAssist, saveAssist } from "@/lib/assist-memory";
import { appendChatLog, uploadFieldToDrive } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import { compressImageFile, kindFromFile, videoPoster } from "@/lib/field-media";
import { readGps, siteFallback } from "@/lib/geo";
import { setCrewSag } from "@/lib/crew-sag";
import { useSessionEmployee, useYard } from "@/lib/store";
import { startRecording } from "@/lib/voice-client";
import { voiceTurn } from "@/lib/voice-agent.functions";
import { applyVoiceActions, yardVoiceSnap } from "@/lib/voice-apply";
import { splitDataUrl, type VoiceClientAction, type VoicePending } from "@/lib/voice-agent";
import type { FieldItem, FieldKind, Lang, Project } from "@/lib/types";

type ChatLine = { who: "me" | "bot"; text: string };
type Draft = { id: string; kind: FieldKind; name: string; mimeType: string; dataUrl?: string; file?: File };

export function CrewSagBot({ project, lang }: { project: Project; lang: Lang }) {
  const me = useSessionEmployee();
  const addFieldItems = useYard((s) => s.addFieldItems);
  const patchFieldItem = useYard((s) => s.patchFieldItem);
  const setInboxFolder = useYard((s) => s.setInboxFolder);
  const key = `crew-sag:${project.id}:${me?.id ?? "x"}:${lang}`;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [messages, setMessages] = useState<ChatLine[]>(() => loadAssist(key));
  const pendingRef = useRef<VoicePending | null>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCrewSag(project.id);
  }, [project.id]);

  useEffect(() => {
    setMessages(loadAssist(key));
    setQ("");
    setDrafts([]);
  }, [key]);

  useEffect(() => {
    saveAssist(key, messages);
  }, [key, messages]);

  async function pushDrive(it: FieldItem) {
    const text = [
      "ZENKO PLADS — feltfil (indbakke)",
      `Sag: ${it.projectName}`,
      `Ansat: ${it.employeeName}`,
      `Tid: ${it.takenAt}`,
      `Type: ${it.kind}`,
      `Fil: ${it.name}`,
      `Note: ${it.note || "AI-hjælper"}`,
    ].join("\n");
    try {
      const res = await uploadFieldToDrive({
        data: {
          projectId: it.projectId,
          name: it.name,
          mimeType: it.mimeType,
          note: it.note,
          employeeName: it.employeeName,
          kind: it.kind,
          text,
        },
      });
      if (res.ok && res.fileId) {
        if (res.folderId) setInboxFolder(it.projectId, res.folderId);
        patchFieldItem(it.id, {
          driveFileId: res.fileId,
          driveFolderId: res.folderId,
          driveUrl: `https://drive.google.com/file/d/${res.fileId}/view`,
        });
      } else {
        useYard.setState({ toast: t(lang, "driveFail") });
      }
    } catch {
      useYard.setState({ toast: t(lang, "driveFail") });
    }
  }

  async function attachFiles(list: FileList | null, force?: FieldKind) {
    if (!list?.length || !me) return;
    const gps = (await readGps(2500)) ?? siteFallback(project);
    const items: FieldItem[] = [];
    const next: Draft[] = [];
    for (const file of [...list]) {
      const kind = force ?? kindFromFile(file);
      let dataUrl: string | undefined;
      if (kind === "photo") {
        try {
          dataUrl = (await compressImageFile(file)).dataUrl;
        } catch {
          dataUrl = undefined;
        }
      } else if (kind === "video") {
        dataUrl = await videoPoster(file);
      }
      const draft: Draft = {
        id: `fld-${crypto.randomUUID().slice(0, 8)}`,
        kind,
        name: file.name || `${kind}-${Date.now()}`,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
        file,
      };
      next.push(draft);
      items.push({
        id: draft.id,
        projectId: project.id,
        projectName: project.name,
        employeeId: me.id,
        employeeName: me.name,
        kind,
        name: draft.name,
        mimeType: draft.mimeType,
        dataUrl,
        note: "AI",
        takenAt: new Date().toISOString(),
        lat: gps.lat,
        lng: gps.lng,
        gpsLabel: project.name,
        status: "inbox",
      });
    }
    if (next.length) setDrafts((cur) => [...cur, ...next].slice(0, 8));
    if (items.length) {
      addFieldItems(items);
      for (const it of items) void pushDrive(it);
    }
  }

  async function send(raw?: string, audio?: { base64: string; mime: string }) {
    const query = (raw ?? q).trim();
    const photos = drafts.filter((d) => d.kind === "photo" && d.dataUrl);
    if ((!query && !photos.length && !audio) || busy) return;
    const line = query || (audio ? "…" : t(lang, "crewSagPhoto"));
    setMessages((m) => [...m, { who: "me", text: query || (photos.length ? t(lang, "crewSagPhoto") : line) }]);
    setQ("");
    setBusy(true);
    const attached = drafts;
    setDrafts([]);
    const snap = yardVoiceSnap();
    try {
      const payload = photos.map((d) => {
        const split = splitDataUrl(d.dataUrl!);
        return { name: d.name, mimeType: split.mime, contentBase64: split.base64 };
      });
      const res = snap
        ? await voiceTurn({
            data: {
              text: query || undefined,
              audioBase64: audio?.base64,
              mime: audio?.mime,
              photos: payload,
              reply: audio ? "voice" : "text",
              lang,
              folderName: "08 Voice-log",
              snap: { ...snap, checkedInProjectId: project.id },
              history: historyRef.current,
              pending: pendingRef.current,
            },
          })
        : { ok: false as const, text: "", actions: [] as VoiceClientAction[], pending: null, transcript: line };
      const text = res.ok ? res.text : t(lang, "unknownAsk");
      if (res.ok) {
        pendingRef.current = res.pending;
        historyRef.current = [
          ...historyRef.current,
          { role: "user" as const, content: res.transcript || line },
          { role: "assistant" as const, content: res.text },
        ].slice(-8);
        applyVoiceActions((res.actions ?? []) as VoiceClientAction[]);
        if (audio && "audio" in res && res.audio) {
          try {
            const el = new Audio(res.audio as string);
            void el.play();
          } catch {
            /* autoplay */
          }
        }
      }
      setMessages((m) => [...m, { who: "bot", text }]);
      void appendChatLog({
        data: {
          projectId: project.id,
          title: line.slice(0, 40),
          employeeName: me?.name ?? "Ansat",
          text: [
            `SAG-BOT ${project.name}`,
            `Ansat: ${me?.name} (${lang})`,
            `Tid: ${new Date().toISOString()}`,
            `Spørgsmål: ${line}`,
            attached.length ? `Filer: ${attached.map((d) => d.name).join(", ")}` : "",
            `Svar: ${text}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function tapMic() {
    if (busy) return;
    if (rec && recRef.current) {
      setRec(false);
      try {
        const clip = await recRef.current.stop();
        recRef.current = null;
        await send(q, { base64: clip.base64, mime: clip.mime });
      } catch {
        recRef.current = null;
      }
      return;
    }
    try {
      recRef.current = await startRecording();
      setRec(true);
    } catch {
      recRef.current = null;
    }
  }

  return (
    <section className="overflow-hidden rounded-[20px] shadow-card" data-testid="crew-ai">
      <div className="px-4 py-3" style={{ background: "#1c2428" }}>
        <div className="flex items-center gap-2">
          <span className="inline-flex overflow-hidden rounded-[20px]">
            <ActionPng name="robot" px={64} />
          </span>
          <p className="font-display text-2xl tracking-wide text-sand">AI</p>
        </div>
        <p className="mt-2 text-base leading-snug text-sand">{t(lang, "aiIntro1")}</p>
        <p className="text-base leading-snug text-sand">{t(lang, "aiIntro2")}</p>
      </div>
      {messages.length ? (
        <div className="max-h-48 space-y-2 overflow-y-auto px-3 py-3">
          {messages.map((m, i) => (
            <p
              key={`${m.who}-${i}`}
              className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-snug ${m.who === "me" ? "ml-8 bg-navy text-sand" : "mr-6 bg-sand text-ink"}`}
            >
              {m.text}
            </p>
          ))}
          {busy ? <p className="text-sm text-muted">{t(lang, "crewSagLooking")}</p> : null}
        </div>
      ) : busy ? (
        <p className="px-3 py-2 text-sm text-muted">{t(lang, "crewSagLooking")}</p>
      ) : null}
      {drafts.length ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {drafts.map((d) =>
            d.dataUrl && d.kind === "photo" ? (
              <img key={d.id} src={d.dataUrl} alt="" className="size-10 rounded-lg object-cover" />
            ) : (
              <span key={d.id} className="max-w-[7rem] truncate rounded-lg bg-sand px-2 py-1 text-[11px]">
                {d.name}
              </span>
            ),
          )}
        </div>
      ) : null}
      <div className="px-3 py-3">
        <div className="flex items-stretch gap-2">
          <textarea
            className="min-h-14 min-w-0 flex-1 rounded-xl bg-sand px-3 py-2 text-lg"
            placeholder={t(lang, "aiWrite")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="button" aria-label={t(lang, "fieldSpeak")} data-testid="ai-mic" className={`inline-flex min-h-[3.25rem] min-w-[3.25rem] shrink-0 items-center justify-center ${rec ? "rounded-xl ring-2 ring-brick" : ""}`} onClick={() => void tapMic()}>
            <ActionPng name="mic" px={68} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 rounded-[20px] px-1 py-1" style={{ background: "#f6f1ea" }}>
          <button type="button" aria-label={t(lang, "fieldPhoto")} data-testid="ai-cam" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" onClick={() => camRef.current?.click()}>
            <ActionPng name="camCompact" px={68} />
          </button>
          <button type="button" aria-label={t(lang, "fieldVideo")} data-testid="ai-video" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" onClick={() => vidRef.current?.click()}>
            <ActionPng name="video" px={68} />
          </button>
          <button type="button" aria-label={t(lang, "fieldFile")} data-testid="ai-file" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" onClick={() => fileRef.current?.click()}>
            <ActionPng name="fileDoc" px={68} />
          </button>
          <button type="button" aria-label={t(lang, "chatSend")} data-testid="ai-send" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" disabled={busy} onClick={() => void send()}>
            <ActionPng name="send" px={68} />
          </button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void attachFiles(e.target.files, "photo")} />
        <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void attachFiles(e.target.files, "video")} />
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => void attachFiles(e.target.files)} />
      </div>
    </section>
  );
}
