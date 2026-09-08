import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { AssistChat, type ChatLine } from "@/components/assist-chat";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { loadAssist, saveAssist } from "@/lib/assist-memory";
import { askUdbud, listUdbudFiles } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

const CHIPS_HILLEROD = [
  { label: "Hulmursisolering?", q: "Hvilken hulmursisolering skal vi bruge, og hvad er λD?" },
  { label: "Tegl?", q: "Hvilken tegl / maskinsten står der i udbuddet?" },
  { label: "Mørtel?", q: "Hvilken mørtel til opmuring og omfugning?" },
  { label: "Stillads?", q: "Hvem leverer stillads, og må Zenko røre fodplader?" },
  { label: "Omfugning?", q: "Hvad siger udbuddet om omfugning — dybde, mørtel, temperatur?" },
  { label: "Bindere?", q: "Hvor mange bindere pr. m², dimension og indboring?" },
];

const CHIPS_ISLEV = [
  { label: "Fuger?", q: "Hvor dybt skal fuger udkradses, og hvilken mørtel?" },
  { label: "Puds gavle?", q: "Hvad siger udbuddet om puds og filts på gavle røde huse Fortvej?" },
  { label: "Sten?", q: "Hvilken teglsten til udskiftning i facaden?" },
  { label: "Afsyring?", q: "Må vi afsyre murværket?" },
  { label: "Skorsten?", q: "Hvordan udbedres skorstenene — omfug eller ny?" },
  { label: "Tagfod?", q: "Hvad er ekstra murværk ved tag — hvor mange skifter?" },
];

export function UdbudAsk({ projectId, lang }: { projectId: string; lang: Lang; compact?: boolean; onUnknown?: (q: string) => void }) {
  const key = `udbud:${projectId}`;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ name: string }[]>([]);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | undefined>();
  const hello = t(lang, "udbudBotHello");
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    const saved = loadAssist(key);
    return saved.length ? saved : [{ who: "bot", text: hello }];
  });

  useEffect(() => {
    const saved = loadAssist(key);
    setMessages(saved.length ? saved : [{ who: "bot", text: hello }]);
    setQ("");
    void listUdbudFiles({ data: { projectId } }).then((r) => {
      setFiles(r.files);
      setLoginRequired(Boolean(r.loginRequired));
      setLoginUrl(r.loginUrl);
    });
  }, [projectId, hello, key]);

  useEffect(() => {
    saveAssist(key, messages);
  }, [key, messages]);

  async function send(preset?: string) {
    const query = (preset ?? q).trim();
    if (!query || busy) return;
    setQ("");
    setMessages((m) => [...m, { who: "me", text: query }]);
    setBusy(true);
    const history = messages
      .filter((x) => x.who === "me" || x.who === "bot")
      .slice(-6)
      .map((x) => ({ role: x.who === "me" ? ("user" as const) : ("assistant" as const), content: x.text }));
    try {
      const res = await askUdbud({ data: { projectId, query, history } });
      if (res.loginRequired) {
        setLoginRequired(true);
        setLoginUrl(res.loginUrl);
      }
      if (res.files.length) setFiles(res.files);
      const line = res.line || t(lang, "udbudNoHit");
      setMessages((m) => [...m, { who: "bot", text: line, used: res.used }]);
    } catch {
      setMessages((m) => [...m, { who: "bot", text: t(lang, "udbudNoHit") }]);
    } finally {
      setBusy(false);
    }
  }

  const fileLine = files.length ? files.slice(0, 6).map((f) => f.name.replace(/^K01_C08_0*/, "").replace(/\.pdf$/i, "")).join(" · ") : "";

  return (
    <AssistChat
      icon={<FileSearch className="size-5" />}
      title={t(lang, "udbudBotName")}
      hint={fileLine ? `${files.length} filer: ${fileLine}` : t(lang, "udbudBotHint")}
      status={loginRequired ? { label: t(lang, "driveLogin"), tone: "sand" } : files.length ? { label: t(lang, "udbudFromDrive"), tone: "ok" } : undefined}
      loginLabel={loginRequired ? t(lang, "driveLogin") : undefined}
      onLogin={
        loginRequired
          ? () =>
              redirectToLoginIfRequired({
                ok: false,
                data: null,
                loginRequired: true,
                loginUrl,
              })
          : undefined
      }
      messages={messages}
      chips={projectId === "job-islevvaenge" ? CHIPS_ISLEV : CHIPS_HILLEROD}
      placeholder={t(lang, "udbudPlaceholder")}
      busy={busy}
      busyText={t(lang, "udbudBotLooking")}
      value={q}
      onChange={setQ}
      onSend={(preset) => void send(preset)}
      lang={lang}
    />
  );
}
