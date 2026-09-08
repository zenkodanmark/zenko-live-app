import { useEffect, useState, type ReactNode } from "react";
import { CloseX } from "@/components/sag-icons";
import { DrivePhoto } from "@/components/drive-photo";
import { BrickMark, Chip, GhostButton, PrimaryButton } from "@/components/zenko";
import { applyReportFix } from "@/lib/ai.functions";
import { snapshotOf, type FixChange } from "@/lib/report-fix";
import { LETTERHEAD, printDoc } from "@/lib/print";
import { FIRM_CVR, FIRM_MAIL, copenhagenDateTime, copenhagenTime, controlPlanFor, findControlPoint } from "@/lib/seed";
import { lookupProject, useYard } from "@/lib/store";
import type { Entrepreneur, InvoicePack, KsPhoto, KsReport, Lang, Project, Slip, Tf } from "@/lib/types";
import { hydrateSoftrSlip, softrAsFieldItems } from "@/lib/softr-as";
import { hydrateSoftrReport } from "@/lib/softr-ks";
import { hydrateSoftrEnt } from "@/lib/softr-er";
import { hydrateSoftrTf } from "@/lib/softr-tf";
import { ReportShareBar } from "@/components/report-share-bar";
import { TfShareBar } from "@/components/tf-share-bar";
import { KundeHak } from "@/components/kunde-hak";
import { LedelseHak } from "@/components/ledelse-hak";

export type ReportKind = "slip" | "tf" | "ent" | "ks" | "pack";

export function PrintChrome({
  docId,
  onClose,
  children,
  kind,
  lang = "da",
}: {
  docId: string;
  onClose: () => void;
  children: ReactNode;
  kind?: ReportKind;
  lang?: Lang;
}) {
  const tf = useYard((s) => (kind === "tf" ? s.tfs.find((x) => x.id === docId) : undefined));
  const trashReport = useYard((s) => s.trashReport);
  const restoreReport = useYard((s) => s.restoreReport);
  const slips = useYard((s) => s.slips);
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const ksReports = useYard((s) => s.ksReports);
  const current =
    kind === "slip"
      ? slips.find((x) => x.id === docId)
      : kind === "tf"
        ? tfs.find((x) => x.id === docId)
        : kind === "ent"
          ? ents.find((x) => x.id === docId)
          : kind === "ks"
            ? ksReports.find((x) => x.id === docId)
            : undefined;
  const ksRow = kind === "ks" ? (() => {
    const row = ksReports.find((x) => x.id === docId);
    return row ? hydrateSoftrReport(row) : undefined;
  })() : undefined;
  const slipRow = kind === "slip" ? (() => {
    const row = slips.find((x) => x.id === docId);
    return row ? hydrateSoftrSlip(row) : undefined;
  })() : undefined;
  const tfRow = kind === "tf" ? (() => {
    const row = tfs.find((x) => x.id === docId);
    return row ? hydrateSoftrTf(row) : undefined;
  })() : undefined;
  const entRow = kind === "ent" ? (() => {
    const row = ents.find((x) => x.id === docId);
    return row ? hydrateSoftrEnt(row) : undefined;
  })() : undefined;
  const trashed = Boolean(current && "trashedAt" in current && current.trashedAt);
  const canTrash = kind === "slip" || kind === "tf" || kind === "ent" || kind === "ks";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        {canTrash ? (
          trashed ? (
            <GhostButton className="text-action text-sand" onClick={() => restoreReport(kind!, docId)}>
              Hent fra papirkurv
            </GhostButton>
          ) : (
            <GhostButton
              className="text-action text-sand"
              onClick={() => {
                trashReport(kind!, docId);
                onClose();
              }}
            >
              Papirkurv
            </GhostButton>
          )
        ) : null}
        {kind === "tf" && tf ? (
          <TfShareBar tf={tf} lang={lang} />
        ) : kind === "slip" || kind === "ent" || kind === "ks" ? (
          <ReportShareBar kind={kind === "slip" ? "as" : kind === "ent" ? "er" : "ks"} id={docId} lang={lang} />
        ) : (
          <span className="text-xs text-sand/70">Ikke sendt. I sender selv.</span>
        )}
        {ksRow ? <KundeHak report={ksRow} lang={lang} /> : null}
        {slipRow ? <LedelseHak kind="as" report={slipRow} lang={lang} /> : null}
        {tfRow ? <LedelseHak kind="tf" report={tfRow} lang={lang} /> : null}
        {entRow ? <LedelseHak kind="er" report={entRow} lang={lang} /> : null}
        {kind && kind !== "pack" && current ? <MoveReportBar kind={kind} id={docId} projectId={"projectId" in current ? current.projectId : ""} /> : null}
        <PrimaryButton tone="sand" className="w-auto px-4 text-action" onClick={printDoc}>
          Print / PDF
        </PrimaryButton>
        <CloseX onClick={onClose} label="Luk" />
      </div>
      {kind ? <ReportFixBar kind={kind} id={docId} /> : null}
      <div className="bg-white py-6">{children}</div>
    </div>
  );
}

