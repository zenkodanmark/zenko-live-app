import { useState } from "react";
import { CloseX } from "@/components/sag-icons";
import { DrivePhoto } from "@/components/drive-photo";
import { Card, Chip, PrimaryButton, SectionLabel } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { KNOWN_KS, driveFileView } from "@/lib/ks-drive";
import { DIV_POINT, FLOORS, ROOMS, controlPlanFor, findControlPoint } from "@/lib/seed";
import { useYard } from "@/lib/store";
import type { KsPhoto, Lang } from "@/lib/types";

export function KsThumb({ photo, className = "h-28" }: { photo: KsPhoto; className?: string }) {
  return <DrivePhoto photo={photo} className={`${className} w-full object-cover`} />;
}

const WORK: { id: string; key: "ksWorkA" | "ksWorkB" | "ksWorkC" | "ksWorkDiv" }[] = [
  { id: "5.4", key: "ksWorkA" },
  { id: "5.5", key: "ksWorkB" },
  { id: "5.7", key: "ksWorkC" },
  { id: "div", key: "ksWorkDiv" },
];

export function PhotoSheet({ photo, lang, onClose, canOverride = true }: { photo: KsPhoto; lang: Lang; onClose: () => void; canOverride?: boolean }) {
  const patchPhoto = useYard((s) => s.patchPhoto);
  const plan = [...controlPlanFor(photo.projectId), DIV_POINT];
  const [point, setPoint] = useState(photo.point);
  const [floor, setFloor] = useState(photo.floor);
  const [room, setRoom] = useState(photo.room);
  const [note, setNote] = useState(photo.overrideNote ?? "");
  const guess = photo.guessPoint ?? photo.point;
  const guessSpec = findControlPoint(guess, photo.projectId);
  const spec = findControlPoint(point, photo.projectId);
  const driveId = photo.driveFileId;
  const catalog = driveId ? KNOWN_KS[driveId] : undefined;
  const when = new Date(photo.takenAt).toLocaleString("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function save() {
    patchPhoto(photo.id, {
      point,
      floor,
      room,
      overrideNote: note.trim(),
      recognized: point === "div" ? "div" : "plan",
      recognitionLabel: spec?.title ?? photo.recognitionLabel,
      masterAssigned: true,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50" role="dialog">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        {driveId ? (
          <a className="text-action text-sand/80 underline" href={driveFileView(driveId)} target="_blank" rel="noreferrer">
            {t(lang, "ksOpenDrive")}
          </a>
        ) : null}
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">
        <Card className="overflow-hidden rounded-[20px] p-0">
          <KsThumb photo={photo} className="h-52" />
          <div className="space-y-3 p-4">
            {canOverride ? (
            <div className="rounded-xl bg-sand px-3 py-3">
              <SectionLabel>{t(lang, "ksOverrideTitle")}</SectionLabel>
              <p className="text-sm leading-relaxed">{t(lang, "ksOverrideBody")}</p>
            </div>
            ) : null}

            <SectionLabel>{t(lang, "ksGuess")}</SectionLabel>
            <p className="font-display text-2xl text-navy">
              {photo.recognized === "pending"
                ? t(lang, "ksWaitingGrok")
                : guess === "div"
                  ? t(lang, "ksMasterDecides")
                  : `${guess} ${guessSpec?.title ?? ""}`}
            </p>
            <p className="text-sm leading-relaxed text-muted">{photo.recognitionNote || photo.recognitionLabel || t(lang, "ksDivHint")}</p>
            {photo.workerNote ? <p className="text-sm">“{photo.workerNote}”</p> : null}
            <p className="text-sm text-muted">
              {photo.projectName}
              {photo.gpsSource === "exif" ? ` · ${t(lang, "ksExifGps")}` : photo.gpsSource === "device" ? ` · ${t(lang, "ksPhoneGps")}` : ""}
            </p>
            {catalog?.seen ? <Chip tone="ok">{t(lang, "ksSeen")}</Chip> : <Chip tone="sand">{t(lang, "ksGuessOnly")}</Chip>}
            {photo.masterAssigned ? <Chip tone="ok">{t(lang, "ksCorrected")}</Chip> : null}

            <p className="text-xs leading-relaxed text-muted">
              {t(lang, "ksMetaWhen")}: {when}
              {photo.originalName ? ` · ${photo.originalName}` : ""}
              {photo.bytes ? ` · ${Math.round(photo.bytes / 1024)} KB` : ""}
            </p>
            {driveId ? <p className="text-xs text-muted">{t(lang, "ksNoExif")}</p> : null}

            {canOverride ? (
              <>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{t(lang, "ksWorkPick")}</p>
            <div className="flex flex-wrap gap-1.5">
              {WORK.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setPoint(w.id)}
                  className={`min-h-11 rounded-full px-3 text-xs font-medium ${point === w.id ? "bg-navy text-sand" : "bg-sand text-ink"}`}
                >
                  {t(lang, w.key)}
                </button>
              ))}
            </div>

            <label className="block text-xs text-muted">
              {t(lang, "tagPoint")}
              <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm text-ink" value={point} onChange={(e) => setPoint(e.target.value)}>
                {plan.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} {p.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                {t(lang, "tagFloor")}
                <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm text-ink" value={floor} onChange={(e) => setFloor(e.target.value)}>
                  {FLOORS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {t(lang, "tagRoom")}
                <select className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm text-ink" value={room} onChange={(e) => setRoom(e.target.value)}>
                  {ROOMS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-muted">
              {t(lang, "ksOverrideNote")}
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg bg-sand px-3 py-2 text-sm text-ink"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t(lang, "ksOverrideHint")}
              />
            </label>
            <PrimaryButton onClick={save}>{t(lang, "ksOverrideSave")}</PrimaryButton>
              </>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
