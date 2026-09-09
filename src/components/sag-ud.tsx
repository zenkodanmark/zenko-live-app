import { useEffect, useRef, useState } from "react";
import { ActionPng, CloseX, SagPng, type SagPngName } from "@/components/sag-icons";
import { SectionLabel } from "@/components/zenko";
import { t, type CopyKey } from "@/lib/i18n";
import { listPladsPrefix, pladsPath, uploadPladsBlob, uploadPladsBytes } from "@/lib/plads-file";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { gpsPatch, readGpsOrSite } from "@/lib/photo-meta";
import {
  UD_DAGS_TYPES,
  UD_ERFARING_TYPES,
  UD_FILE_ACCEPT,
  UD_FOLDERS,
  UD_GALLERY_ACCEPT,
  mimeForUdFile,
  type UdFileKind,
  type UdKey,
  udFallbackName,
  udFileKind,
  udFilePreviewable,
  udFolderName,
  udNoteSlug,
} from "@/lib/ud-folders";
import type { Lang } from "@/lib/types";

type Draft = { id: string; name: string; mimeType: string; dataUrl: string; file?: File };

let udListTick = 0;
const udListWatch = new Set<(n: number) => void>();
function bumpUdList() {
  udListTick += 1;
  for (const fn of udListWatch) fn(udListTick);
}
function useUdListTick() {
  const [n, setN] = useState(udListTick);
  useEffect(() => {
    udListWatch.add(setN);
    return () => {
      udListWatch.delete(setN);
    };
  }, []);
  return n;
}

function utf8b64(text: string) {
  return btoa(unescape(encodeURIComponent(text)));
}