function MoveReportBar({ kind, id, projectId }: { kind: Exclude<ReportKind, "pack">; id: string; projectId: string }) {
  const projects = useYard((s) => s.projects);
  const moveReport = useYard((s) => s.moveReport);
  const [to, setTo] = useState(kind);
  const [job, setJob] = useState(projectId);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select className="min-h-9 rounded-lg bg-navy-mid px-2 text-xs text-sand" value={to} onChange={(e) => setTo(e.target.value as typeof to)}>
        <option value="slip">AS</option>
        <option value="tf">TF</option>
        <option value="ent">ER</option>
        <option value="ks">KS</option>
      </select>
      <select className="min-h-9 max-w-[10rem] rounded-lg bg-navy-mid px-2 text-xs text-sand" value={job} onChange={(e) => setJob(e.target.value)}>
        {projects.filter((p) => p.status === "active").map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <GhostButton className="text-sand" onClick={() => moveReport(kind, id, to, job)}>
        Flyt
      </GhostButton>
    </div>
  );
}

function ReportFixBar({ kind, id }: { kind: ReportKind; id: string }) {
  const slips = useYard((s) => s.slips);
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const packs = useYard((s) => s.packs);
  const ksReports = useYard((s) => s.ksReports);
  const patchReport = useYard((s) => s.patchReport);
  const report =
    kind === "slip"
      ? slips.find((x) => x.id === id)
      : kind === "tf"
        ? tfs.find((x) => x.id === id)
        : kind === "ent"
          ? ents.find((x) => x.id === id)
          : kind === "pack"
            ? packs.find((x) => x.id === id)
            : ksReports.find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ who: "bot" | "me"; text: string; changes?: FixChange[] }[]>(() => [welcome()]);
  const [fields, setFields] = useState<Record<string, string>>(() => fieldsFrom(kind, report));

  useEffect(() => {
    setFields(fieldsFrom(kind, report));
  }, [kind, id, report]);

  useEffect(() => {
    setLog([welcome()]);
    setNote("");
    setOpen(false);
  }, [kind, id]);

  if (!report) return null;
  const plan = kind === "ks" ? controlPlanFor((report as KsReport).projectId) : [];

  async function runBot() {
    const text = note.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote("");
    setLog((rows) => [...rows, { who: "me", text }]);
    try {
      const snapshot = snapshotOf(kind, report as unknown as Record<string, unknown>);
      const res = await applyReportFix({
        data: { kind, instruction: text, report: snapshot },
      });
      if (!res.ok) {
        setLog((rows) => [...rows, { who: "bot", text: res.error === "empty" ? "Skriv hvad der skal rettes." : "Botten svarede ikke." }]);
        return;
      }
      const patch = res.patch ?? {};
      if (Object.keys(patch).length) {
        patchReport(kind, id, {
          ...patch,
          fixNote: text,
          fixAt: new Date().toISOString(),
        });
      }
      setLog((rows) => [
        ...rows,
        {
          who: "bot",
          text: res.summary || "Ingen ændring.",
          changes: res.changes ?? [],
        },
      ]);
    } catch {
      setLog((rows) => [...rows, { who: "bot", text: "Botten svarede ikke. Prøv igen, eller ret felterne selv." }]);
    } finally {
      setBusy(false);
    }
  }

  function saveFields() {
    patchReport(kind, id, {
      ...fieldsPatch(kind, fields),
      fixAt: new Date().toISOString(),
    });
    setLog((rows) => [...rows, { who: "bot", text: "Felter gemt." }]);
  }

  return (
    <div className="no-print sticky top-[52px] z-10 border-b border-brick/30 bg-sand px-3 py-3">
      <p className="text-sm font-semibold text-navy">Ret-bot</p>
      <p className="text-sm text-ink">Beskriv alle fejl. Jeg retter titel, sted, tekst, punkt og pris — ikke kun ét felt.</p>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-paper px-3 py-2">
        {log.map((row, i) => (
          <div key={`${row.who}-${i}`} className={row.who === "me" ? "text-right" : ""}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.who === "me" ? "Du" : "Ret-bot"}</p>
            <p className="text-sm text-ink">{row.text}</p>
            {row.changes && row.changes.length ? (
              <ul className="mt-1 space-y-1 text-left text-sm">
                {row.changes.map((c) => (
                  <li key={c.field} className="rounded-lg bg-white px-2 py-1">
                    <span className="font-semibold text-navy">{c.label}:</span>{" "}
                    <span className="text-muted">{c.from}</span>
                    <span className="mx-1 text-brick">→</span>
                    <span className="text-ink">{c.to}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {busy ? <p className="text-sm text-muted">Læser rapporten og retter det du beskriver…</p> : null}
      </div>
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2 text-base text-ink"
        placeholder="Fx: Titlen skal være Omfugning skorsten top. Det er taget, 1. sal. Beskrivelsen skal nævne udkradsning, stillads og overdækning. Pris 8.500 kr."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void runBot();
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PrimaryButton className="w-auto px-5" onClick={() => void runBot()} disabled={!note.trim() || busy}>
          {busy ? "Retter…" : "Send til bot"}
        </PrimaryButton>
        <GhostButton onClick={() => setOpen((v) => !v)}>{open ? "Skjul felter" : "Ret felter selv"}</GhostButton>
        {report && "fixAt" in report && report.fixAt ? (
          <span className="text-xs text-muted">Sidst rettet {copenhagenDateTime(report.fixAt as string)}</span>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {kind === "ks" ? (
            <label className="text-sm font-medium text-navy">
              Kontrolpunkt
              <select
                className="mt-1 min-h-11 w-full rounded-xl border-2 border-navy/20 bg-white px-3 text-base"
                value={fields.point ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, point: e.target.value }))}
              >
                {plan.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <FixInput label="Titel" value={fields.title ?? ""} onChange={(v) => setFields((f) => ({ ...f, title: v }))} />
          )}
          {kind === "slip" || kind === "ent" ? (
            <FixInput label="Lokation" value={fields.location ?? ""} onChange={(v) => setFields((f) => ({ ...f, location: v }))} />
          ) : null}
          {kind === "slip" ? (
            <FixInput label="Pris ekskl. moms" value={fields.customerPrice ?? ""} onChange={(v) => setFields((f) => ({ ...f, customerPrice: v }))} />
          ) : null}
          {kind === "ks" ? (
            <FixInput label="Sjak" value={fields.crew ?? ""} onChange={(v) => setFields((f) => ({ ...f, crew: v }))} />
          ) : null}
          {kind === "tf" ? (
            <label className="text-sm font-medium text-navy sm:col-span-2">
              Spørgsmål
              <textarea className="mt-1 min-h-24 w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2 text-base" value={fields.question ?? ""} onChange={(e) => setFields((e2) => ({ ...e2, question: e.target.value }))} />
            </label>
          ) : null}
          {kind === "slip" || kind === "ent" || kind === "ks" ? (
            <label className="text-sm font-medium text-navy sm:col-span-2">
              {kind === "ks" ? "Afvigelser" : "Beskrivelse"}
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2 text-base"
                value={kind === "ks" ? (fields.deviations ?? "") : (fields.body ?? "")}
                onChange={(e) => setFields((f) => ({ ...f, [kind === "ks" ? "deviations" : "body"]: e.target.value }))}
              />
            </label>
          ) : null}
          {kind === "slip" ? (
            <label className="text-sm font-medium text-navy sm:col-span-2">
              Kunde bemærkning
              <textarea className="mt-1 min-h-20 w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2 text-base" value={fields.masterSolution ?? ""} onChange={(e) => setFields((f) => ({ ...f, masterSolution: e.target.value }))} />
            </label>
          ) : null}
          {kind === "ent" ? (
            <label className="text-sm font-medium text-navy sm:col-span-2">
              Kunde bemærkning
              <textarea className="mt-1 min-h-20 w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2 text-base" value={fields.noteHe ?? ""} onChange={(e) => setFields((f) => ({ ...f, noteHe: e.target.value }))} />
            </label>
          ) : null}
          <PrimaryButton className="sm:col-span-2" onClick={saveFields}>
            Gem felter
          </PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}

function welcome(): { who: "bot" | "me"; text: string; changes?: FixChange[] } {
  return {
    who: "bot",
    text: "Hvad skal rettes? Skriv titel, sted, tekst, punkt og pris. Jeg retter hele rapporten.",
  };
}

function FixInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm font-medium text-navy">
      {label}
      <input className="mt-1 min-h-11 w-full rounded-xl border-2 border-navy/20 bg-white px-3 text-base" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function fieldsFrom(kind: ReportKind, report: Slip | Tf | Entrepreneur | InvoicePack | KsReport | undefined): Record<string, string> {
  if (!report) return {};
  if (kind === "slip") {
    const s = report as Slip;
    return { title: s.title, location: s.location, body: s.body, masterSolution: s.masterSolution, customerPrice: s.customerPrice };
  }
  if (kind === "tf") {
    const t = report as Tf;
    return { title: t.title ?? "", question: t.question };
  }
  if (kind === "ent") {
    const e = report as Entrepreneur;
    return { title: e.title, location: e.location, body: e.body, noteHe: e.noteHe };
  }
  if (kind === "pack") {
    const p = report as InvoicePack;
    return { title: p.title };
  }
  const k = report as KsReport;
  return { point: k.point, deviations: k.deviations ?? "", crew: k.crew ?? "", employeeName: k.employeeName ?? "" };
}

function fieldsPatch(kind: ReportKind, fields: Record<string, string>): Record<string, unknown> {
  if (kind === "slip") return { title: fields.title, location: fields.location, body: fields.body, masterSolution: fields.masterSolution, customerPrice: fields.customerPrice };
  if (kind === "tf") return { title: fields.title, question: fields.question };
  if (kind === "ent") return { title: fields.title, location: fields.location, body: fields.body, noteHe: fields.noteHe };
  if (kind === "pack") return { title: fields.title };
  return { point: fields.point, deviations: fields.deviations, crew: fields.crew, employeeName: fields.employeeName };
}

function Letterhead({ number, title }: { number: string; title: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-brick pb-4">
      <div className="flex items-center gap-3">
        <BrickMark className="size-10" />
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.2em] text-navy">{LETTERHEAD.mark}</p>
          <p className="text-xs text-muted">
            {LETTERHEAD.line} · {LETTERHEAD.cvr} · {LETTERHEAD.mail}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-xl text-navy">{number}</p>
        <p className="text-sm text-muted">{title}</p>
      </div>
    </header>
  );
}

function A4({ children, white }: { children: ReactNode; white?: boolean }) {
  return (
    <article className={`doc-a4 mx-auto shadow-card ${white ? "bg-white text-black" : "bg-paper text-ink"}`}>
      {children}
    </article>
  );
}

function LogoMark() {
  return <img src="/zenko-logo.svg" alt="ZENKO DANMARK" className="mb-2 ml-auto h-16 w-16 object-contain" />;
}

function FirmBlock({ align = "right" }: { align?: "right" | "left" }) {
  return (
    <div className={align === "right" ? "text-right text-sm" : "text-sm"}>
      <LogoMark />
      <div className="font-bold">ZENKO DANMARK</div>
      <div className="text-gray-700">CVR: {FIRM_CVR}</div>
      <div className="text-gray-700">{FIRM_MAIL}</div>
    </div>
  );
}

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4">
      {title ? <h2 className="mb-3 text-xl font-bold">{title}</h2> : null}
      <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

function kundeOf(job: Project) {
  return job.customer || "Ole Jepsen A/S";
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function dmyDash(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function dmyDot(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function priceLabel(raw: string) {
  const digits = String(raw || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return "0,-";
  return `${Math.round(n).toLocaleString("da-DK")},-`;
}

export function SlipDoc({ slip }: { slip: Slip }) {
  const job = lookupProject(slip.projectId);
  return (
    <A4 white>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Aftaleseddel nr: {slip.number}</h1>
          <p className="mt-1 text-lg text-gray-700">{slip.title}</p>
        </div>
        <FirmBlock />
      </div>
      <div className="mt-4 h-0.5 bg-black" />
      <div className="mt-4 space-y-1.5">
        <p>
          <span className="font-bold">Til:</span> {kundeOf(job)}
        </p>
        <p>
          <span className="font-bold">Dato:</span> {longDate(slip.createdAt)}
        </p>
        <p>
          <span className="font-bold">Byggesag:</span> {job.name}
        </p>
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-xl font-bold">Beskrivelse:</h2>
        <Box>{slip.body || "Ingen beskrivelse"}</Box>
      </div>
      <div className="mt-5">
        <h2 className="mb-3 text-xl font-bold">Kunde bemærkning:</h2>
        <Box>{slip.masterSolution || "Ingen bemærkning"}</Box>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Box>
          <div className="font-bold">Lokation:</div>
          <div className="mt-1">{slip.location || "Ikke angivet"}</div>
        </Box>
        <Box>
          <div className="font-bold">Pris eksl moms:</div>
          <div className="mt-1 text-xl">{priceLabel(slip.customerPrice)}</div>
        </Box>
      </div>
      <FieldBilag ids={slip.photoIds} label="Billeder:" />
    </A4>
  );
}

export function SlipInternalFlags({ slip, onForwarded, onPaid }: { slip: Slip; onForwarded: () => void; onPaid: () => void }) {
  return (
    <div className="no-print mx-auto mt-3 flex max-w-[210mm] flex-wrap items-center gap-2 px-4 text-sm">
      <span className="text-xs text-muted">Internt (ikke på kundesedlen):</span>
      <Chip tone={slip.forwarded ? "ok" : "sand"}>{slip.forwarded ? "Fremsendt" : "Ikke fremsendt"}</Chip>
      <Chip tone={slip.paid ? "ok" : "sand"}>{slip.paid ? "Betalt" : "Ikke betalt"}</Chip>
      <GhostButton onClick={onForwarded}>Mærk fremsendt</GhostButton>
      <GhostButton onClick={onPaid}>Mærk betalt</GhostButton>
    </div>
  );
}

export function TfDoc({ tf, onAnswer }: { tf: Tf; onAnswer?: (answer: string) => void }) {
  const job = lookupProject(tf.projectId);
  const [draft, setDraft] = useState(tf.answer ?? "");
  return (
    <A4 white>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">Teknisk Forespørgsel</h1>
        <div className="text-right text-sm">
          <div className="font-bold">ZENKO DANMARK</div>
          <div className="text-gray-700">CVR: {FIRM_CVR}</div>
          <div className="text-gray-700">{FIRM_MAIL}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Teknisk Forespørgsel Nr</p>
          <p className="text-2xl font-bold text-navy">#{tf.number}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Kunde</p>
          <p className="text-lg font-semibold">{kundeOf(job)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Dato</p>
          <p className="text-lg font-semibold">{dmyDot(tf.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Projekt</p>
          <p className="text-lg font-semibold">{job.name}</p>
        </div>
      </div>
      <div className="mt-6 rounded-lg border-l-4 border-navy bg-navy/5 p-4">
        <p className="text-lg font-semibold">{tf.title || tf.question}</p>
      </div>
      {tf.title ? <p className="mt-4 whitespace-pre-wrap leading-relaxed">{tf.question}</p> : null}
      <div className="mt-6">
        <h3 className="mb-3 text-xl font-semibold">Svar</h3>
        {(tf.ledelseReplies ?? []).length ? (
          <div className="mb-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Svar fra byggeledelse</p>
            {(tf.ledelseReplies ?? []).map((r) => (
              <div key={r.id} className="border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-500">{dmyDot(r.at)}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.text}</p>
              </div>
            ))}
          </div>
        ) : null}
        {onAnswer ? (
          <>
            <textarea
              className="no-print min-h-40 w-full rounded-lg border-2 border-gray-300 p-3 text-base"
              placeholder="Skriv dit svar her..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="hidden whitespace-pre-wrap print:block">{draft || tf.answer || "Intet svar endnu."}</p>
            <button
              type="button"
              className="no-print mt-3 min-h-12 rounded-lg bg-[#22C55E] px-10 text-lg font-bold text-white disabled:opacity-50"
              disabled={!draft.trim()}
              onClick={() => onAnswer(draft.trim())}
            >
              SEND SVAR
            </button>
          </>
        ) : (
          <Box>{tf.answered ? tf.answer : "Intet svar endnu."}</Box>
        )}
      </div>
      <FieldBilag ids={tf.photoIds} label="Foto" />
    </A4>
  );
}

export function EntDoc({ ent }: { ent: Entrepreneur }) {
  const job = lookupProject(ent.projectId);
  return (
    <A4 white>
      <h1 className="text-4xl font-bold uppercase tracking-tight">Entreprenørrapport nr {ent.number}</h1>
      <p className="mt-1 text-xl text-gray-600">{ent.title}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <p>
            <span className="font-semibold">Dato: </span>
            {dmyDash(ent.createdAt)}
          </p>
          <p>
            <span className="font-semibold">Projekt: </span>
            {job.name}
          </p>
          <p>
            <span className="font-semibold">Til: </span>
            {kundeOf(job)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">Zenko Danmark Aps</p>
          <p className="text-gray-600">CVR: {FIRM_CVR}</p>
        </div>
      </div>
      <p className="mt-6 border-b border-gray-300 py-3">
        <span className="font-semibold">Lokation: </span>
        {ent.location || "N/A"}
      </p>
      <div className="mt-6">
        <Box title="Beskrivelse">{ent.body || "Ingen beskrivelse"}</Box>
      </div>
      <div className="mt-5">
        <Box title="Kunde bemærkning">{ent.noteHe || "Ingen bemærkning"}</Box>
      </div>
      <FieldBilag ids={ent.photoIds} label="Fotos" />
    </A4>
  );
}

function FieldBilag({ ids, label }: { ids: string[]; label: string }) {
  const fieldItems = useYard((s) => s.fieldItems);
  const [open, setOpen] = useState<string | null>(null);
  const items = [...softrAsFieldItems(), ...fieldItems].filter((f, i, all) => {
    if (all.findIndex((x) => x.id === f.id) !== i) return false;
    return ids.includes(f.id) || ids.includes(f.driveFileId ?? "");
  });
  const leftover = ids.filter((id) => id && !items.some((it) => it.id === id || it.driveFileId === id) && !id.startsWith("softr-"));
  if (!items.length && !leftover.length) return null;
  const shown = open ? items.find((i) => i.id === open) : null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xl font-bold">{label}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="aspect-square overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100"
            onClick={() => (it.dataUrl || it.driveUrl || it.driveFileId) && setOpen(it.id)}
          >
            {it.dataUrl ? (
              <img src={it.dataUrl} alt={it.name} className="h-full w-full object-cover" />
            ) : it.driveFileId ? (
              <DrivePhoto
                photo={{
                  id: it.driveFileId,
                  dataUrl: "",
                  takenAt: it.takenAt,
                  floor: "",
                  room: "",
                  point: "",
                  gpsLabel: it.gpsLabel ?? "",
                  lat: it.lat ?? null,
                  lng: it.lng ?? null,
                  accuracyM: null,
                  gpsSource: "unknown",
                  projectId: it.projectId,
                  projectName: it.projectName,
                  employeeId: it.employeeId,
                  employeeName: it.employeeName,
                  driveFileId: it.driveFileId,
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center p-2 text-xs text-gray-600">{it.name}</span>
            )}
          </button>
        ))}
        {leftover.map((id) => (
          <div key={id} className="aspect-square overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100">
            <DrivePhoto
              photo={{
                id,
                dataUrl: "",
                takenAt: "",
                floor: "",
                room: "",
                point: "",
                gpsLabel: "",
                lat: null,
                lng: null,
                accuracyM: null,
                gpsSource: "unknown",
                projectId: "",
                projectName: "",
                employeeId: "",
                employeeName: "",
                driveFileId: id,
              }}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      {shown?.dataUrl ? (
        <button type="button" className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <img src={shown.dataUrl} alt={shown.name} className="max-h-[90vh] max-w-full object-contain" />
        </button>
      ) : null}
    </section>
  );
}

export function KsDoc({ report, photos }: { report: KsReport; photos: KsPhoto[] }) {
  const job = lookupProject(report.projectId);
  const plan = controlPlanFor(report.projectId);
  const point = findControlPoint(report.point, report.projectId);
  const hits = (() => {
    const tagged = Array.isArray(report.photoIds)
      ? photos.filter((p) => report.photoIds!.includes(p.driveFileId ?? "") || report.photoIds!.includes(p.id))
      : photos.filter((p) => p.projectId === report.projectId && p.point === report.point);
    if (tagged.length) return tagged;
    const softr = photos.filter((p) => p.id.startsWith(`softr-ks-${report.number}-`));
    if (softr.length) return softr;
    const leftover = (report.photoIds ?? []).filter((id) => id && !id.startsWith("softr-") && !id.startsWith("fld-"));
    return leftover.map((id) => ({
      id,
      dataUrl: "",
      takenAt: report.createdAt,
      floor: "",
      room: "",
      point: report.point,
      gpsLabel: report.location ?? "",
      lat: null,
      lng: null,
      accuracyM: null,
      gpsSource: "unknown" as const,
      projectId: report.projectId,
      projectName: job.name,
      employeeId: "",
      employeeName: report.employeeName ?? "",
      driveFileId: id,
    }));
  })();
  const shown = hits.slice(0, 8);
  const approved = report.approved !== false;
  const udbud = job.id === "job-hillerodsholm" ? "K01_C08_002_Murer.pdf" : "udbudsmateriale";
  return (
    <A4 white>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-5xl font-semibold tracking-tight">Proceskontrol</h1>
        <div className="text-right">
          <p className="text-lg text-gray-800">Nr. {report.number}</p>
          <img src="/zenko-logo.svg" alt="ZENKO DANMARK" className="ml-auto mt-2 h-16 w-16 object-contain" />
        </div>
      </div>

      <section className="mt-6 rounded-xl bg-[#f6e7c8] px-4 py-4">
        <p className="font-medium">Ved afvigelser beskrives de her:</p>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{report.deviations?.trim() || "Ingen afvigelser."}</p>
      </section>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KsField label="Tid">{copenhagenTime(report.createdAt)}</KsField>
        <KsField label="Dato">{dmyDash(report.createdAt)}</KsField>
        <KsField label="Projekt">{job.name}</KsField>
        <KsField label="Firma">{report.company ?? "Zenko Danmark Aps"}</KsField>
        <KsField label="Proces">{report.process ?? "Murerarbejde"}</KsField>
        <KsField label="Fag">{report.trade ?? "Murer"}</KsField>
        <KsField label="Godkendt">{approved ? "Ja" : "Nej"}</KsField>
        <KsField label="Navn">{report.employeeName ?? "—"}</KsField>
        <KsField label="Sjak">{report.crew ?? "—"}</KsField>
        <KsField label="Lokation">{report.location ?? "—"}</KsField>
        <KsField label="Opgave">{report.task ?? point?.title ?? "—"}</KsField>
        <KsField label="Kontrolomfang">{report.qcScope ?? point?.qcScope ?? "—"}</KsField>
        <KsField label="Metode">{report.qcMethod ?? "Visuel/foto kontrol"}</KsField>
      </dl>

      <section className="mt-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-600">
              <th className="py-2 pr-2 font-medium">Kontrolpunkt</th>
              <th className="py-2 pr-2 font-medium">Proces</th>
              <th className="py-2 font-medium">Kontroltype</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((row) => (
              <tr key={row.code} className={`border-b border-gray-200 ${row.code === report.point ? "bg-[#f6e7c8]/60" : ""}`}>
                <td className="py-2.5 pr-2">
                  <span className="font-semibold">{row.code}</span>
                  <span className="ml-2">{row.title}</span>
                </td>
                <td className="py-2.5 pr-2">{row.process ?? "Murerarbejde"}</td>
                <td className="py-2.5">{row.controlType ?? row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">Kontrolplan hentet fra udbud: {udbud}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-4xl tracking-tight">BILLEDER</h2>
        {shown.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">Ingen fotos på denne rapport.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {shown.map((h) => (
              <li key={h.id}>
                <DrivePhoto photo={h} className="w-full rounded-sm object-cover" />
                <p className="mt-2 text-sm leading-relaxed">
                  KS {h.point} {findControlPoint(h.point, report.projectId)?.title ?? point?.title ?? ""} {h.employeeName} {h.floor} {h.room} {copenhagenDateTime(h.takenAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </A4>
  );
}

function KsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f3efe8] px-4 py-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-black">{children}</dd>
    </div>
  );
}

function parseKr(s: string) {
  return Number(s.replace(/[^\d]/g, "")) || 0;
}

export function PackDoc({ pack, slips }: { pack: InvoicePack; slips: Slip[] }) {
  const job = lookupProject(pack.projectId);
  const chosen = pack.slipIds.map((id) => slips.find((s) => s.id === id)).filter(Boolean) as Slip[];
  const total = chosen.reduce((sum, s) => sum + parseKr(s.customerPrice), 0);
  return (
    <div className="space-y-8">
      <A4>
        <Letterhead number={pack.number} title="Månedens fakturabilag — side 1, oversigt" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-navy">{pack.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {job.name} · {job.address}
        </p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {chosen.map((s) => (
              <tr key={s.id} className="border-b border-line">
                <td className="py-2">{s.number}</td>
                <td>{s.title}</td>
                <td className="text-right">{s.customerPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 font-display text-2xl text-navy">Total {total.toLocaleString("da-DK")} kr.</p>
      </A4>
      {chosen.map((s) => (
        <div key={s.id} className="doc-page-break">
          <SlipDoc slip={s} />
        </div>
      ))}
    </div>
  );
}
