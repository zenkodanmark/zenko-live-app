import { pladsPath, uploadPladsBlob } from "./plads-file";

const MAX_EDGE = 2000;
const MAX_IMAGE = 12_000_000;
const MAX_VIDEO = 40_000_000;

function mimeFromName(name: string) {
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.hei[cf]$/i.test(name)) return "image/heic";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.mp4$/i.test(name)) return "video/mp4";
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.webm$/i.test(name)) return "video/webm";
  return "";
}

async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    if (typeof createImageBitmap !== "function") return null;
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/** JPEG when the browser can decode the file (including HEIC on Safari). Otherwise the original. */
export async function prepareUploadFile(file: File): Promise<{ blob: Blob; name: string; mime: string } | null> {
  const name = file.name || "fil";
  const mime = file.type || mimeFromName(name);
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(name)) {
    if (file.size > MAX_VIDEO) return null;
    return { blob: file, name, mime: mime || "video/mp4" };
  }
  const image = mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(name);
  if (!image) return null;
  const decoded = await decodeImage(file);
  if (!decoded || typeof document === "undefined") {
    if (file.size > MAX_IMAGE) return null;
    return { blob: file, name, mime: mime || "image/jpeg" };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height, 1));
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close?.();
    if (file.size > MAX_IMAGE) return null;
    return { blob: file, name, mime: mime || "image/jpeg" };
  }
  ctx.drawImage(decoded, 0, 0, w, h);
  decoded.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
  if (!blob) {
    if (file.size > MAX_IMAGE) return null;
    return { blob: file, name, mime: mime || "image/jpeg" };
  }
  const stem = name.replace(/\.[^.]+$/, "") || "foto";
  return { blob, name: `${stem}.jpg`, mime: "image/jpeg" };
}

/** Uploads straight to plads/{project}/{folder}/… and returns public https URLs. Never a data URL. */
export async function uploadReportFiles(projectId: string, folder: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ready = await prepareUploadFile(file);
    if (!ready) continue;
    const path = pladsPath(projectId || "sag", folder, ready.name);
    const up = await uploadPladsBlob({
      path,
      blob: ready.blob,
      mimeType: ready.mime,
      projectId: projectId || undefined,
      kind: folder,
      name: ready.name,
    });
    if (up.ok && /^https?:\/\//i.test(up.url)) urls.push(up.url);
  }
  return urls;
}
