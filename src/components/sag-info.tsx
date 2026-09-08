import { useEffect, useMemo, useState } from "react";
import { AssistChat, type ChatLine } from "@/components/assist-chat";
import { Card, Chip, SectionLabel } from "@/components/zenko";
import { askSagInfo } from "@/lib/ai.functions";
import { loadAssist, saveAssist } from "@/lib/assist-memory";
import { listMeetingFiles } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import { listSagMail } from "@/lib/mail.functions";
import { mailSnapshot } from "@/lib/mail.snapshot";
import { shownText } from "@/lib/chat";
import { hoursWorked } from "@/lib/seed";
import { buildSagBrief } from "@/lib/sag-brief";
import { todayLog, useYard } from "@/lib/store";
import { todoPeopleLine } from "@/lib/todo-people";
import type { Lang, Project } from "@/lib/types";

export function SagInfo({ project, lang }: { project: Project; lang: Lang }) {
  const chats = useYard((s) => s.chats);
  const todos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const days = useYard((s) => s.days);
  const slips = useYard((s) => s.slips);
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const ksReports = useYard((s) => s.ksReports);
  const cal = useYard((s) => s.cal);
  const [meetings, setMeetings] = useState<{ name: string }[]>([]);
  const [mail, setMail] = useState(() => mailSnapshot(project.id, project.name));

  useEffect(() => {
    setMail(mailSnapshot(project.id, project.name));
    void listSagMail({ data: { projectId: project.id, projectName: project.name } }).then((res) => {
      if (res?.items?.length) setMail(res);
    });
    void listMeetingFiles({ data: { projectId: project.id } }).then((res) => {
      if (res.files.length) setMeetings(res.files);
    });
  }, [project.id, project.name]);

  const brief = useMemo(() => {
    const jobId = project.id;
    return buildSagBrief({
      projectName: project.name,
      mail,
      chats: chats
        .filter((c) => c.projectId === jobId)
        .slice(0, 6)
        .map((c) => ({
          at: c.at,
          from: employees.find((e) => e.id === c.fromId)?.name ?? "—",
          text: shownText(c, lang).slice(0, 140),
        })),
      todos: todos
        .filter((td) => td.projectId === jobId)
        .map((td) => ({
          title: td.title,
          who: todoPeopleLine(td, employees) || "—",
          done: td.done,
          due: td.due,
        })),
      slips: slips.filter((s) => s.projectId === jobId).map((s) => ({ number: s.number, title: s.title })),
      tfs: tfs.filter((s) => s.projectId === jobId).map((s) => ({ number: s.number, title: s.title || s.question, answered: s.answered })),
      ents: ents.filter((s) => s.projectId === jobId).map((s) => ({ number: s.number, title: s.title })),
      ks: ksReports.filter((s) => s.projectId === jobId).map((s) => ({ number: s.number, point: s.point })),
      meetings,
      cal: cal.filter((c) => !c.projectId || c.projectId === jobId).map((c) => ({ title: c.title, at: c.at })),
      crew: employees
        .filter((e) => e.role !== "mester")
        .map((e) => {
          const d = todayLog(e.id, days);
          return { name: e.name, in: Boolean(d.checkInAt) && !d.checkOutAt && d.projectId === jobId && hoursWorked(d) >= 0 };
        }),
    });
  }, [cal, chats, days, employees, ents, ksReports, lang, mail, meetings, project.id, project.name, slips, tfs, todos]);

  const key = `sag-info:${project.id}`;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>(() => [{ who: "bot", text: t(lang, "sagInfoAskPh") }]);

  useEffect(() => {
    const saved = loadAssist(key);
    setMessages(saved.length ? saved : [{ who: "bot", text: t(lang, "sagInfoAskPh") }]);
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
    try {
      const res = await askSagInfo({
        data: {
          projectName: project.name,
          brief: brief.pack,
          query,
          history: messages.slice(-6).map((m) => ({ role: m.who === "me" ? ("user" as const) : ("assistant" as const), content: m.text })),
        },
      });
      setMessages((m) => [...m, { who: "bot", text: res.line }]);
    } catch {
      setMessages((m) => [...m, { who: "bot", text: t(lang, "unknownAsk") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-[20px]">
        <SectionLabel>{t(lang, "sagInfoTitle")}</SectionLabel>
        <p className="mb-3 text-sm leading-relaxed text-ink">{brief.headline}</p>
        <p className="mb-3 text-xs text-muted">{t(lang, "sagInfoHint")}</p>
        <ul className="space-y-3">
          {brief.sections.map((s) => (
            <li key={s.title}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{s.title}</p>
              <ul className="space-y-1">
                {s.lines.map((line) => (
                  <li key={line} className="rounded-lg bg-sand px-3 py-2 text-sm leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {mail.live ? <Chip tone="ok" className="mt-3">{t(lang, "opsLive")}</Chip> : null}
      </Card>
      <AssistChat
        icon={<span className="font-display text-lg">{t(lang, "sagInfoAsk")}</span>}
        title={t(lang, "sagInfoAsk")}
        hint={t(lang, "sagInfoAskPh")}
        messages={messages}
        chips={[
          { label: "Næste møde?", q: "Hvornår er næste byggemøde og sikkerhedsmøde?" },
          { label: "Åbne to-do", q: "Hvilke to-do er åbne, og hos hvem?" },
          { label: "LIN", q: "Hvad har LIN skrevet den seneste tid?" },
        ]}
        placeholder={t(lang, "sagInfoAskPh")}
        busy={busy}
        busyText={t(lang, "sagInfoLooking")}
        value={q}
        onChange={setQ}
        onSend={(v) => void send(v)}
      />
    </div>
  );
}
