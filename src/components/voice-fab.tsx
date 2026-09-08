import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, ImagePlus, Mic, Square, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { compressImageFile } from "@/lib/field-media";
import { setCrewSag } from "@/lib/crew-sag";
import { useSessionEmployee } from "@/lib/store";
import { startRecording } from "@/lib/voice-client";
import { voiceEphemeralToken, voiceTurn } from "@/lib/voice-agent.functions";
import { applyVoiceActions, yardVoiceSnap } from "@/lib/voice-apply";
import { onVoiceRequest } from "@/lib/voice-bus";
import { splitDataUrl, type VoiceClientAction, type VoicePending } from "@/lib/voice-agent";
import type { Lang } from "@/lib/types";

type Status = "idle" | "listen" | "think" | "work" | "speak";
type DraftPhoto = { id: string; dataUrl: string; name: string };

export function VoiceFab({ lang, placement = "float" }: { lang: Lang; placement?: "float" | "header" }) {
  const me = useSessionEmployee();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [line, setLine] = useState("");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [micFail, setMicFail] = useState(false);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const pendingRef = useRef<VoicePending | null>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const genRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const holdTimer = useRef<number>(0);
  const holding = useRef(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      recRef.current = null;
    };
  }, []);

  useEffect(() => {
    return onVoiceRequest((req) => {
      if (req.projectId) setCrewSag(req.projectId);
      setOpen(true);
      if (req.text) void sendTurn({ text: req.text });
    });
  }, [lang]);

  if (!me) return null;

  function statusLabel() {
    if (status === "listen") return t(lang, "voiceListen");
    if (status === "think") return t(lang, "voiceThink");
    if (status === "work") return t(lang, "voiceWork");
    if (status === "speak") return t(lang, "voiceSpeak");
    return t(lang, "voiceHold");
  }

  function interrupt() {
    genRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (recRef.current) {
      void recRef.current.stop().catch(() => null);
      recRef.current = null;
    }
    holding.current = false;
    setStatus("idle");
  }

  async function playAudio(src: string | null | undefined) {
    if (!src) return;
    try {
      audioRef.current?.pause();
      const el = new Audio(src);
      audioRef.current = el;
      setStatus("speak");
      await el.play();
      await new Promise<void>((resolve) => {
        el.onended = () => resolve();
        el.onerror = () => resolve();
      });
    } catch {
      /* autoplay */
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: DraftPhoto[] = [];
    for (const file of [...list]) {
      try {
        const made = await compressImageFile(file);
        if (made.dataUrl) next.push({ id: `vp-${crypto.randomUUID().slice(0, 8)}`, dataUrl: made.dataUrl, name: file.name || "foto.jpg" });
      } catch {
        /* skip */
      }
    }
    if (next.length) {
      setPhotos((cur) => [...cur, ...next].slice(0, 8));
      setOpen(true);
    }
  }

  async function sendTurn(input: { audioBase64?: string; mime?: string; text?: string; keepPhotos?: boolean }) {
    const snap = yardVoiceSnap();
    if (!snap) return;
    const attached = photos;
    const photoPayload = attached.slice(0, 8).map((p) => {
      const split = splitDataUrl(p.dataUrl);
      return { name: p.name || "foto.jpg", mimeType: split.mime, contentBase64: split.base64 };
    }).filter((p) => p.contentBase64);
    if (!input.keepPhotos) setPhotos([]);
    const gen = ++genRef.current;
    setStatus("think");
    setOpen(true);
    try {
      const res = await voiceTurn({
        data: {
          audioBase64: input.audioBase64,
          mime: input.mime,
          text: input.text,
          photos: photoPayload,
          reply: "voice",
          lang,
          folderName: "08 Voice-log",
          snap,
          history: historyRef.current,
          pending: pendingRef.current,
        },
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setLine(res.error === "empty" ? t(lang, "voiceEmpty") : t(lang, "voiceDenied"));
        setStatus("idle");
        return;
      }
      setStatus("work");
      setHeard(res.transcript);
      setLine(res.text);
      pendingRef.current = res.pending;
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, content: res.transcript },
        { role: "assistant" as const, content: res.text },
      ].slice(-8);
      applyVoiceActions((res.actions ?? []) as VoiceClientAction[]);
      await playAudio(res.audio);
      if (gen === genRef.current) setStatus("idle");
    } catch {
      if (gen === genRef.current) {
        setLine(t(lang, "voiceDenied"));
        setStatus("idle");
      }
    }
  }

  async function beginHold() {
    if (status === "think" || status === "work" || status === "speak") {
      interrupt();
      return;
    }
    holding.current = true;
    setOpen(true);
    setStatus("listen");
    void voiceEphemeralToken({ data: { role: yardVoiceSnap()?.role ?? "svend" } }).catch(() => null);
    try {
      recRef.current = await startRecording();
      setMicFail(false);
    } catch {
      recRef.current = null;
      setMicFail(true);
      setStatus("idle");
    }
  }

  async function endHold() {
    if (!holding.current) return;
    holding.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) {
      setStatus("idle");
      return;
    }
    try {
      const clip = await rec.stop();
      if (clip.base64.length < 80 && !photos.length) {
        setStatus("idle");
        setLine(t(lang, "voiceEmpty"));
        return;
      }
      await sendTurn({ audioBase64: clip.base64, mime: clip.mime });
    } catch {
      setStatus("idle");
    }
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (status === "think" || status === "work" || status === "speak" || status === "listen") {
      interrupt();
      return;
    }
    holdTimer.current = window.setTimeout(() => {
      void beginHold();
    }, 140);
  }

  function onPointerUp() {
    window.clearTimeout(holdTimer.current);
    if (holding.current || recRef.current) {
      void endHold();
      return;
    }
    setOpen(true);
  }

  async function sendTyped() {
    const q = typed.trim();
    if (!q && !photos.length) return;
    setTyped("");
    await sendTurn({ text: q });
  }

  const busy = status === "listen" || status === "think" || status === "work" || status === "speak";
  const header = placement === "header";
  const panel = open ? (
        <div className={`pointer-events-auto w-[min(92vw,20rem)] rounded-[20px] bg-paper p-3 shadow-card ${header ? "absolute right-0 top-[calc(100%+0.5rem)] z-50" : ""}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{statusLabel()}</p>
            <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-muted" onClick={() => setOpen(false)} aria-label={t(lang, "voiceClose")}>
              <X className="size-4" />
            </button>
          </div>
          {heard ? <p className="text-xs text-muted">{heard}</p> : null}
          {line ? <p className="mt-1 text-sm leading-snug text-navy">{line}</p> : <p className="text-sm text-muted">{t(lang, "voiceHold")}</p>}
          {micFail ? <p className="mt-2 text-xs text-brick">{t(lang, "voiceDenied")}</p> : null}
          {photos.length ? (
            <ul className="mt-2 flex gap-1 overflow-x-auto">
              {photos.map((p) => (
                <li key={p.id}>
                  <img src={p.dataUrl} alt="" className="size-14 rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" data-testid="voice-camera" className="inline-flex min-h-10 items-center rounded-xl bg-sand px-2 text-xs font-medium" onClick={() => camRef.current?.click()}>
              <Camera className="mr-1 size-4" />
              {t(lang, "camera")}
            </button>
            <button type="button" data-testid="voice-gallery" className="inline-flex min-h-10 items-center rounded-xl bg-sand px-2 text-xs font-medium" onClick={() => galRef.current?.click()}>
              <ImagePlus className="mr-1 size-4" />
              {t(lang, "gallery")}
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
          <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
          <div className="mt-2 flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-xl bg-sand px-3 text-sm"
              placeholder={t(lang, "voiceTypePh")}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendTyped();
              }}
            />
            <button
              type="button"
              data-testid="voice-send"
              className="min-h-11 rounded-xl bg-navy px-3 text-sm font-semibold text-sand disabled:opacity-40"
              disabled={(!typed.trim() && !photos.length) || busy}
              onClick={() => void sendTyped()}
            >
              {t(lang, "voiceSend")}
            </button>
          </div>
        </div>
      ) : null;
  const micBtn = (
      <button
        type="button"
        data-testid="voice-fab"
        aria-label={t(lang, "voiceMic")}
        className={`pointer-events-auto inline-flex items-center justify-center rounded-full shadow-card ${
          status === "listen" ? "bg-brick text-sand" : header ? "bg-navy text-sand ring-[3px] ring-sand" : "bg-navy text-sand"
        } ${header ? "size-[60px]" : "size-16"}`}
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {status === "listen" ? <Square className={header ? "size-7" : "size-6"} /> : <Mic className={header ? "size-8" : "size-7"} />}
      </button>
  );

  return (
    <div className={header
      ? "relative z-40 flex shrink-0 flex-col items-end"
      : "pointer-events-none fixed bottom-[5.5rem] right-3 z-50 flex max-w-[min(92vw,20rem)] flex-col items-end gap-2"}
    >
      {header ? (
        <>
          {micBtn}
          {panel}
        </>
      ) : (
        <>
          {panel}
          {micBtn}
        </>
      )}
    </div>
  );
}
