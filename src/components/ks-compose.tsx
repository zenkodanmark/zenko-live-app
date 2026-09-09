import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { CloseX } from "@/components/sag-icons";
import { Card, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { photoFromDriveFile } from "@/lib/ks-drive";
import { stampFile } from "@/lib/photos";
import { pladsPath, uploadPladsBytes } from "@/lib/plads-file";
import { controlPlanFor, findControlPoint } from "@/lib/seed";
import { lookupProject, useYard } from "@/lib/store";
import type { Lang } from "@/lib/types";

type Draft = { name: string; dataUrl: string };

export function KsCompose({
  projectId,
  lang,
  onClose,
  onCreated,
}: {
  projectId: string;
  lang: Lang;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const plan = controlPlanFor(projectId);
  const job = lookupProject(projectId);
  const addKsReport = useYard((s) => s.addKsReport);
  const upsertDrivePhotos = useYard((s) => s.upsertDrivePhotos);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [point, setPoint] = useState(plan.find((p) => p.code === "5.5")?.code ?? plan.find((p) => p.code === "5.4")?.code ?? plan[0]?.code ?? "5.3");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dev, setDev] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const spec = findControlPoint(point, projectId);

  async function fileToDraft(file: File): Promise<Draft | null> {
    try {
      const made = await stampFile(file, { point, floor: "", room: "", gpsLabel: job.name, name: "Grok" });
      if (made.dataUrl) return { name: file.name || "ks.jpg", dataUrl: made.dataUrl };
    } catch {
      /* fall through */
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (dataUrl.startsWith("data:")) return { name: file.name || "ks.jpg", dataUrl };
    } catch {
      return null;
    }
    return null;
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: Draft[] = [];
    for (const file of [...list]) {
      const d = await fileToDraft(file);
      if (d) next.push(d);
    }
    setDrafts((cur) => [...cur, ...next]);
  }

  async function save() {
    if (!drafts.length && !dev.trim()) {
      setErr(t(lang, "composeNeedOne"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const slug = (spec?.title ?? "KS").replace(/[^\wæøåÆØÅ]+/g, "-").replace(/-+/g, "-").slice(0, 36);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "");
      const photoIds: string[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]!;
        const name = `KS-Grok-${point}-${slug}-${stamp}-${i + 1}.jpg`;
        const base64 = d.dataUrl.split(",")[1] ?? "";
        if (!base64) {
          setErr(t(lang, "saveFail"));
          return;
        }
        const res = await uploadPladsBytes({
          path: pladsPath(projectId, "ks", name),
          contentBase64: base64,
          mimeType: "image/jpeg",
          projectId,
          kind: "ks",
          name,
        });
        if (!res.ok || !res.fileId) {
          setErr(res.error || t(lang, "saveFail"));
          return;
        }
        photoIds.push(res.fileId);
        upsertDrivePhotos([
          {
            ...photoFromDriveFile({ fileId: res.fileId, name, projectId, projectName: job.name }),
            id: res.fileId,
            driveFileId: res.fileId,
            driveUrl: res.url,
            dataUrl: res.url,
            point,
            employeeName: "Grok",
            deviceLabel: "KS-Grok",
            originalName: name,
            recognitionLabel: `KS-Grok ${point} ${spec?.title ?? ""}`,
          },
        ]);
      }
      const row = addKsReport(projectId, point, { photoIds, deviations: dev.trim() || "Ingen afvigelser." });
      onCreated(row.id);
    } catch (e) {
      setErr(e instanceof Error && !/invariant/i.test(e.message) ? e.message : t(lang, "saveFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50" role="dialog">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-title text-sand">{t(lang, "ksComposeTitle")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">
        <Card className="rounded-[20px]">
          <SectionLabel>{t(lang, "ksComposeTitle")}</SectionLabel>
          <p className="mb-3 text-sm text-muted">{t(lang, "ksComposeHint")}</p>
          <label className="mb-1 block text-xs text-muted">Kontrolpunkt</label>
          <select className="mb-3 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={point} onChange={(e) => setPoint(e.target.value)}>
            {plan.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} {p.title}
              </option>
            ))}
          </select>
          <div className="mb-3 flex gap-2">
            <GhostButton className="flex-1 bg-sand" onClick={() => camRef.current?.click()}>
              <Camera className="mr-1 size-4" />
              Foto
            </GhostButton>
            <GhostButton className="flex-1 bg-sand" onClick={() => galRef.current?.click()}>
              <ImagePlus className="mr-1 size-4" />
              Galleri
            </GhostButton>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
          <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addFiles(e.target.files)} />
          {drafts.length ? (
            <ul className="mb-3 grid grid-cols-3 gap-2">
              {drafts.map((d, i) => (
                <li key={`${d.name}-${i}`}>
                  <img src={d.dataUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted">{t(lang, "ksComposeNeedPhoto")}</p>
          )}
          <textarea
            className="mb-3 min-h-20 w-full rounded-lg bg-sand px-3 py-2 text-sm"
            placeholder="Ved afvigelser beskrives de her"
            value={dev}
            onChange={(e) => setDev(e.target.value)}
          />
          {err ? <p className="mb-2 text-sm text-brick">{err}</p> : null}
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? t(lang, "udbudSearching") : t(lang, "ksComposeSave")}
          </PrimaryButton>
        </Card>
      </div>
    </div>
  );
}
