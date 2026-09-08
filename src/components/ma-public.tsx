import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActionPng, BackArrow } from "@/components/sag-icons";
import { DrivePhoto } from "@/components/drive-photo";
import { getMaPublic, postMaPhoto, postMaThread, toggleMaLine } from "@/lib/ma-public.functions";
import {
  dummyMaOrder,
  emptyMaOrder,
  findOrderByPublic,
  isMaPreview,
  isValidMaLineParam,
  maDateShort,
  maLinesComplete,
  maTelHref,
  toMaPublic,
  type MaPublicLine,
  type MaPublicOrder,
} from "@/lib/ma-public";
import { fileHref } from "@/lib/plads-file";
import { compressImageFile } from "@/lib/field-media";
import { connectorUserText } from "@/lib/connector-msg";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { MaThreadMsg } from "@/lib/types";

export const MA_FONT = {
  rel: "stylesheet" as const,
  href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Inter:wght@400;500;600&display=swap",
};

export function maHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { name: "description", content: description },
      { name: "theme-color", content: "#fffaf6" },
    ],
    links: [MA_FONT],
  };
}

export function MaShell({ children }: { children: ReactNode }) {
  return (
    <main className="ma-a">
      <div className="mx-auto max-w-[42rem] px-6 py-10 pb-24 sm:px-10 sm:py-16">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#1c1917]">ZENKO DANMARK</p>
        {children}
      </div>
    </main>
  );
}

export function MaMissing() {
  return (
    <MaShell>
      <p className="mt-16 text-3xl font-light">Siden findes ikke</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6f6a63]">Linket er ugyldigt, eller ordren er ikke oprettet endnu.</p>
    </MaShell>
  );
}

function MaLabel({ children }: { children: ReactNode }) {
  return <dt className="text-[0.68rem] tracking-[0.18em] text-[#6f6a63] uppercase">{children}</dt>;
}