function dataUrlB64(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function udPng(key: UdKey): SagPngName {
  if (key === "plads") return "plads";
  if (key === "erfaring") return "erfaring";
  return "dags";
}

function udLabelKey(key: UdKey) {
  if (key === "plads") return "udPlads" as const;
  if (key === "erfaring") return "udErfaring" as const;
  return "udDags" as const;
}

function udTypeKey(tp: string): CopyKey {
  if (tp === "Pladsregel") return "udTypeRule";
  if (tp === "Genvej") return "udTypeShortcut";
  if (tp === "Godkendt metode") return "udTypeMethod";
  if (tp === "Klargøring") return "udTypePrep";
  if (tp === "Vejr") return "udTypeWeather";
  if (tp === "Levering") return "udTypeDelivery";
  if (tp === "Andet fag") return "udTypeOther";
  if (tp === "Stop") return "udTypeStop";
  return "udNotePh";
}

function udUiLabel(lang: Lang, folderName: string) {
  const hit = UD_FOLDERS.find((f) => f.name === folderName);
  return hit ? t(lang, udLabelKey(hit.key)) : folderName.replace(/^\d+\s+/, "");
}

function CubeIcon({ px = 32 }: { px?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" aria-hidden className="shrink-0" data-testid="ud-cube">
      <path d="M16 4 L28 11 L16 18 L4 11 Z" fill="#c45c3e" />
      <path d="M4 11 L16 18 L16 28 L4 21 Z" fill="#1c2428" />
      <path d="M16 18 L28 11 L28 21 L16 28 Z" fill="#4a585e" />
    </svg>
  );
}

function UdFileGlyph({ kind, src, name }: { kind: UdFileKind; src?: string; name?: string }) {
  if (kind === "image" && src) {
    return <img src={src} alt={name || ""} className="size-10 shrink-0 rounded-lg object-cover" />;
  }
  if (kind === "video") return <ActionPng name="video" px={40} />;
  if (kind === "model") return <CubeIcon px={36} />;
  return <ActionPng name="fileDoc" px={36} />;
}

function readFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function UdCount({ projectId, onReady }: { projectId: string; onReady?: (n: number) => void }) {
  const [n, setN] = useState<number | null>(null);
  const tick = useUdListTick();
  useEffect(() => {
    let live = true;
    void Promise.all(UD_FOLDERS.map(async (f) => {
      const files = await listPladsPrefix(`${projectId}/${f.key}`);
      return { name: f.name, id: f.key, count: files.length };
    })).then((folders) => {
      if (!live) return;
      const total = folders.reduce((sum, f) => sum + f.count, 0);
      setN(total);
      onReady?.(total);
    });
    return () => {
      live = false;
    };
  }, [projectId, onReady, tick]);
  return <>{n ?? "–"}</>;
}

export function UdSheet({ projectId, lang, onClose, onAdd }: { projectId: string; lang: Lang; onClose: () => void; onAdd: () => void }) {
  const [folders, setFolders] = useState<{ name: string; id: string; count: number }[]>([]);
  const [open, setOpen] = useState<UdKey | null>(null);
  const tick = useUdListTick();
  useEffect(() => {
    void Promise.all(UD_FOLDERS.map(async (f) => {
      const files = await listPladsPrefix(`${projectId}/${f.key}`);
      return { name: f.name, id: f.key, count: files.length };
    })).then(setFolders);
  }, [projectId, tick]);
  void onClose;
  void onAdd;

  return (
    <div>
      <ul className="space-y-1.5">
        {UD_FOLDERS.map((f) => {
          const live = folders.find((x) => x.name === f.name);
          const on = open === f.key;
          return (
            <li key={f.key}>
              <button
                type="button"
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ${on ? "bg-navy text-sand" : "bg-sand text-navy"}`}
                data-testid={`ud-folder-${f.key}`}
                onClick={() => setOpen((cur) => (cur === f.key ? null : f.key))}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <SagPng name={udPng(f.key)} px={52} />
                  <span className="block font-medium">{t(lang, udLabelKey(f.key))}</span>
                </span>
                <span className={`font-display text-xl tabular-nums ${on ? "text-sand" : "text-brick"}`}>{live?.count ?? "–"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? <UdFileList projectId={projectId} lang={lang} folder={open} /> : null}
    </div>
  );
}

function UdFileList({ projectId, lang, folder }: { projectId: string; lang: Lang; folder: UdKey }) {
  const [items, setItems] = useState<{ folder: string; id: string; name: string; href: string }[]>([]);
  const [peek, setPeek] = useState<{ href: string; name: string; kind: UdFileKind } | null>(null);
  const tick = useUdListTick();
  useEffect(() => {
    let live = true;
    const f = UD_FOLDERS.find((x) => x.key === folder);
    if (!f) return;
    void listPladsPrefix(`${projectId}/${f.key}`).then((files) => {
      if (!live) return;
      setItems(files.map((x) => ({
        folder: f.name,
        id: x.path,
        name: x.name,
        href: x.url,
      })));
    });
    return () => {
      live = false;
    };
  }, [projectId, folder, tick]);

  if (!items.length) return <p className="mt-4 text-sm text-muted">{t(lang, "noneYet")}</p>;
  return (
    <>
      <ul className="mt-4 space-y-1.5">
        {items.map((row) => {
          const kind = udFileKind(row.name);
          const preview = udFilePreviewable(kind);
          return (
            <li key={row.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 shadow-card" data-testid="ud-item" data-kind={kind} data-name={row.name}>
              {preview ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  data-testid={`ud-item-${kind}`}
                  onClick={() => {
                    if (kind === "pdf") {
                      window.open(row.href, "_blank", "noopener,noreferrer");
                      return;
                    }
                    setPeek({ href: row.href, name: row.name, kind });
                  }}
                >
                  <UdFileGlyph kind={kind} src={row.href} name={row.name} />
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">{row.name}</p>
                    <p className="text-xs text-muted">{udUiLabel(lang, row.folder)}</p>
                  </span>
                </button>
              ) : (
                <a
                  href={row.href}
                  download={row.name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2"
                  data-testid={`ud-item-${kind}`}
                >
                  <UdFileGlyph kind={kind} src={row.href} name={row.name} />
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">{row.name}</p>
                    <p className="text-xs text-muted">{udUiLabel(lang, row.folder)}</p>
                  </span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {peek ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-navy/80 p-4"
          data-testid="ud-preview"
          onClick={() => setPeek(null)}
        >
          {peek.kind === "video" ? (
            <video src={peek.href} controls className="max-h-[90dvh] max-w-full rounded-[20px]" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={peek.href} alt={peek.name} className="max-h-[90dvh] max-w-full rounded-[20px] object-contain" />
          )}
        </button>
      ) : null}
    </>
  );
}

export function UdPick({
  projectId,
  lang,
  onClose,
}: {
  projectId: string;
  lang: Lang;
  onClose: () => void;
}) {
  const me = useSessionEmployee();
  const [pick, setPick] = useState<UdKey | null>(null);
  const [udType, setUdType] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const types = pick === "erfaring" ? UD_ERFARING_TYPES : pick === "dagsrapport" ? UD_DAGS_TYPES : [];

  async function addFiles(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    const next: Draft[] = [];
    for (const file of files) {
      const name = udFallbackName(file);
      const kind = udFileKind(name, file.type);
      const mimeType = mimeForUdFile(name, file.type);
      let dataUrl = "";
      if (kind === "image" && file.size < 12_000_000) {
        try {
          dataUrl = await readFileDataUrl(file);
        } catch {
          dataUrl = "";
        }
      }
      next.push({
        id: `ud-${crypto.randomUUID().slice(0, 8)}`,
        name,
        mimeType,
        dataUrl,
        file,
      });
    }
    if (next.length) setDrafts((cur) => [...cur, ...next].slice(0, 8));
  }

  async function send() {
    const body = note.trim();
    if (!pick || busy) return;
    if (!body && !drafts.length) return;
    setBusy(true);
    try {
      const folderName = udFolderName(pick);
      const job = lookupProject(projectId);
      const gps = await readGpsOrSite(job);
      const geo = gpsPatch(gps, "create");
      const at = new Date();
      const fileIds: string[] = [];
      if (body) {
        const txt = [
          `Sag: ${job?.name ?? projectId}`,
          `Mappe: ${folderName}`,
          udType ? `Type: ${udType}` : "",
          `Afsender: ${me?.name ?? ""}`,
          `Sprog: ${me?.language ?? lang}`,
          `Tid: ${at.toISOString()}`,
          geo.gpsLabel || (geo.lat != null && geo.lng != null) ? `GPS: ${geo.gpsLabel || `${geo.lat}, ${geo.lng}`}` : "",
          `Original (${me?.language ?? lang}): ${body}`,
        ]
          .filter(Boolean)
          .join("\n");
        const noteRes = await uploadPladsBytes({
          path: pladsPath(projectId, pick, udNoteSlug(body, at)),
          contentBase64: utf8b64(txt),
          mimeType: "text/plain",
          projectId,
          kind: pick,
          name: udNoteSlug(body, at),
        });
        if (noteRes.ok && noteRes.fileId) fileIds.push(noteRes.fileId);
        else if (!noteRes.ok) {
          useYard.setState({ toast: noteRes.error || t(lang, "udUploadFail") });
          return;
        }
      }
      for (const d of drafts) {
        const mime = mimeForUdFile(d.name, d.mimeType);
        const up = d.file
          ? await uploadPladsBlob({
              path: pladsPath(projectId, pick, d.name),
              blob: d.file,
              mimeType: mime,
              projectId,
              kind: pick,
              name: d.name,
            })
          : await uploadPladsBytes({
              path: pladsPath(projectId, pick, d.name),
              contentBase64: dataUrlB64(d.dataUrl),
              mimeType: mime,
              projectId,
              kind: pick,
              name: d.name,
            });
        if (up.ok && up.fileId) fileIds.push(up.fileId);
        else {
          useYard.setState({ toast: up.error || t(lang, "udUploadFail") });
          return;
        }
      }
      void fileIds;
      bumpUdList();
      useYard.setState({ toast: t(lang, "udUploaded") });
      setDrafts([]);
      setNote("");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy/50" role="dialog" data-testid="ud-pick">
      <div className="mx-auto mt-16 max-w-lg rounded-[20px] bg-paper px-4 py-5 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <SectionLabel>{t(lang, "udPickHint")}</SectionLabel>
          <CloseX onClick={onClose} label={t(lang, "close")} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UD_FOLDERS.map((f) => {
            const on = pick === f.key;
            return (
              <button
                key={f.key}
                type="button"
                data-testid={`ud-pick-${f.key}`}
                onClick={() => {
                  setPick(f.key);
                  setUdType("");
                }}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center ${on ? "bg-navy text-sand" : "bg-sand text-navy"}`}
              >
                <SagPng name={udPng(f.key)} px={52} />
                <span className="text-xs font-semibold">{t(lang, udLabelKey(f.key))}</span>
              </button>
            );
          })}
        </div>
        {types.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {types.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setUdType(tp)}
                className={`min-h-10 rounded-full px-3 text-xs ${udType === tp ? "bg-navy text-sand" : "bg-sand"}`}
              >
                {t(lang, udTypeKey(tp))}
              </button>
            ))}
          </div>
        ) : null}
        {pick ? (
          <>
            <textarea
              className="mt-3 min-h-20 w-full rounded-xl bg-sand px-3 py-2 text-sm"
              placeholder={t(lang, "udNotePh")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {drafts.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {drafts.map((d) => {
                  const kind = udFileKind(d.name, d.mimeType);
                  return (
                    <li
                      key={d.id}
                      className="flex max-w-[11rem] items-center gap-1.5 rounded-lg bg-sand px-2 py-1"
                      data-testid="ud-draft"
                      data-kind={kind}
                    >
                      <UdFileGlyph kind={kind} src={d.dataUrl || undefined} name={d.name} />
                      <span className="truncate text-[11px]">{d.name}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="mt-3 flex items-center justify-center gap-1 rounded-[20px] bg-sand px-1 py-1">
              <button type="button" aria-label={t(lang, "fieldPhoto")} data-testid="ud-cam" className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center" disabled={busy} onClick={() => camRef.current?.click()}>
                <ActionPng name="camCompact" px={64} />
              </button>
              <button type="button" aria-label={t(lang, "gallery")} data-testid="ud-gallery" className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center" disabled={busy} onClick={() => galRef.current?.click()}>
                <ActionPng name="gallery" px={64} />
              </button>
              <button type="button" aria-label={t(lang, "fieldVideo")} data-testid="ud-video" className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center" disabled={busy} onClick={() => vidRef.current?.click()}>
                <ActionPng name="video" px={64} />
              </button>
              <button type="button" aria-label={t(lang, "fieldFile")} data-testid="ud-file" className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ActionPng name="fileDoc" px={64} />
              </button>
              <button
                type="button"
                aria-label={t(lang, "udSendDrive")}
                data-testid="ud-send"
                disabled={busy}
                onClick={() => void send()}
                className="inline-flex size-[3.5rem] shrink-0 items-center justify-center rounded-full"
                style={{ background: "#c45c3e" }}
              >
                <ActionPng name="send" px={52} />
              </button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="ud-cam-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={galRef} type="file" accept={UD_GALLERY_ACCEPT} multiple className="hidden" data-testid="ud-gallery-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" data-testid="ud-video-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept={UD_FILE_ACCEPT} multiple className="hidden" data-testid="ud-file-input" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </>
        ) : null}
      </div>
    </div>
  );
}
