import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { AssistChat, type ChatLine } from "@/components/assist-chat";
import { loadAssist, saveAssist } from "@/lib/assist-memory";
import { askMasterDesk } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import type { Lang, Project } from "@/lib/types";

const CHIPS_HILLEROD = [
  { label: "Bindere / m²", q: "Hvor mange bindere pr. m², og hvad siger udbuddet?" },
  { label: "Sidste byggemøde", q: "Hvad blev der aftalt på sidste byggemøde? Næste møde?" },
  { label: "LIN", q: "Hvad har LIN aftalt — tilkøb, option, underskrift?" },
  { label: "Mørtel på nettet", q: "Hvilken kalkmørtel til omfugning, og hvad siger producenten om temperatur?" },
];

const CHIPS_ISLEV = [
  { label: "Fuger / mørtel", q: "Hvor dybt skal fuger udkradses, og hvilken mørtel?" },
  { label: "Puds Fortvej", q: "Puds og filts på gavle røde huse Fortvej?" },
  { label: "Skorsten 85/15", q: "Hvordan udbedres skorstenene — omfug eller ny?" },
  { label: "Afsyring?", q: "Må vi afsyre murværket på Islevvænge?" },
];

export function MasterSagBot({ project, lang, brief }: { project: Project; lang: Lang; brief?: string }) {
  const key = `master-sag:${project.id}`;
  const hello = t(lang, "masterSagHello");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    const saved = loadAssist(key);
    return saved.length ? saved : [{ who: "bot", text: hello }];
  });

  useEffect(() => {
    const saved = loadAssist(key);
    setMessages(saved.length ? saved : [{ who: "bot", text: t(lang, "masterSagHello") }]);
    setQ("");
  }, [key, lang]);

  useEffect(() => {
    saveAssist(key, messages);
  }, [key, messages]);

  async function send(raw?: string) {
    const query = (raw ?? q).trim();
    if (!query || busy) return;
    setQ("");
    setMessages((m) => [...m, { who: "me", text: query }]);
    setBusy(true);
    const history = messages.slice(-6).map((m) => ({
      role: m.who === "me" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
    try {
      const res = await askMasterDesk({
        data: { projectId: project.id, projectName: project.name, query, history, brief },
      });
      const text = res.line || t(lang, "unknownAsk");
      setMessages((m) => [...m, { who: "bot", text, used: res.used }]);
    } catch {
      setMessages((m) => [...m, { who: "bot", text: t(lang, "unknownAsk") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AssistChat
      icon={<Bot className="size-5" />}
      title={t(lang, "masterSagBot")}
      hint={t(lang, "masterSagHint")}
      messages={messages}
      chips={project.id === "job-islevvaenge" ? CHIPS_ISLEV : CHIPS_HILLEROD}
      placeholder={t(lang, "masterSagPh")}
      busy={busy}
      busyText={t(lang, "masterSagLooking")}
      value={q}
      onChange={setQ}
      onSend={(v) => void send(v)}
      lang={lang}
    />
  );
}