export function useMaPublicOrder(slug: string, nr: string) {
  const orders = useYard((s) => s.orders);
  const receipts = useYard((s) => s.receipts);
  const projects = useYard((s) => s.projects);
  const local = useMemo(() => {
    const hit = findOrderByPublic(orders, slug, nr, projects);
    return hit ? toMaPublic(hit, receipts.filter((r) => r.orderId === hit.id), projects) : null;
  }, [orders, receipts, projects, slug, nr]);
  const [remote, setRemote] = useState<MaPublicOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(!local);

  useEffect(() => {
    let live = true;
    void getMaPublic({ data: { slug, nr } })
      .then((res) => {
        if (!live) return;
        if (res.ok && res.order && !res.order.missingData) setRemote(res.order);
        else if (!local) {
          if (isMaPreview() && slug === "islevvaenge" && (nr === "017" || nr === "17")) setRemote(dummyMaOrder());
          else {
            setRemote(res.order ?? emptyMaOrder(slug, nr));
            setMissing(!res.order || res.order.missingData);
          }
        }
        setBusy(false);
      })
      .catch(() => {
        if (!live) return;
        if (local) {
          setBusy(false);
          return;
        }
        if (isMaPreview() && slug === "islevvaenge" && (nr === "017" || nr === "17")) setRemote(dummyMaOrder());
        else setMissing(true);
        setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [slug, nr, local]);

  const order = local ?? (remote && !remote.missingData ? remote : remote);
  return { order, missing: missing && !order, busy, applyRemote: setRemote };
}

export function MaHome({ slug, nr }: { slug: string; nr: string }) {
  const { order, missing, busy, applyRemote } = useMaPublicOrder(slug, nr);
  const me = useSessionEmployee();
  const addThread = useYard((s) => s.addOrderThread);
  const toggleLocal = useYard((s) => s.toggleOrderLine);
  const addReceipt = useYard((s) => s.addReceipt);
  const [text, setText] = useState("");
  const [localThread, setLocalThread] = useState<MaThreadMsg[]>([]);
  const [err, setErr] = useState("");
  const [busySend, setBusySend] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  if (busy && !order) {
    return (
      <MaShell>
        <p className="mt-16 text-sm text-[#6f6a63]">Henter ordre…</p>
      </MaShell>
    );
  }
  if (missing || !order) return <MaMissing />;
  const thread = [...(order.thread ?? []), ...localThread];
  const tel = maTelHref(order.phone);
  const who = me?.name || "Trælast";

  async function sendThread() {
    const body = text.trim();
    if (!body || !order || busySend) return;
    setBusySend(true);
    setErr("");
    const msg: MaThreadMsg = {
      from: me ? (me.role === "mester" ? "mester" : "ansat") : "leverandor",
      name: who,
      text: body,
      at: new Date().toISOString(),
    };
    setText("");
    setLocalThread((cur) => [...cur, msg]);
    if (order.id && !order.dummy) addThread(order.id, msg);
    if (!order.dummy) {
      const res = await postMaThread({ data: { slug, nr, msg } });
      if (!res.ok) setErr(connectorUserText("da", res.error, res.loginRequired));
    }
    setBusySend(false);
  }

  async function hak(n: string, index: number) {
    if (!order || order.dummy) return;
    setErr("");
    if (order.id) toggleLocal(order.id, index, who);
    const res = await toggleMaLine({ data: { slug, nr, n, who } });
    if (!res.ok) setErr(connectorUserText("da", res.error, res.loginRequired));
    else if (res.order) applyRemote(res.order);
  }

  async function addPhoto(list: FileList | null) {
    const file = list?.[0];
    if (!file || !order || order.dummy) return;
    setErr("");
    try {
      const made = await compressImageFile(file);
      const base64 = made.dataUrl.split(",")[1];
      if (!base64) return;
      const res = await postMaPhoto({
        data: { slug, nr, name: file.name || "foto.jpg", mimeType: "image/jpeg", contentBase64: base64, kind: "receipt" },
      });
      if (!res.ok) setErr(connectorUserText("da", res.error, res.loginRequired));
      else {
        if (res.order) applyRemote(res.order);
        if (res.fileId && me && order.id) {
          addReceipt({
            orderId: order.id,
            projectId: order.projectId,
            employeeId: me.id,
            source: "levering",
            photoFileIds: [res.fileId],
          });
        }
      }
    } catch {
      setErr("Drive tog ikke imod billedet.");
    }
  }

  return (
    <MaShell>
      <header className="mt-6 grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b-2 border-[#1c2428] pb-3">
        <p className="text-3xl font-semibold leading-none text-[#1c1917]">Z</p>
        <div>
          <p className="text-xl font-semibold tracking-tight">{order.label}</p>
          <div className="mt-1 h-px w-16 bg-[#1c2428]" />
        </div>
        <p className="text-sm text-[#1c1917]">{maDateShort(order.orderedAt || new Date().toISOString())}</p>
      </header>

      <p className="mt-5 flex items-start gap-2 text-base">
        <span aria-hidden>⌂</span>
        <span>
          {order.sag}
          {order.address ? ` / ${order.address}` : ""}
        </span>
      </p>
      <div className="mt-3 h-px bg-[#1c2428]" />
      <p className="mt-3 flex items-center gap-2 text-base">
        <span aria-hidden>☎</span>
        {tel ? (
          <a href={tel} className="text-[#1c1917] underline decoration-[#1c2428]">
            {order.phone}
          </a>
        ) : (
          <span>{order.phone || "—"}</span>
        )}
      </p>
      <div className="mt-3 h-px bg-[#1c2428]" />
      {order.driverNote ? (
        <p className="mt-3 flex items-start gap-2 text-base whitespace-pre-wrap">
          <span aria-hidden>🚚</span>
          <span>{order.driverNote}</span>
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[20px] border border-[#1c2428]">
        {order.lines.map((l, i) => (
          <div key={l.n} className="flex items-stretch border-b border-[#1c2428] last:border-b-0">
            <a href={`${order.publicPath}/${l.n}`} className="flex min-h-14 min-w-0 flex-1 items-start gap-3 px-3 py-3 text-[#1c1917] no-underline">
              <span className="w-8 shrink-0 text-sm font-semibold text-[#c45c3e]">{l.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium leading-snug">{l.product}</span>
                {l.spec ? <span className="mt-1 block font-['Caveat',cursive] text-[22px] leading-tight">{l.spec}</span> : null}
              </span>
              <span className="shrink-0 text-sm">
                {l.qty} {l.unit}
              </span>
            </a>
            <button
              type="button"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center border-l border-[#1c2428] px-3"
              aria-pressed={l.checked}
              onClick={() => void hak(l.n, i)}
            >
              <span className={`flex size-11 items-center justify-center rounded-[8px] border-2 border-[#1c2428] ${l.checked ? "bg-[#c45c3e] text-[#fffaf6]" : "bg-[#fffaf6]"}`}>
                {l.checked ? "✓" : ""}
              </span>
            </button>
          </div>
        ))}
      </div>
      {maLinesComplete(order.lines) ? <p className="mt-2 text-sm text-[#2f7d4a]">Ok — alle linjer hakket.</p> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-[20px] border border-[#1c2428] p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.16em]">Kamera + fotos</p>
          <div className="mt-3 flex gap-3">
            <button type="button" className="flex size-14 items-center justify-center rounded-[16px]" onClick={() => camRef.current?.click()}>
              <ActionPng name="camCompact" px={48} />
            </button>
            <button type="button" className="flex size-14 items-center justify-center rounded-[16px]" onClick={() => galRef.current?.click()}>
              <ActionPng name="gallery" px={48} />
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addPhoto(e.target.files)} />
          <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void addPhoto(e.target.files)} />
          {order.receiptPhotos.length ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {order.receiptPhotos.map((p) => (
                <li key={p.fileId}>
                  <a href={fileHref(p.fileId) || undefined} target="_blank" rel="noreferrer">
                    <DrivePhoto
                      photo={{ id: p.fileId, dataUrl: "", takenAt: "", floor: "", room: "", point: "", projectId: order.projectId, projectName: order.sag, employeeId: "", employeeName: "", driveFileId: p.fileId }}
                      className="aspect-square w-full object-cover"
                      compact
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="rounded-[20px] border border-[#1c2428] p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.16em]">Tråd</p>
          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
            {thread.map((m, i) => (
              <li key={`${m.at}-${i}`}>
                <p className="text-[11px] text-[#9aa3a6]">
                  {m.from === "leverandor" ? "Leverandør" : m.name || "Zenko"} · {maDateShort(m.at)}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              className="min-h-[4.5rem] flex-1 rounded-[16px] border border-[#1c2428] bg-[#fffaf6] px-3 py-2 text-base text-[#1c1917]"
              placeholder="Skriv…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="button" className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-[#c45c3e]" onClick={() => void sendThread()} aria-label="Send">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fffaf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22 11 13 2 9z" />
              </svg>
            </button>
          </div>
        </section>
      </div>
      {err ? <p className="mt-3 text-sm text-[#c45c3e]">{err}</p> : null}
    </MaShell>
  );
}

export function MaLinePage({ slug, nr, linje }: { slug: string; nr: string; linje: string }) {
  const { order, missing } = useMaPublicOrder(slug, nr);
  if (missing || !order) return <MaMissing />;
  if (!isValidMaLineParam(linje)) return <MaMissing />;
  const line = order.lines.find((l) => l.n === linje.padStart(2, "0") || Number(l.n) === Number(linje));
  if (!line) return <MaMissing />;
  return (
    <MaShell>
      <div className="ma-no-print mt-6">
        <BackArrow href={order.publicPath} label="Tilbage til ordre" />
      </div>
      <p className="mt-8 text-sm font-medium tracking-[0.18em] text-[#c45c3e]">{line.n}</p>
      <h1 className="mt-2 text-[clamp(2rem,4vw,2.4rem)] font-semibold leading-tight">{line.product}</h1>
      {line.spec ? <p className="mt-6 max-w-prose font-['Caveat',cursive] text-[22px] leading-tight">{line.spec}</p> : null}
      <p className="mt-6 text-base">
        {line.qty} {line.unit}
      </p>
      {line.productUrl ? (
        <a href={line.productUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block text-[#c45c3e] no-underline">
          Produktlink
        </a>
      ) : null}
      {line.photoFileIds.length ? (
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {line.photoFileIds.map((id) => (
            <li key={id}>
              <a href={fileHref(id) || undefined} target="_blank" rel="noreferrer">
                <DrivePhoto photo={{ id, dataUrl: "", takenAt: "", floor: "", room: "", point: "", projectId: order.projectId, projectName: order.sag, employeeId: "", employeeName: "", driveFileId: id }} className="aspect-square w-full object-cover" compact />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </MaShell>
  );
}

export function MaReceiptPage({ slug, nr }: { slug: string; nr: string }) {
  const { order, missing } = useMaPublicOrder(slug, nr);
  if (missing || !order) return <MaMissing />;
  return (
    <MaShell>
      <div className="ma-no-print mt-6">
        <BackArrow href={order.publicPath} label="Tilbage til ordre" />
      </div>
      <h1 className="mt-8 text-2xl font-semibold">Modtagekontrol</h1>
      <p className="mt-2 text-sm text-[#6f6a63]">{order.receiptPhotos.length} fotos</p>
      {order.receiptPhotos.length ? (
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {order.receiptPhotos.map((p) => (
            <li key={p.fileId}>
              <a href={fileHref(p.fileId) || undefined} target="_blank" rel="noreferrer">
                <DrivePhoto photo={{ id: p.fileId, dataUrl: "", takenAt: "", floor: "", room: "", point: "", projectId: order.projectId, projectName: order.sag, employeeId: "", employeeName: "", driveFileId: p.fileId }} className="aspect-square w-full object-cover" compact />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-sm text-[#6f6a63]">Ingen fotos endnu.</p>
      )}
    </MaShell>
  );
}

export function MaPdfPage({ slug, nr }: { slug: string; nr: string }) {
  const { order, missing } = useMaPublicOrder(slug, nr);
  useEffect(() => {
    if (!order || order.missingData) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [order]);
  if (missing || !order) return <MaMissing />;
  return (
    <MaShell>
      <div className="ma-no-print mb-8 flex gap-4 text-sm">
        <BackArrow href={order.publicPath} label="Tilbage" />
        <button type="button" className="text-[#c45c3e]" onClick={() => window.print()}>
          Udskriv / gem PDF
        </button>
      </div>
      <p className="text-3xl font-semibold">Z</p>
      <h1 className="mt-2 text-xl font-semibold">{order.label}</h1>
      <p className="mt-1 text-sm">{maDateShort(order.orderedAt || new Date().toISOString())}</p>
      <p className="mt-4">⌂ {order.sag}{order.address ? ` / ${order.address}` : ""}</p>
      <p className="mt-2">☎ {order.phone}</p>
      {order.driverNote ? <p className="mt-2 whitespace-pre-wrap">🚚 {order.driverNote}</p> : null}
      <ul className="mt-8">
        {order.lines.map((l) => (
          <li key={l.n} className="flex items-baseline gap-4 border-t border-[#1c2428] py-3">
            <span className="w-8 text-sm font-semibold text-[#c45c3e]">{l.n}</span>
            <span className="flex-1">
              {l.product}
              {l.spec ? <span className="mt-1 block font-['Caveat',cursive] text-[22px]">{l.spec}</span> : null}
            </span>
            <span className="text-sm">
              {l.qty} {l.unit}
            </span>
            <span>{l.checked ? "✓" : "☐"}</span>
          </li>
        ))}
      </ul>
    </MaShell>
  );
}

export function MaLineSource({ line }: { line: MaPublicLine }) {
  return <span>{line.source === "udbud" ? "Fra udbud" : "Udfyldt af mester"}</span>;
}
