import type { FieldItem, Project, Tf } from "./types";
import { isSupabaseFile, sbFileSrc } from "./supabase";

export type TfSharePhoto = {
  id: string;
  name: string;
  src: string;
};

export type TfSharePayload = {
  tfId: string;
  number: string;
  title: string;
  question: string;
  createdAt: string;
  projectName: string;
  address: string;
  customer: string;
  photos: TfSharePhoto[];
};

export type TfShareRecord = TfSharePayload & {
  token: string;
  answer: string;
  answeredAt: string | null;
  answeredBy: string;
};

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DATA_URL = 1_800_000;

export function isShareToken(token: string) {
  return TOKEN_RE.test(token.trim());
}

export function driveExportUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function driveDisplayUrl(fileId: string) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
}

function driveIdFromUrl(url: string) {
  const fromQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery?.[1]) return fromQuery[1];
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";
}

export function photoSrc(item: { dataUrl?: string; driveUrl?: string; driveFileId?: string }): string | null {
  const src = item.dataUrl?.trim() ?? "";
  if (isSupabaseFile(src)) return sbFileSrc(src) || src;
  if (src.startsWith("/") || src.startsWith("http://") || src.startsWith("https://")) {
    if (src.includes("supabase.co")) return src;
    const id = driveIdFromUrl(src);
    if (id && /drive\.google\.com\/uc\?/.test(src)) return driveDisplayUrl(id);
    return src;
  }
  if (src.startsWith("data:") && src.length <= MAX_DATA_URL) return src;
  const id = item.driveFileId?.trim() || driveIdFromUrl(item.driveUrl?.trim() ?? "");
  if (isSupabaseFile(id) || (id && id.startsWith("http") && id.includes("supabase.co"))) return sbFileSrc(id) || id;
  if (id) return driveDisplayUrl(id);
  const drive = item.driveUrl?.trim() ?? "";
  if (isSupabaseFile(drive)) return sbFileSrc(drive) || drive;
  if (drive.startsWith("http://") || drive.startsWith("https://")) return drive;
  return null;
}

export function buildTfSharePayload(tf: Tf, job: Project, fieldItems: FieldItem[]): TfSharePayload {
  const photos: TfSharePhoto[] = [];
  for (const item of fieldItems) {
    if (!tf.photoIds.includes(item.id) && !tf.photoIds.includes(item.driveFileId ?? "")) continue;
    const src = photoSrc(item);
    if (!src) continue;
    photos.push({ id: item.id, name: item.name, src });
  }
  return {
    tfId: tf.id,
    number: tf.number,
    title: (tf.title ?? "").trim(),
    question: tf.question.trim(),
    createdAt: tf.createdAt,
    projectName: job.name,
    address: job.address,
    customer: job.customer || "Ole Jepsen A/S",
    photos,
  };
}

export function tfSharePath(token: string) {
  return `/tf/${token}`;
}

export function tfMailCopy(row: { number: string; title: string; projectName: string }, url: string) {
  const headline = row.title || row.number;
  return {
    subject: `Teknisk forespørgsel ${row.number} — ${row.projectName}`,
    body: `Hej,\n\nHer er teknisk forespørgsel ${row.number} vedr. ${headline} på ${row.projectName}.\n\nÅbn rapporten her (kun rapporten — ingen login, ingen app):\n${url}\n\nI kan se spørgsmålet, billederne og svare direkte i rapporten.\n\nVenlig hilsen\nZenko Danmark`,
  };
}

export function mailtoHref(copy: { subject: string; body: string }) {
  return `mailto:?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(copy.body)}`;
}
