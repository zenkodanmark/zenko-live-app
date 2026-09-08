import { formatCoords, gpsSourceLabel, readGps, siteFallback } from "./geo.ts";
import { compressImageFile } from "./field-media.ts";
import { splitDataUrl } from "./voice-agent.ts";
import type { GpsFix, Project, Todo } from "./types.ts";

export type StampedPhoto = { dataUrl: string; name: string; gps: GpsFix | null };

export function todoAllPhotoIds(td: Pick<Todo, "photoFileIds" | "donePhotoFileIds" | "driveFileId">) {
  return [...new Set([...(td.photoFileIds ?? []), ...(td.donePhotoFileIds ?? []), td.driveFileId ?? ""].filter(Boolean))];
}

export function gpsCaption(fix: GpsFix | null, who: string, job: string, at = new Date()) {
  const when = at.toLocaleString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const geo = fix ? `${formatCoords(fix.lat, fix.lng)} · ${gpsSourceLabel(fix.source)} · ±${Math.round(fix.accuracyM)} m` : "GPS mangler";
  return `${when} · ${who} · ${job} · ${geo}`;
}

export async function readGpsOrSite(job?: Project | null) {
  const live = await readGps(4000);
  if (live) return live;
  return job ? siteFallback(job) : null;
}

export async function stampPhotoFiles(files: File[], opts: { who: string; job: string; gps: GpsFix | null }): Promise<StampedPhoto[]> {
  const caption = gpsCaption(opts.gps, opts.who, opts.job);
  const out: StampedPhoto[] = [];
  for (const file of files) {
    try {
      const made = await compressImageFile(file, caption);
      if (made.dataUrl) out.push({ dataUrl: made.dataUrl, name: file.name || "foto.jpg", gps: opts.gps });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function splitStamped(photos: StampedPhoto[]) {
  return photos
    .map((p) => {
      const split = splitDataUrl(p.dataUrl);
      return split.base64 ? { name: p.name, mimeType: split.mime || "image/jpeg", contentBase64: split.base64 } : null;
    })
    .filter((x): x is { name: string; mimeType: string; contentBase64: string } => Boolean(x));
}

export function gpsPatch(fix: GpsFix | null, kind: "create" | "done") {
  if (kind === "create") {
    return {
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      gpsLabel: fix ? `${formatCoords(fix.lat, fix.lng)} · ${gpsSourceLabel(fix.source)}` : undefined,
    };
  }
  return {
    doneLat: fix?.lat ?? null,
    doneLng: fix?.lng ?? null,
    doneGpsLabel: fix ? `${formatCoords(fix.lat, fix.lng)} · ${gpsSourceLabel(fix.source)}` : undefined,
  };
}
