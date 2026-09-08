import type { Lang } from "./types";

export function langBcp(lang: Lang) {
  return { da: "da-DK", es: "es-ES", pl: "pl-PL", ro: "ro-RO", uk: "uk-UA", de: "de-DE", en: "en-GB" }[lang];
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

export async function startRecording(): Promise<{ stop: () => Promise<{ base64: string; mime: string }> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise((resolve, reject) => {
        rec.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          reject(new Error("rec"));
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          void blobToBase64(blob).then((base64) => resolve({ base64, mime: rec.mimeType || "audio/webm" }));
        };
        rec.stop();
      }),
  };
}

export function browserListen(lang: Lang): Promise<string | null> {
  const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition })
    .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
  if (!Ctor) return Promise.resolve(null);
  return new Promise((resolve) => {
    const rec = new Ctor();
    rec.lang = langBcp(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const timer = window.setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      resolve(null);
    }, 12000);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      window.clearTimeout(timer);
      resolve(e.results[0]?.[0]?.transcript?.trim() || null);
    };
    rec.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    rec.start();
  });
}

export function localSpeak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langBcp(lang);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
