import { DriveFileThumb } from "@/components/drive-photo";
import { todoAllPhotoIds } from "@/lib/photo-meta";
import type { Todo } from "@/lib/types";

export function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function GpsLink({
  lat,
  lng,
  label,
  className = "",
}: {
  lat?: number | null;
  lng?: number | null;
  label?: string;
  className?: string;
}) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return label ? <span className={className}>{label}</span> : null;
  }
  return (
    <a href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${className}`}>
      {label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
    </a>
  );
}

export function PhotoStrip({ ids, large }: { ids: string[]; large?: boolean }) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return null;
  return (
    <ul className={`mt-2 flex gap-1 overflow-x-auto ${large ? "grid grid-cols-2" : ""}`}>
      {unique.map((id) => (
        <li key={id} className={large ? "" : "shrink-0"}>
          <DriveFileThumb fileId={id} className={large ? "h-36 w-full rounded-lg object-cover" : "size-16 rounded-lg object-cover"} />
        </li>
      ))}
    </ul>
  );
}

export function TodoPhotos({ td, large }: { td: Todo; large?: boolean }) {
  return <PhotoStrip ids={todoAllPhotoIds(td)} large={large} />;
}

export function ReportThumb({ ids, dataUrl }: { ids: string[]; dataUrl?: string }) {
  if (dataUrl) return <img src={dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />;
  const driveId = ids.find((id) => id && !id.startsWith("softr-") && !id.startsWith("fld-") && id.length > 12);
  if (driveId) return <DriveFileThumb fileId={driveId} className="h-14 w-14 shrink-0 rounded-lg object-cover" />;
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-paper text-xs text-muted">
      {ids.length || "—"}
    </span>
  );
}

export function KsListThumb({
  photoIds,
  photos,
}: {
  photoIds: string[];
  photos: { id: string; dataUrl?: string; driveFileId?: string }[];
}) {
  const thumb = photos.find((p) => photoIds.includes(p.id) || (p.driveFileId && photoIds.includes(p.driveFileId)));
  if (thumb?.dataUrl) {
    return <img src={thumb.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" data-testid="ks-list-thumb" />;
  }
  const driveId =
    thumb?.driveFileId || photoIds.find((id) => id && !id.startsWith("softr-") && !id.startsWith("fld-") && id.length > 12);
  if (driveId) {
    return (
      <span data-testid="ks-list-thumb">
        <DriveFileThumb fileId={driveId} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      </span>
    );
  }
  return <ReportThumb ids={photoIds} />;
}
