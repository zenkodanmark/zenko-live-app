import { useState, type ReactNode } from "react";
import { FIRM_CVR, FIRM_MAIL } from "@/lib/seed";
import type { LedelseReply } from "@/lib/types";

function longDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function dmyDot(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-gray-300 bg-white px-4 py-4">
      {title ? <h2 className="mb-3 text-xl font-bold">{title}</h2> : null}
      <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

export type AsBlanketPhoto = { id: string; src: string; name?: string };

export function AsBlanket({
  heading,
  title,
  customer,
  createdAt,
  projectName,
  body,
  note,
  location,
  priceLabel,
  photos,
  replies,
}: {
  heading: string;
  title: string;
  customer: string;
  createdAt: string;
  projectName: string;
  body: string;
  note?: string;
  location?: string;
  priceLabel: string;
  photos?: AsBlanketPhoto[];
  replies?: LedelseReply[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = open ? (photos ?? []).find((p) => p.id === open) : null;
  const pics = photos ?? [];
  const comments = replies ?? [];

  return (
    <article className="doc-a4 mx-auto bg-white text-black shadow-card" data-testid="ledelse-slip">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{heading}</h1>
          {title ? <p className="mt-1 text-lg text-gray-700">{title}</p> : null}
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
          <span className="font-bold">Til:</span> {customer || "—"}
        </p>
        <p>
          <span className="font-bold">Dato:</span> {longDate(createdAt)}
        </p>
        <p>
          <span className="font-bold">Byggesag:</span> {projectName || "—"}
        </p>
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-xl font-bold">Beskrivelse:</h2>
        <Box>{body || "Ingen beskrivelse"}</Box>
      </div>
      <div className="mt-5">
        <h2 className="mb-3 text-xl font-bold">Kunde bemærkning:</h2>
        <Box>{note?.trim() || "Ingen bemærkning"}</Box>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Box>
          <div className="font-bold">Lokation:</div>
          <div className="mt-1">{location?.trim() || "Ikke angivet"}</div>
        </Box>
        <Box>
          <div className="font-bold">Pris eksl moms:</div>
          <div className="mt-1 text-xl">{priceLabel}</div>
        </Box>
      </div>
      {pics.length ? (
        <section className="mt-6">
          <h2 className="mb-3 text-xl font-bold">Billeder:</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pics.map((p) => (
              <button key={p.id} type="button" className="overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100" onClick={() => setOpen(p.id)}>
                <img src={p.src} alt={p.name || ""} className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {comments.length ? (
        <div className="mt-5">
          <h2 className="mb-3 text-xl font-bold">Byggeledelse:</h2>
          <div className="space-y-3">
            {comments.map((r) => (
              <Box key={r.id}>
                <div className="text-xs text-gray-500">{dmyDot(r.at)}</div>
                <div className="mt-1">{r.text}</div>
              </Box>
            ))}
          </div>
        </div>
      ) : null}
      {shown ? (
        <button type="button" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 no-print" onClick={() => setOpen(null)}>
          <img src={shown.src} alt={shown.name || ""} className="max-h-[90vh] max-w-full object-contain" />
        </button>
      ) : null}
    </article>
  );
}
