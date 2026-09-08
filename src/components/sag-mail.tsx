import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { AssistChat, type ChatLine } from "@/components/assist-chat";
import { Chip, GhostButton } from "@/components/zenko";
import { redirectToLoginIfRequired } from "@/lib/app-data/login";
import { loadAssist, saveAssist } from "@/lib/assist-memory";
import { t } from "@/lib/i18n";
import { askSagMail, briefSagMail, listSagMail, type MailLive } from "@/lib/mail.functions";
import { briefMailItems, mailSnapshot } from "@/lib/mail.snapshot";
import { useYard } from "@/lib/store";
import type { Lang, SiteDoc } from "@/lib/types";

type Line = { id: string; date: string; from: string; subject: string; snippet: string; kind: "lin" | "meet" | "mail" };

function parseDa(d: string) {
  const m = d.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const t = Date.parse(d);
  return Number.isNaN(t) ? new Date(0) : new Date(t);
}

function kindOf(from: string, subject: string): Line["kind"] {
  const s = `${from} ${subject}`.toLowerCase();
  if (/lars ingtrup|\blin\b|lin@ole-jepsen/.test(s)) return "lin";
  if (/byggemøde|sikkerhedsmøde|referat/.test(s)) return "meet";
  return "mail";
}

const CHIPS = [
  { label: "Dagens overblik", q: "Giv mig dagens overblik: møder, LIN-aftaler, tilkøb og åbne krav." },
  { label: "Hvad aftalte LIN?", q: "Hvad har LIN aftalt den seneste måned — tilkøb, option, underskrift?" },
  { label: "Næste møde?", q: "Hvornår er næste byggemøde og sikkerhedsmøde?" },
  { label: "Aftalesedler?", q: "Hvilke aftalesedler og tilkøb venter på underskrift?" },
];

export function SagMail({ projectId, projectName, lang }: { projectId: string; projectName: string; lang: Lang }) {
  const docs = useYard((s) => s.docs);
  const key = `mail:${projectId}`;
  const snap0 = mailSnapshot(projectId, projectName);
  const hello = briefMailItems(snap0.items, projectName);
  const [snap, setSnap] = useState<MailLive>({ ...snap0, brief: hello });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    const saved = loadAssist(key);
    return saved.length ? saved : [{ who: "bot", text: hello }];
  });

  useEffect(() => {
    const saved = loadAssist(key);
    const start = briefMailItems(mailSnapshot(projectId, projectName).items, projectName);
    setMessages(saved.length ? saved : [{ who: "bot", text: start }]);
    setQ("");
    void listSagMail({ data: { projectId, projectName } }).then((res) => {
      if (!res) return;
      setSnap(res);
      if (!saved.length && res.brief) setMessages([{ who: "bot", text: res.brief }]);
    });
  }, [projectId, projectName, key]);

  useEffect(() => {
    saveAssist(key, messages);
  }, [key, messages]);

  const lines = useMemo(() => {
    const meet = docs
      .filter((d) => d.projectId === projectId && d.folder === "meetings")
      .map((d: SiteDoc) => ({
        id: d.id,
        date: new Date(d.receivedAt).toLocaleDateString("da-DK"),
        from: d.from,
        subject: d.title,
        snippet: d.excerpt,
        kind: /møde|referat/i.test(d.title) ? ("meet" as const) : ("mail" as const),
      }));
    const mail = snap.items.map((m) => ({ ...m, kind: kindOf(m.from, m.subject) }));
    return [...mail, ...meet].sort((a, b) => parseDa(b.date).getTime() - parseDa(a.date).getTime()).slice(0, 12);
  }, [docs, projectId, snap.items]);

  async function send(preset?: string) {
    const query = (preset ?? q).trim();
    if (!query || busy) return;
    setQ("");
    setMessages((m) => [...m, { who: "me", text: query }]);
    setBusy(true);
    const history = messages.slice(-6).map((x) => ({ role: x.who === "me" ? ("user" as const) : ("assistant" as const), content: x.text }));
    try {
      const isBrief = /overblik|i dag|dagens/.test(query.toLowerCase());
      const res = isBrief
        ? await briefSagMail({ data: { projectId, projectName } })
        : await askSagMail({ data: { projectId, projectName, query, history } });
      if ("loginRequired" in res && res.loginRequired) setSnap((s) => ({ ...s, loginRequired: true, loginUrl: res.loginUrl }));
      const line = ("line" in res ? res.line : null) || t(lang, "udbudNoHit");
      const used = "used" in res && Array.isArray(res.used) ? res.used : undefined;
      setMessages((m) => [...m, { who: "bot", text: line, used }]);
    } catch {
      setMessages((m) => [...m, { who: "bot", text: snap.brief || t(lang, "udbudNoHit") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AssistChat
      icon={<Mail className="size-5" />}
      title={t(lang, "mailBotName")}
      hint={t(lang, "mailBotHint")}
      status={snap.live ? { label: t(lang, "mailLive"), tone: "ok" } : { label: t(lang, "mailCached"), tone: "sand" }}
      loginLabel={snap.loginRequired ? t(lang, "mailLogin") : undefined}
      onLogin={
        snap.loginRequired
          ? () =>
              redirectToLoginIfRequired({
                ok: false,
                data: null,
                loginRequired: true,
                loginUrl: snap.loginUrl,
              })
          : undefined
      }
      messages={messages}
      chips={CHIPS}
      placeholder={t(lang, "mailAskPlaceholder")}
      busy={busy}
      busyText={t(lang, "mailBotLooking")}
      value={q}
      onChange={setQ}
      onSend={(preset) => void send(preset)}
      footer={
        <div>
          <GhostButton onClick={() => setOpenList((v) => !v)}>{openList ? t(lang, "mailHideList") : t(lang, "mailSeeList")}</GhostButton>
          {openList ? (
            <ul className="mt-2 space-y-1.5">
              {lines.map((m) => (
                <li key={m.id} className="rounded-lg bg-sand px-3 py-2 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone="sand">{m.date}</Chip>
                    {m.kind === "lin" ? <Chip tone="navy">LIN</Chip> : null}
                    {m.kind === "meet" ? <Chip tone="ok">Møde</Chip> : null}
                  </div>
                  <p className="mt-1 font-medium">{m.subject}</p>
                  <p className="text-xs text-muted">
                    {m.from} · {m.snippet}
                  </p>
                </li>
              ))}
              {!lines.length ? <li className="text-sm text-muted">{t(lang, "mailEmpty")}</li> : null}
            </ul>
          ) : null}
        </div>
      }
    />
  );
}
