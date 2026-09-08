import { useEffect, useMemo, useState } from "react";
import { PhotoSheet, KsThumb } from "@/components/photo-sheet";
import { Card, Chip, SectionLabel } from "@/components/zenko";
import { listKsPhotos } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import { ksWorkCounts, photoFromDriveFile } from "@/lib/ks-drive";
import { projectById } from "@/lib/seed";
import { useYard } from "@/lib/store";
import type { KsPhoto, Lang } from "@/lib/types";

type Filter = "all" | "5.4" | "5.5" | "5.7" | "div";

export function KsDriveGallery({ projectId, lang, canOverride = true }: { projectId: string; lang: Lang; canOverride?: boolean }) {
  const drivePhotos = useYard((s) => s.drivePhotos);
  const upsertDrivePhotos = useYard((s) => s.upsertDrivePhotos);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const job = projectById(projectId);
  const photos = useMemo(
    () =>
      drivePhotos
        .filter((p) => p.projectId === projectId)
        .slice()
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    [drivePhotos, projectId],
  );
  const open = photos.find((p) => p.id === openId) ?? null;
  const counts = ksWorkCounts(photos);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void listKsPhotos({ data: { projectId } })
      .then((res) => {
        if (!live || !res.ok || !res.files.length) return;
        upsertDrivePhotos(
          res.files.map((f) =>
            photoFromDriveFile({ fileId: f.id, name: f.name, projectId, projectName: job.name }),
          ),
        );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [job.name, projectId, upsertDrivePhotos]);

  if (!photos.length && !busy) return null;

  const shown = photos.filter((p) => {
    if (filter === "all") return true;
    if (filter === "div") return p.point === "div" || p.recognized === "div";
    return p.point === filter;
  });

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `${t(lang, "filterAll")} ${counts.total}` },
    { id: "5.4", label: `${t(lang, "ksWorkA")} ${counts.n54}` },
    { id: "5.5", label: `${t(lang, "ksWorkB")} ${counts.n55}` },
    { id: "5.7", label: `${t(lang, "ksWorkC")} ${counts.n57}` },
    { id: "div", label: `${t(lang, "ksWorkDiv")} ${counts.nDiv}` },
  ];

  return (
    <Card className="rounded-[20px]">
      <SectionLabel>{t(lang, "ksDriveTitle")}</SectionLabel>
      <p className="mb-2 text-sm text-muted">{t(lang, "ksDriveHint")}</p>
      <p className="mb-3 text-xs leading-relaxed text-muted">{t(lang, "ksChimneyNote")}</p>
      {busy ? <p className="mb-2 text-xs text-muted">{t(lang, "ksLoadingDrive")}</p> : null}
      <p className="mb-2 text-xs text-muted">
        {photos.length} {t(lang, "ksFromDrive")}
      </p>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${filter === c.id ? "bg-navy text-sand" : "bg-sand text-ink"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {shown.map((ph) => (
          <li key={ph.id}>
            <button type="button" className="w-full overflow-hidden rounded-xl bg-sand text-left" onClick={() => setOpenId(ph.id)}>
              <KsThumb photo={ph} />
              <p className="px-2 py-1.5 text-xs">
                {ph.point === "div" ? t(lang, "ksDiv") : ph.point} · {ph.room}
                {ph.masterAssigned ? (
                  <Chip tone="ok" className="ml-1">
                    {t(lang, "ksCorrected")}
                  </Chip>
                ) : null}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="text-sm text-muted">{t(lang, "noneYet")}</p> : null}
      {open ? <PhotoSheet photo={open} lang={lang} onClose={() => setOpenId(null)} canOverride={canOverride} /> : null}
    </Card>
  );
}
