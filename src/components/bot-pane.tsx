import { useEffect, useRef, useState } from "react";
import { Bot, Camera, ImagePlus, Mic, Square } from "lucide-react";
import { Card, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { KsDoc, PrintChrome, TfDoc, SlipDoc } from "@/components/print-docs";
import { talkMesterBot, transcribeClip } from "@/lib/ai.functions";
import { redirectToLoginIfRequired } from "@/lib/app-data/login";
import { buildHoursPack, downloadHours, hoursSummary, type BotAction, type HoursPack } from "@/lib/bot-actions";
import { confirmLine, heuristicTalk, labelDraft, type TalkTool } from "@/lib/bot-talk";
import { loadTalk, saveTalk, type AssistMsg } from "@/lib/assist-memory";
import { flushAdminSnapshot } from "@/lib/admin-backup";
import { appendChatLog, uploadKsPhotoToDrive, writeKsReportSidecar, placeFieldInSlot } from "@/lib/drive.functions";
import { createSagOnDrive } from "@/lib/sag-drive";
import { photoFromDriveFile } from "@/lib/ks-drive";
import { stampFile } from "@/lib/photos";
import { findControlPoint, isCrewRole, projectById } from "@/lib/seed";
import { todayLog, useYard } from "@/lib/store";
import type { FieldItem, KsPhoto, Lang } from "@/lib/types";
import { startRecording } from "@/lib/voice-client";
import { t } from "@/lib/i18n";

type PhotoDraft = { name: string; dataUrl: string };
type BotMsg = AssistMsg & {
  photos?: PhotoDraft[];
  file?: HoursPack;
  report?: { id: string; number: string; kind: "ks" | "tf" | "slip" };
  drafts?: BotAction[];
  mail?: { to: string; subject: string; body: string };
  citations?: string[];
  loginUrl?: string;
};

const TALK_KEY = "mester-bot";
const WELCOME =
  "Jeg er med i tråden. Sig hvad du ser — jeg gemmer det. Først når du siger gør det, opretter jeg TF, to-do, KS eller plan. Du kan også bede mig tjekke udbud, mail, kalender eller nettet.";
const CHIPS = [
  "Der er gammelt stål her, vi kan ikke komme videre. Hvad gør vi?",
  "Tjek udbuddet og normen for stål i murværk",
  "Lav en TF til byggeledelsen med billedet, og en to-do til Marius om at fjerne det som ekstra",
  "Gør det",
];

export function BotPane({ lang }: { lang: Lang }) {
  const store = useYard();
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const recRef = useRef<{ stop: () => Promise<{ base64: string; mime: string }> } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heldPhotos = useRef<PhotoDraft[]>([]);
  const saved = loadTalk(TALK_KEY);
  const [log, setLog] = useState<BotMsg[]>(() => (saved.log.length ? (saved.log as BotMsg[]) : [{ who: "bot", text: WELCOME }]));
  const [drafts, setDrafts] = useState<BotAction[]>(() => saved.drafts ?? []);
  const [offered, setOffered] = useState<TalkTool[]>(() => saved.offered ?? []);
  const [notes, setNotes] = useState<string[]>(() => saved.notes ?? []);
  const [openDoc, setOpenDoc] = useState<{ id: string; kind: "ks" | "tf" | "slip" } | null>(null);

  useEffect(() => {
    saveTalk(TALK_KEY, { log, drafts, offered, notes });
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log, drafts, offered, notes]);

  function yardPack(photoCount: number) {
    const job = store.projects.find((p) => p.status === "active") ?? store.projects[0]!;
    return {
      projectId: job.id,
      projectName: job.name,
      huddle: job.huddle,
      onSite: store.employees.filter((e) => todayLog(e.id, store.days).checkInAt).map((e) => e.name),
      issues: store.issues.filter((i) => i.status === "open").map((i) => i.body).slice(0, 8),
      slips: store.slips.slice(0, 8).map((s) => `${s.number} ${s.title} ${s.customerPrice}`),
      tfs: store.tfs.slice(0, 6).map((s) => `${s.number} ${s.title ?? s.question}`),
      todos: store.todos.filter((x) => !x.done).map((x) => x.title).slice(0, 6),
      plans: store.plans.slice(0, 16).map((p) => {
        const who = store.employees.find((e) => e.id === p.employeeId)?.name ?? p.employeeId;
        const sag = store.projects.find((j) => j.id === p.projectId)?.name ?? p.projectId;
        return `${who} · ${sag} · ${p.title} ${p.start}–${p.end}`;
      }),
      hours: hoursSummary(store.days, store.employees, store.projects),
      employees: store.employees.map((e) => e.name),
      projects: store.projects.map((p) => ({ id: p.id, name: p.name })),
      photoCount,
    };
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: PhotoDraft[] = [];
    for (const file of [...list]) {
      try {
        const made = await stampFile(file, { point: "felt", floor: "", room: "", gpsLabel: "Plads", name: "Grok" });
        if (made.dataUrl) next.push({ name: file.name || "foto.jpg", dataUrl: made.dataUrl });
      } catch {
        /* skip */
      }
    }
    setPhotos((cur) => [...cur, ...next]);
  }

  async function listen() {
    if (rec) {
      const clip = recRef.current;
      recRef.current = null;
      setRec(false);
      if (!clip) return;
      try {
        const { base64, mime } = await clip.stop();
        const res = await transcribeClip({ data: { audioBase64: base64, mime, language: "da" } });
        if (res.ok && res.text) {
          setNote("");
          void send(res.text);
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      recRef.current = await startRecording();
      setRec(true);
    } catch {
      /* mic denied */
    }
  }

  async function runExecute(nextDrafts: BotAction[], attached: PhotoDraft[]) {
    setBusy(true);
    try {
      const done = await applyActions(nextDrafts, attached);
      const numbers = done.report?.number ? [done.report.number] : [];
      const line = confirmLine(nextDrafts, store.employees, numbers);
      heldPhotos.current = [];
      setDrafts([]);
      setOffered([]);
      setLog((rows) => [...rows, { who: "bot", text: line, file: done.file, report: done.report, used: done.used, mail: done.mail }]);
      const jobId =
        nextDrafts.map((a) => ("projectId" in a ? a.projectId : "")).find(Boolean) || store.projects[0]?.id;
      if (jobId) {
        void appendChatLog({
          data: {
            projectId: jobId,
            title: "bot",
            text: `${line}\n${nextDrafts.map((d) => labelDraft(d, store.employees, store.projects)).join("\n")}`,
            employeeName: "Mester-bot",
          },
        });
      }
      if (nextDrafts.some((a) => a.type === "set_plan" || a.type === "create_todo" || a.type === "create_tf" || a.type === "create_ks")) {
        void flushAdminSnapshot();
      }
    } finally {
      setBusy(false);
    }
  }

  async function send(preset?: string) {
    const text = (preset ?? note).trim();
    if ((!text && !photos.length) || busy) return;
    const line = text || (photos.length ? `${photos.length} billeder` : "");
    const attached = photos.length ? photos : heldPhotos.current;
    if (photos.length) heldPhotos.current = photos;
    setLog((rows) => [...rows, { who: "me", text: line, photos: photos.length ? photos : undefined }]);
    setNote("");
    setPhotos([]);
    setBusy(true);
    const history = log
      .filter((m) => m.text)
      .slice(-16)
      .map((m) => ({ role: m.who === "me" ? ("user" as const) : ("assistant" as const), content: m.text }));
    let turn = heuristicTalk({
      query: line,
      photoCount: attached.length,
      drafts,
      offered,
      notes,
      employees: store.employees,
      projects: store.projects,
    });
    let loginUrl: string | undefined;
    let citations: string[] = [];
    const skipServer = turn.execute || ((turn.drafts.length > 0 || turn.offered.length > 0) && turn.tools.length === 0);
    if (!skipServer) {
      try {
        const res = await talkMesterBot({
          data: {
            query: line,
            history,
            drafts,
            offered,
            notes,
            photoCount: attached.length,
            yard: yardPack(attached.length),
          },
        });
        if (res.ok) {
          turn = {
            answer: res.answer || turn.answer,
            drafts: res.drafts?.length ? res.drafts : turn.drafts,
            execute: res.execute,
            tools: res.tools ?? [],
            offered: res.offered ?? turn.offered,
            notes: res.notes?.length ? res.notes : turn.notes,
          };
          loginUrl = res.loginUrl;
          citations = res.citations ?? [];
        }
      } catch {
        /* heuristic stands */
      }
    }
    if (turn.notes.length) setNotes((n) => [...n, ...turn.notes].slice(-12));
    setOffered(turn.offered);
    setDrafts(turn.drafts);
    if (turn.execute && turn.drafts.length) {
      await runExecute(turn.drafts, attached);
      return;
    }
    setLog((rows) => [
      ...rows,
      {
        who: "bot",
        text: turn.answer || "Noteret.",
        drafts: turn.drafts,
        citations: citations.length ? citations : undefined,
        loginUrl,
      },
    ]);
    setBusy(false);
  }

  function attachPhotos(projectId: string, attached: PhotoDraft[], classifiedAs: FieldItem["classifiedAs"]): string[] {
    if (!attached.length) return [];
    const job = store.projects.find((p) => p.id === projectId) ?? projectById(projectId);
    const fromId = store.employeeId ?? "emp-ole";
    const items: FieldItem[] = attached.map((d) => ({
      id: `botph-${crypto.randomUUID().slice(0, 8)}`,
      projectId,
      projectName: job.name,
      employeeId: fromId,
      employeeName: store.employees.find((e) => e.id === fromId)?.name ?? "Ole",
      kind: "photo",
      name: d.name,
      mimeType: "image/jpeg",
      dataUrl: d.dataUrl,
      note: "Fra mester-bot",
      takenAt: new Date().toISOString(),
      status: "classified",
      classifiedAs,
    }));
    store.addFieldItems(items);
    return items.map((i) => i.id);
  }

  async function applyActions(
    actions: BotAction[],
    attached: PhotoDraft[],
  ): Promise<{ summary: string; file?: HoursPack; report?: { id: string; number: string; kind: "ks" | "tf" | "slip" }; used: string[]; mail?: { to: string; subject: string; body: string } }> {
    const bits: string[] = [];
    const used: string[] = [];
    let file: HoursPack | undefined;
    let report: { id: string; number: string; kind: "ks" | "tf" | "slip" } | undefined;
    let mail: { to: string; subject: string; body: string } | undefined;
    const idMap = new Map<string, string>();
    for (const a of actions) {
      if (a.type !== "create_project") continue;
      const made = await createSagOnDrive({
        id: a.id,
        name: a.name,
        address: a.address || "Adresse mangler",
        lat: a.lat ?? 55.68,
        lng: a.lng ?? 12.45,
        createdBy: store.employeeId ?? "emp-ole",
      });
      if (!made.ok) {
        bits.push(made.error);
        continue;
      }
      const id = made.id;
      if (a.id) idMap.set(a.id, id);
      idMap.set(a.name, id);
      bits.push(`${a.name} oprettet.`);
      used.push("sag");
    }
    const pid = (id: string) => idMap.get(id) ?? id;
    for (const a of actions) {
      if (a.type === "create_project") continue;
      if (a.type === "export_hours") {
        const pack = buildHoursPack(store.days, store.employees, store.projects, {
          employeeName: a.employeeName,
          projectId: a.projectId,
          month: a.month,
        });
        file = pack;
        bits.push(pack.rows.length ? `Ark klar: ${pack.label}.` : `Ingen timer matcher (${pack.label}).`);
        used.push("timer");
      }
      if (a.type === "create_ks") {
        const made = await makeKs(a, attached);
        report = { id: made.id, number: made.number, kind: "ks" };
        bits.push(made.line);
        used.push(`KS ${a.point}`);
      }
      if (a.type === "create_slip") {
        const photoIds = attachPhotos(a.projectId, attached, "extra");
        const slip = store.addSlip({
          projectId: a.projectId,
          title: a.title,
          location: a.location || projectById(a.projectId).name,
          body: a.body,
          masterSolution: "Kladde fra mester-bot.",
          customerPrice: a.customerPrice || "0 kr",
          hoursEst: 0,
          materialsEst: "—",
          photoIds,
        });
        bits.push(`Aftaleseddel oprettet: ${a.title}.`);
        used.push("aftaleseddel");
        report = { id: slip.id, number: slip.number, kind: "slip" };
      }
      if (a.type === "create_tf") {
        const photoIds = attachPhotos(a.projectId, attached, "tf");
        const tf = store.addTf({ projectId: a.projectId, question: a.question, title: a.title, photoIds });
        report = { id: tf.id, number: tf.number, kind: "tf" };
        bits.push(`${tf.number} oprettet.`);
        used.push("TF");
        if (photoIds.length) {
          void placeFieldInSlot({
            data: {
              projectId: a.projectId,
              classifiedAs: "tf",
              name: a.title || tf.number,
              note: a.question,
              employeeName: "Mester-bot",
              reportNumber: tf.number,
            },
          });
        }
      }
      if (a.type === "create_ent") {
        const photoIds = attachPhotos(a.projectId, attached, "ent");
        store.addEnt({ projectId: a.projectId, title: a.title, location: a.location || projectById(a.projectId).name, body: a.body, noteHe: "—", photoIds });
        bits.push("Entreprenørrapport oprettet.");
        used.push("ER");
      }
      if (a.type === "create_todo") {
        const who = store.employees.find((e) => e.id === a.assigneeId);
        const projectId = pid(a.projectId);
        const todo = store.addTodo({
          projectId,
          assigneeId: a.assigneeId ?? store.employees.find((e) => isCrewRole(e.role))?.id ?? "emp-alex",
          title: a.title,
          due: a.due || new Date().toISOString().slice(0, 10),
          needsPhoto: a.needsPhoto,
          translations:
            who?.language && who.language !== "da" && /stål|stal|fjern/i.test(a.title)
              ? {
                  da: a.title,
                  pl: "Usuń stare żelazo jako extra",
                  es: "Quitar acero viejo como extra",
                  ro: "Scoate oțelul vechi ca extra",
                }
              : { da: a.title },
        });
        bits.push(`To-do til ${store.employees.find((e) => e.id === todo.assigneeId)?.name ?? "ansat"}.`);
        used.push("todo");
      }
      if (a.type === "set_plan") {
        if (a.employeeId && a.start && a.end) {
          const projectId = pid(a.projectId);
          store.addPlan({ employeeId: a.employeeId, projectId, title: a.title, start: a.start, end: a.end, source: "bot" });
          store.setAssignment(a.employeeId, projectId, true);
          bits.push(`Plan: ${store.employees.find((e) => e.id === a.employeeId)?.name ?? "ansat"} ${a.start}–${a.end}.`);
          used.push("plan");
        }
      }
      if (a.type === "create_note") {
        store.addNote(a.projectId, a.body);
        bits.push("Note gemt.");
        used.push("note");
      }
      if (a.type === "create_chat") {
        const fromId = store.employeeId ?? "emp-ole";
        store.addChat({
          fromId,
          to: a.assigneeId ? { kind: "employee", id: a.assigneeId } : { kind: "crew", projectId: a.projectId },
          projectId: a.projectId,
          sourceLang: "da",
          original: a.text,
          translations: { da: a.text },
          viaVoice: false,
        });
        void appendChatLog({ data: { projectId: a.projectId, title: "bot", text: a.text, employeeName: "Mester-bot" } });
        bits.push("Besked lagt i chat.");
        used.push("chat");
      }
      if (a.type === "draft_mail") {
        mail = { to: a.to, subject: a.subject, body: a.body };
        bits.push("Mail-kladde klar — I sender selv.");
        used.push("mail");
      }
    }
    return { summary: bits.join(" "), file, report, used, mail };
  }

  async function makeKs(a: Extract<BotAction, { type: "create_ks" }>, attached: PhotoDraft[]): Promise<{ id: string; number: string; line: string }> {
    const job = projectById(a.projectId);
    const spec = findControlPoint(a.point, a.projectId);
    const slug = (spec?.title ?? "KS").replace(/[^\wæøåÆØÅ]+/g, "-").replace(/-+/g, "-").slice(0, 36);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "");
    const local: KsPhoto[] = attached.map((d, i) => {
      const name = `KS-Grok-${a.point}-${slug}-${stamp}-${i + 1}.jpg`;
      return {
        ...photoFromDriveFile({ fileId: `local-${stamp}-${i + 1}`, name, projectId: a.projectId, projectName: job.name }),
        id: `ksg-${crypto.randomUUID().slice(0, 8)}`,
        dataUrl: d.dataUrl,
        point: a.point,
        floor: a.floor || "1. sal",
        room: a.room || "Altan",
        employeeName: "Grok",
        deviceLabel: "KS-Grok",
        originalName: name,
        recognitionLabel: `KS-Grok ${a.point} ${spec?.title ?? ""}`,
        recognitionNote: "Oprettet af mester-bot.",
      };
    });
    if (local.length) store.upsertDrivePhotos(local);
    const photoIds = local.map((p) => p.id);
    for (let i = 0; i < local.length; i++) {
      const p = local[i]!;
      const base64 = p.dataUrl.split(",")[1] ?? "";
      try {
        const res = await uploadKsPhotoToDrive({
          data: { projectId: a.projectId, name: p.originalName || `KS-Grok-${i + 1}.jpg`, mimeType: "image/jpeg", contentBase64: base64, point: a.point },
        });
        if (res.fileId) {
          photoIds[i] = res.fileId;
          store.upsertDrivePhotos([{ ...p, driveFileId: res.fileId, driveUrl: `https://drive.google.com/file/d/${res.fileId}/view` }]);
        }
      } catch {
        /* keep local */
      }
    }
    const row = store.addKsReport(a.projectId, a.point, { photoIds, deviations: a.deviations || "Ingen afvigelser." });
    void writeKsReportSidecar({
      data: {
        projectId: a.projectId,
        number: row.number,
        point: a.point,
        title: spec?.title ?? a.point,
        deviations: a.deviations || "Ingen afvigelser.",
        names: local.map((p) => p.originalName ?? p.id),
      },
    }).catch(() => undefined);
    return { id: row.id, number: row.number, line: `${row.number} · KS ${a.point}` };
  }

  const onSite = store.employees.filter((e) => todayLog(e.id, store.days).checkInAt && !todayLog(e.id, store.days).checkOutAt);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-navy">{t(lang, "tabBot")}</h1>
          <p className="text-sm text-muted">{t(lang, "botTalkHint")}</p>
        </div>
        <GhostButton
          className="bg-paper px-3 shadow-card"
          onClick={() => {
            heldPhotos.current = [];
            setDrafts([]);
            setOffered([]);
            setNotes([]);
            setLog([{ who: "bot", text: WELCOME }]);
          }}
        >
          {t(lang, "botNewThread")}
        </GhostButton>
      </div>
      <Card className="overflow-hidden rounded-[20px] p-0">
        <div className="flex items-center gap-2 bg-navy px-4 py-3 text-sand">
          <Bot className="size-5" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl tracking-wide">Mester-bot</p>
            <p className="text-xs text-sand/70">{onSite.length} på plads nu</p>
          </div>
        </div>
        <div ref={scroller} className="max-h-[52vh] space-y-3 overflow-y-auto bg-paper px-3 py-3">
          {log.map((row, i) => (
            <div key={`${row.who}-${i}`} className={row.who === "me" ? "ml-8" : "mr-6"}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.who === "me" ? t(lang, "you") : t(lang, "bot")}</p>
              <div className={`mt-1 whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${row.who === "me" ? "bg-navy text-sand" : "bg-sand text-ink"}`}>
                {row.text}
                {row.photos?.length ? (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto">
                    {row.photos.map((p) => (
                      <img key={p.name} src={p.dataUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
              {row.used?.length ? <p className="mt-1 text-xs text-muted">{[...new Set(row.used)].join(" · ")}</p> : null}
              {row.citations?.length ? <p className="mt-1 text-xs text-muted">{row.citations.join(" · ")}</p> : null}
              {row.loginUrl ? (
                <GhostButton
                  className="mt-2 rounded-full bg-sand px-3"
                  onClick={() =>
                    redirectToLoginIfRequired({ ok: false, data: null, loginRequired: true, loginUrl: row.loginUrl })
                  }
                >
                  {t(lang, "driveLogin")}
                </GhostButton>
              ) : null}
              {row.file ? (
                <div className="mt-2 overflow-x-auto rounded-xl bg-paper p-2">
                  <p className="text-xs text-muted">{row.file.label}</p>
                  <PrimaryButton className="mt-2 w-auto px-4" onClick={() => downloadHours(row.file!)}>
                    Hent {row.file.filename}
                  </PrimaryButton>
                </div>
              ) : null}
              {row.mail ? (
                <a
                  className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-navy px-3 text-sm text-sand"
                  href={`mailto:${encodeURIComponent(row.mail.to)}?subject=${encodeURIComponent(row.mail.subject)}&body=${encodeURIComponent(row.mail.body)}`}
                >
                  Åbn mail-kladde
                </a>
              ) : null}
              {row.report ? (
                <GhostButton className="mt-2 rounded-full bg-sand px-3" onClick={() => setOpenDoc({ id: row.report!.id, kind: row.report!.kind ?? "tf" })}>
                  Åbn {row.report.number}
                </GhostButton>
              ) : null}
            </div>
          ))}
          {busy ? <p className="text-sm text-muted">{t(lang, "botThinking")}</p> : null}
        </div>
        {drafts.length ? (
          <div className="border-t border-line bg-sand px-3 py-3">
            <SectionLabel>{t(lang, "botDraft")}</SectionLabel>
            <ul className="space-y-1">
              {drafts.map((d, i) => (
                <li key={`${d.type}-${i}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  {labelDraft(d, store.employees, store.projects)}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <PrimaryButton className="flex-1" disabled={busy} onClick={() => void runExecute(drafts, heldPhotos.current)}>
                {t(lang, "botGo")}
              </PrimaryButton>
              <GhostButton className="bg-paper px-4" onClick={() => setDrafts([])}>
                {t(lang, "botDropDraft")}
              </GhostButton>
            </div>
          </div>
        ) : null}
        {photos.length ? (
          <div className="flex gap-1.5 overflow-x-auto border-t border-line bg-sand px-3 py-2">
            {photos.map((p, i) => (
              <button key={p.name + i} type="button" className="relative" onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}>
                <img src={p.dataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
          {CHIPS.map((c) => (
            <button key={c} type="button" className="min-h-11 rounded-full bg-sand px-3 text-xs" onClick={() => void send(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 px-3 pb-3">
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
          <GhostButton className="shrink-0 px-2" onClick={() => camRef.current?.click()} aria-label={t(lang, "camera")}>
            <Camera className="size-5" />
          </GhostButton>
          <GhostButton className="shrink-0 px-2" onClick={() => galRef.current?.click()} aria-label={t(lang, "gallery")}>
            <ImagePlus className="size-5" />
          </GhostButton>
          <GhostButton className={`shrink-0 px-2 ${rec ? "bg-brick text-sand" : ""}`} onClick={() => void listen()} aria-label={t(lang, "chatSpeak")}>
            {rec ? <Square className="size-5" /> : <Mic className="size-5" />}
          </GhostButton>
          <textarea
            className="min-h-11 flex-1 rounded-xl bg-sand px-3 py-2 text-base"
            placeholder={t(lang, "botPh")}
            value={note}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <PrimaryButton className="w-auto px-4" disabled={busy || (!note.trim() && !photos.length)} onClick={() => void send()}>
            {t(lang, "botSend")}
          </PrimaryButton>
        </div>
      </Card>
      {openDoc?.kind === "ks" && store.ksReports.find((r) => r.id === openDoc.id) ? (
        <PrintChrome docId={openDoc.id} kind="ks" onClose={() => setOpenDoc(null)}>
          <KsDoc report={store.ksReports.find((r) => r.id === openDoc.id)!} photos={[...Object.values(store.days).flatMap((d) => d.photos), ...store.drivePhotos]} />
        </PrintChrome>
      ) : null}
      {openDoc?.kind === "tf" && store.tfs.find((r) => r.id === openDoc.id) ? (
        <PrintChrome docId={openDoc.id} kind="tf" onClose={() => setOpenDoc(null)}>
          <TfDoc tf={store.tfs.find((r) => r.id === openDoc.id)!} />
        </PrintChrome>
      ) : null}
      {openDoc?.kind === "slip" && store.slips.find((r) => r.id === openDoc.id) ? (
        <PrintChrome docId={openDoc.id} kind="slip" onClose={() => setOpenDoc(null)}>
          <SlipDoc slip={store.slips.find((r) => r.id === openDoc.id)!} />
        </PrintChrome>
      ) : null}
    </div>
  );
}
