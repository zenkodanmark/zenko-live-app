import { useRef, useState } from "react";
import { ActionPng } from "@/components/sag-icons";
import { removePladsFile } from "@/lib/plads-file";
import { uploadReportFiles } from "@/lib/report-photo-upload";
import { cleanPhotoIds, visibleReportPhotos } from "@/lib/report-photos";
import { useYard } from "@/lib/store";

const ACCEPT_IMAGE = "image/*,image/jpeg,image/png,image/webp,image/heic,image/heif";

export function ReportPhotoEditor({
  projectId,
  folder,
  ids,
  onChange,
  onBusy,
  prefix = "report-photo",
}: {
  projectId: string;
  folder: "as" | "er" | "tf" | "tb" | "todo";
  ids: string[];
  onChange: (ids: string[]) => void;
  onBusy?: (busy: boolean) => void;
  prefix?: string;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idsRef = useRef(ids);
  const addedRef = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  idsRef.current = ids;
  const shown = visibleReportPhotos(ids);

  async function add(list: FileList | null) {
    const files = [...(list ?? [])];
    if (!files.length || busy) return;
    setBusy(true);
    onBusy?.(true);
    try {
      const urls = await uploadReportFiles(projectId || "sag", folder, files);
      if (!urls.length) {
        useYard.setState({ toast: "Kunne ikke uploade foto" });
        return;
      }
      for (const url of urls) addedRef.current.add(url);
      onChange(cleanPhotoIds([...idsRef.current, ...urls]));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  function remove(id: string) {
    onChange(idsRef.current.filter((x) => x !== id));
    if (addedRef.current.has(id)) {
      addedRef.current.delete(id);
      void removePladsFile(id);
    }
  }

  return (
    <div className="sm:col-span-2" data-testid={`${prefix}-box`}>
      {shown.length ? (
        <ul className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <li key={p.src} className="relative">
              {p.video ? (
                <video src={p.src} className="size-16 rounded-lg object-cover" data-testid={`${prefix}-preview`} data-src={p.src} />
              ) : (
                <img src={p.src} alt="" referrerPolicy="no-referrer" className="size-16 rounded-lg object-cover" data-testid={`${prefix}-preview`} data-src={p.src} />
              )}
              <button
                type="button"
                aria-label="Fjern foto"
                data-testid={`${prefix}-remove`}
                onClick={() => remove(p.id)}
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-navy text-sand"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Ingen fotos endnu</p>
      )}
      <div className="mt-2 flex items-center justify-center gap-2 rounded-[24px] bg-paper px-2 py-2">
        <button type="button" aria-label="Kamera" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid={`${prefix}-cam`} disabled={busy} onClick={() => camRef.current?.click()}>
          <ActionPng name="camCompact" px={48} />
        </button>
        <button type="button" aria-label="Galleri" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid={`${prefix}-gal`} disabled={busy} onClick={() => galRef.current?.click()}>
          <ActionPng name="gallery" px={48} />
        </button>
        <button type="button" aria-label="Fil" className="inline-flex min-h-[3.25rem] flex-1 items-center justify-center" data-testid={`${prefix}-file`} disabled={busy} onClick={() => fileRef.current?.click()}>
          <ActionPng name="fileDoc" px={48} />
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" multiple className="hidden" data-testid={`${prefix}-cam-input`} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept={ACCEPT_IMAGE} multiple className="hidden" data-testid={`${prefix}-gal-input`} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" data-testid={`${prefix}-file-input`} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      {busy ? <p className="mt-1 text-xs text-muted">Uploader…</p> : null}
    </div>
  );
}
