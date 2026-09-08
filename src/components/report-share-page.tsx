import { useEffect, useState } from "react";
import { BrickMark, PrimaryButton } from "@/components/zenko";
import { FIRM_CVR, FIRM_MAIL } from "@/lib/seed";
import { answerReportShare, getReportShare } from "@/lib/report-share.functions";
import { bundledShareRecord, shareKindLabel, shareSlug, type ReportShareRecord, type ShareKind } from "@/lib/report-share";

function dmy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function priceLabel(raw: string) {
  const digits = String(raw || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return "0,-";
  return `${Math.round(n).toLocaleString("da-DK")},-`;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function ReportSharePage({ kind, number }: { kind: ShareKind; number: string }) {
  const local = bundledShareRecord(kind, number);
  const [share, setShare] = useState<ReportShareRecord | null>(local);
  const [missing, setMissing] = useState(!local);
  const [busy, setBusy] = useState(!local);

  useEffect(() => {
    let live = true;
    const fallback = bundledShareRecord(kind, number);
    if (fallback) {
      setShare(fallback);
      setMissing(false);
      setBusy(false);
    } else {
      setBusy(true);
    }
    void withTimeout(getReportShare({ data: { kind, number } }), 4000)
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          setShare(res.share);
          setMissing(false);
        } else if (!fallback) {
          setMissing(true);
          setShare(null);
        }
        setBusy(false);
      })
      .catch(() => {
        if (!live) return;
        if (fallback) {
          setShare(fallback);
          setMissing(false);
        } else {
          setMissing(true);
          setShare(null);
        }
        setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [kind, number]);

  return (
    <main className="min-h-dvh bg-sand pb-16 text-ink">
      <header className="border-b border-line bg-paper px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[210mm] items-center gap-3">
          <BrickMark className="size-8" />
          <p className="font-display text-xl font-semibold tracking-[0.18em] text-navy">ZENKO DANMARK</p>
        </div>
      </header>
      <div className="mx-auto max-w-[210mm] px-3 py-6">
        {busy ? <p className="text-sm text-muted">Henter rapporten…</p> : null}
        {missing ? (
          <div className="rounded-[20px] bg-paper px-5 py-8 shadow-card">
            <h1 className="font-display text-3xl text-navy">Rapporten findes ikke</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">Linket er ugyldigt, eller rapporten er ikke udgivet endnu. Bed Zenko sende et nyt link.</p>
          </div>
        ) : null}
        {share ? <ShareView share={share} onAnswered={setShare} /> : null}
      </div>
    </main>
  );
}

function ShareView({ share, onAnswered }: { share: ReportShareRecord; onAnswered: (row: ReportShareRecord) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = open ? share.photos.find((p) => p.id === open) : null;
  const kind = shareKindLabel(share.kind);

  return (
    <article className="doc-a4 mx-auto bg-white text-black shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {kind} {share.number}
          </h1>
          {share.title ? <p className="mt-1 text-lg text-gray-700">{share.title}</p> : null}
        </div>
        <div className="text-right text-sm">
          <img src="/zenko-logo.svg" alt="ZENKO DANMARK" className="mb-2 ml-auto h-16 w-16 object-contain" />
          <div className="font-bold">ZENKO DANMARK</div>
          <div className="text-gray-700">CVR: {FIRM_CVR}</div>
          <div className="text-gray-700">{FIRM_MAIL}</div>
        </div>
      </div>
      <div className="mt-4 h-0.5 bg-black" />
      <div className="mt-4 space-y-1.5">
        <p>
          <span className="font-bold">Til:</span> {share.customer}
        </p>
        <p>
          <span className="font-bold">Dato:</span> {dmy(share.createdAt)}
        </p>
        <p>
          <span className="font-bold">Byggesag:</span> {share.projectName}
        </p>
        {share.location ? (
          <p>
            <span className="font-bold">Lokation:</span> {share.location}
          </p>
        ) : null}
      </div>

      {share.kind === "ks" ? <KsFields share={share} /> : null}

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-bold">{share.kind === "ks" ? "Ved afvigelser:" : share.kind === "tf" ? "Spørgsmål:" : "Beskrivelse:"}</h2>
        <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4 whitespace-pre-wrap leading-relaxed">{share.body || "—"}</div>
      </section>

      {share.kind === "as" ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Box title="Kunde bemærkning">{share.extra.masterSolution || "Ingen bemærkning"}</Box>
          <Box title="Pris eksl moms">{priceLabel(share.extra.customerPrice || "")}</Box>
        </div>
      ) : null}

      {share.kind === "er" ? (
        <div className="mt-5">
          <Box title="Kunde bemærkning">{share.extra.noteHe || "Ingen bemærkning"}</Box>
        </div>
      ) : null}

      {share.kind === "tf" ? <TfAnswer share={share} onAnswered={onAnswered} /> : null}

      {share.photos.length ? (
        <section className="mt-6">
          <h2 className="mb-3 text-xl font-bold">Billeder</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {share.photos.map((p) => (
              <button key={p.id} type="button" className="overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100" onClick={() => setOpen(p.id)}>
                <img src={p.src} alt={p.name} className="aspect-square w-full object-cover" />
                {p.caption ? <p className="px-2 py-1 text-left text-xs text-gray-600">{p.caption}</p> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {shown ? (
        <button type="button" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <img src={shown.src} alt={shown.name} className="max-h-[90vh] max-w-full object-contain" />
        </button>
      ) : null}
    </article>
  );
}

function KsFields({ share }: { share: ReportShareRecord }) {
  const rows: [string, string][] = [
    ["Projekt", share.projectName],
    ["Punkt", share.extra.point || share.title],
    ["Opgave", share.title],
    ["Navn", share.extra.employeeName || "—"],
    ["Sjak", share.extra.crew || "—"],
    ["Proces", share.extra.process || "—"],
    ["Fag", share.extra.trade || "—"],
    ["Godkendt", share.extra.approved || "Ja"],
    ["Kontrolomfang", share.extra.qcScope || "—"],
    ["Metode", share.extra.qcMethod || "—"],
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[#f3efe8] px-4 py-3">
          <dt className="text-sm text-gray-500">{label}</dt>
          <dd className="text-lg font-semibold text-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Box({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

function TfAnswer({ share, onAnswered }: { share: ReportShareRecord; onAnswered: (row: ReportShareRecord) => void }) {
  const [draft, setDraft] = useState(share.answer);
  const [who, setWho] = useState(share.answeredBy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await answerReportShare({ data: { kind: "tf", number: shareSlug(share.number), answer: text, answeredBy: who.trim() } });
      if (!res.ok) {
        setError(res.error === "empty" ? "Skriv et svar." : "Kunne ikke gemme svaret. Prøv igen.");
        return;
      }
      onAnswered(res.share);
      setDraft(res.share.answer);
      setWho(res.share.answeredBy);
    } catch {
      setError("Kunne ikke gemme svaret. Prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xl font-bold">Svar</h2>
      {share.answeredAt && share.answer ? (
        <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4 whitespace-pre-wrap leading-relaxed">{share.answer}</div>
      ) : (
        <>
          <input
            className="mb-2 min-h-11 w-full rounded-lg border-2 border-gray-300 px-3 text-base"
            placeholder="Dit navn"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          />
          <textarea className="min-h-40 w-full rounded-lg border-2 border-gray-300 p-3 text-base" placeholder="Skriv dit svar her..." value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error ? <p className="mt-2 text-sm text-brick">{error}</p> : null}
          <PrimaryButton className="mt-3 w-auto px-8" disabled={!draft.trim() || busy} onClick={() => void send()}>
            {busy ? "Sender…" : "Send svar"}
          </PrimaryButton>
        </>
      )}
    </section>
  );
}
