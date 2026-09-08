import { useEffect, useState } from "react";
import { BrickMark, GhostButton, PrimaryButton } from "@/components/zenko";
import { FIRM_CVR, FIRM_MAIL } from "@/lib/seed";
import { answerTfShare, getTfShare } from "@/lib/tf-share.functions";
import type { TfSharePhoto, TfShareRecord } from "@/lib/tf-share";

function dmyDot(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TfSharePage({ token }: { token: string }) {
  const [share, setShare] = useState<TfShareRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void getTfShare({ data: { token } }).then((res) => {
      if (!live) return;
      if (!res.ok) {
        setMissing(true);
        setShare(null);
      } else {
        setShare(res.share);
        setMissing(false);
      }
      setBusy(false);
    });
    return () => {
      live = false;
    };
  }, [token]);

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
            <p className="mt-2 text-sm leading-relaxed text-muted">Linket er ugyldigt eller udløbet. Bed Zenko sende et nyt link til den tekniske forespørgsel.</p>
          </div>
        ) : null}
        {share ? <TfShareView share={share} onAnswered={setShare} /> : null}
      </div>
    </main>
  );
}

function TfShareView({ share, onAnswered }: { share: TfShareRecord; onAnswered: (row: TfShareRecord) => void }) {
  const [draft, setDraft] = useState(share.answer);
  const [who, setWho] = useState(share.answeredBy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = open ? share.photos.find((p) => p.id === open) : null;

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await answerTfShare({ data: { token: share.token, answer: text, answeredBy: who.trim() } });
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
    <article className="doc-a4 mx-auto bg-white text-black shadow-card">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">Teknisk Forespørgsel</h1>
        <div className="text-right text-sm">
          <div className="font-bold">ZENKO DANMARK</div>
          <div className="text-gray-700">CVR: {FIRM_CVR}</div>
          <div className="text-gray-700">{FIRM_MAIL}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Meta label="Teknisk Forespørgsel Nr" value={`#${share.number}`} />
        <Meta label="Kunde" value={share.customer} />
        <Meta label="Dato" value={dmyDot(share.createdAt)} />
        <Meta label="Projekt" value={share.projectName} />
      </div>
      {share.address ? <p className="mt-2 text-sm text-gray-600">{share.address}</p> : null}
      <div className="mt-6 rounded-lg border-l-4 border-navy bg-navy/5 p-4">
        <p className="text-lg font-semibold">{share.title || share.question}</p>
      </div>
      {share.title ? <p className="mt-4 whitespace-pre-wrap leading-relaxed">{share.question}</p> : null}
      <SharePhotos photos={share.photos} onOpen={setOpen} />
      <div className="mt-6">
        <h3 className="mb-3 text-xl font-semibold">Svar</h3>
        {share.answeredAt ? (
          <div className="mb-4 rounded-xl border-2 border-moss/30 bg-moss/5 px-4 py-4">
            <p className="whitespace-pre-wrap leading-relaxed">{share.answer}</p>
            <p className="mt-2 text-sm text-moss">
              Besvaret {dmyDot(share.answeredAt)}
              {share.answeredBy ? ` af ${share.answeredBy}` : ""}
            </p>
          </div>
        ) : null}
        <label className="text-sm font-medium text-navy">
          Navn / firma
          <input
            className="mt-1 min-h-11 w-full rounded-lg border-2 border-gray-300 px-3 text-base"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Fx. byggeleder, Ole Jepsen A/S"
          />
        </label>
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border-2 border-gray-300 p-3 text-base"
          placeholder="Skriv jeres svar her…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error ? <p className="mt-2 text-sm text-brick">{error}</p> : null}
        <PrimaryButton className="mt-3 w-auto px-10" disabled={!draft.trim() || busy} onClick={() => void send()}>
          {busy ? "Sender…" : share.answeredAt ? "Opdatér svar" : "Send svar"}
        </PrimaryButton>
      </div>
      <div className="no-print mt-8 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
        <GhostButton onClick={() => window.print()}>Print / PDF</GhostButton>
      </div>
      {shown ? (
        <button type="button" className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-navy/90 p-4" onClick={() => setOpen(null)}>
          <img src={shown.src} alt={shown.name} className="max-h-[90vh] max-w-full object-contain" />
        </button>
      ) : null}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function SharePhotos({ photos, onOpen }: { photos: TfSharePhoto[]; onOpen: (id: string) => void }) {
  if (!photos.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xl font-bold">Foto</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((it) => (
          <button key={it.id || it.src} type="button" className="aspect-square overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100" onClick={() => onOpen(it.id || it.src)}>
            <img src={it.src} alt={it.name} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
