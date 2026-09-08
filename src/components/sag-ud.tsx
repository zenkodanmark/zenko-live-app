import { useEffect, useRef, useState } from "react";
import { ActionPng, CloseX, SagPng, type SagPngName } from "@/components/sag-icons";
import { GhostButton, SectionLabel } from "@/components/zenko";
import { t, type CopyKey } from "@/lib/i18n";
import { driveFolderUrl } from "@/lib/drive";
import { ensureUdFolders, listUdCounts, listUdFolder, saveUdDraft, uploadUdFile } from "@/lib/drive.functions";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { gpsPatch, readGpsOrSite } from "@/lib/photo-meta";
import { UD_DAGS_TYPES, UD_ERFARING_TYPES, UD_FOLDERS, type UdKey, isUdDraftNote, isUdNote, udFolderName, udNoteSlug } from "@/lib/ud-folders";
import type { Lang } from "@/lib/types";

type Draft = { id: string; name: string; mimeType: string; dataUrl: string };

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

export function UdCount({ projectId, onReady }: { projectId: string; onReady?: (n: number) => void }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void listUdCounts({ data: { projectId } }).then((res) => {
      if (!live) return;
      const total = res.total ?? 0;
      setN(total);
      onReady?.(total);
    });
    return () => {
      live = false;
    };
  }, [projectId, onReady]);
  return <>{n ?? "–"}</>;
}

export function UdSheet({ projectId, lang, onClose, onAdd }: { projectId: string; lang: Lang; onClose: () => void; onAdd: () => void }) {
  const [folders, setFolders] = useState<{ name: string; id: string; count: number }[]>([]);
  useEffect(() => {
    void listUdCounts({ data: { projectId } }).then((res) => {
      setFolders((res.folders ?? []).map((x: { name: string; id: string; count?: number }) => ({
        name: x.name,
        id: x.id,
        count: x.count ?? 0,
      })));
    });
  }, [projectId]);
  void onClose;

  return (
    <div>
      <ul className="space-y-1.5">
        {UD_FOLDERS.map((f) => {
          const live = folders.find((x) => x.name === f.name);
          const href = live?.id ? driveFolderUrl(live.id) : undefined;
          return (
            <li key={f.key}>
              <a
                href={href || "#"}
                onClick={(e) => {
                  if (!href) {
                    e.preventDefault();
                    void ensureUdFolders({ data: { projectId } }).then((r) => {
                      const id = r.folders?.find((x) => x.name === f.name)?.id;
                      if (id) window.open(driveFolderUrl(id), "_blank", "noopener");
                    });
                  }
                }}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-sand px-3 py-3 text-navy"
                data-testid={`ud-folder-${f.key}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <SagPng name={udPng(f.key)} px={52} />
                  <span className="block font-medium">{t(lang, udLabelKey(f.key))}</span>
                </span>
                <span className="font-display text-xl tabular-nums text-brick">{live?.count ?? "–"}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <UdFileList projectId={projectId} lang={lang} />
    </div>
  );
}

function UdFileList({ projectId, lang }: { projectId: string; lang: Lang }) {
  const [items, setItems] = useState<{ folder: string; id: string; name: string; href: string; draft?: boolean; noteId?: string; folderId?: string }[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void Promise.all(UD_FOLDERS.map(async (f) => {
      const listed = await listUdFolder({ data: { projectId, folderName: f.name } });
      const files = (listed.items ?? []).filter((x) => !x.folder);
      const notes = files.filter((x) => isUdNote(x.name));
      return files
        .filter((x) => !isUdNote(x.name))
        .map((x) => {
          const stem = x.name.replace(/\.[^.]+$/, "");
          const saved = notes.find((n) => n.name === `${stem}.note.json`);
          const draftNote = notes.find((n) => isUdDraftNote(n.name) && n.name.startsWith(stem));
          const note = saved ?? draftNote;
          return {
            folder: f.name,
            id: x.id,
            name: x.name,
            href: x.href,
            noteId: note?.id,
            folderId: listed.folderId,
            draft: Boolean(draftNote && !saved),
          };
        });
    })).then((rows) => {
      if (live) setItems(rows.flat());
    });
    return () => {
      live = false;
    };
  }, [projectId, tick]);

  async function gem(row: (typeof items)[0]) {
    if (!row.noteId || !row.folderId) return;
    await saveUdDraft({ data: { noteId: row.noteId, folderId: row.folderId, noteName: row.name.replace(/\.[^.]+$/, "") + ".note.json" } });
    setTick((n) => n + 1);
  }

  if (!items.length) return null;
  return (
    <ul className="mt-4 space-y-1.5">
      {items.map((row) => (
        <li key={row.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 shadow-card">
          <a href={row.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy">{row.name}</p>
            <p className="text-xs text-muted">{udUiLabel(lang, row.folder)}</p>
          </a>
          {row.draft ? (
            <GhostButton className="rounded-full bg-sand px-3 text-xs" onClick={() => void gem(row)}>
              {t(lang, "udSave")}
            </GhostButton>
          ) : null}
        </li>
      ))}
    </ul>
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
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const types = pick === "erfaring" ? UD_ERFARING_TYPES : pick === "dagsrapport" ? UD_DAGS_TYPES : [];

  async function addFiles(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    const next: Draft[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      if (!dataUrl) continue;
      next.push({
        id: `ud-${crypto.randomUUID().slice(0, 8)}`,
        name: file.name || "fil",
        mimeType: file.type || "application/octet-stream",
        dataUrl,
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
        const noteRes = await uploadUdFile({
          data: {
            projectId,
            folderName,
            name: udNoteSlug(body, at),
            mimeType: "text/plain",
            contentBase64: utf8b64(txt),
            udType,
            note: body,
            date: at.toISOString().slice(0, 10),
            draft: false,
            employeeName: me?.name ?? "",
          },
        });
        if (noteRes.ok && noteRes.fileId) fileIds.push(noteRes.fileId);
        else if (!noteRes.ok) {
          useYard.setState({ toast: noteRes.error || t(lang, "udUploadFail") });
          return;
        }
      }
      for (const d of drafts) {
        const up = await uploadUdFile({
          data: {
            projectId,
            folderName,
            name: d.name,
            mimeType: d.mimeType,
            contentBase64: dataUrlB64(d.dataUrl),
            udType,
            note: body,
            date: at.toISOString().slice(0, 10),
            draft: false,
            employeeName: me?.name ?? "",
          },
        });
        if (up.ok && up.fileId) fileIds.push(up.fileId);
        else {
          useYard.setState({ toast: up.error || t(lang, "udUploadFail") });
          return;
        }
      }
      void fileIds;
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
                {drafts.map((d) => (
                  <li key={d.id} className="max-w-[9rem] truncate rounded-lg bg-sand px-2 py-1 text-[11px]">
                    {d.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex items-center justify-center gap-1 rounded-[20px] bg-sand px-1 py-1">
              <button type="button" aria-label={t(lang, "fieldPhoto")} data-testid="ud-cam" className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center" disabled={busy} onClick={() => camRef.current?.click()}>
                <ActionPng name="camCompact" px={64} />
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
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,application/pdf" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </>
        ) : null}
      </div>
    </div>
  );
}
