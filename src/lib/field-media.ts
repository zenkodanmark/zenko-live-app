import type { FieldKind } from "./types";

export function kindFromFile(file: File): FieldKind {
  const t = file.type.toLowerCase();
  if (t.startsWith("image/")) return "photo";
  if (t.startsWith("video/")) return "video";
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|heic|webp|gif)$/.test(n)) return "photo";
  if (/\.(mp4|mov|webm|m4v|3gp)$/.test(n)) return "video";
  return "file";
}

export async function compressImageFile(file: File, caption?: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await loadImage(file);
  const max = 720;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", width: w, height: h };
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  const bar = caption ? 78 : 48;
  ctx.fillStyle = "rgba(16,28,34,0.62)";
  ctx.fillRect(0, h - bar, w, bar);
  ctx.fillStyle = "#b44a2a";
  ctx.fillRect(0, h - bar - 4, w, 4);
  ctx.fillStyle = "#f7f1ea";
  ctx.font = "600 16px 'Barlow Condensed', sans-serif";
  ctx.fillText("ZENKO PLADS", 14, h - bar + 22);
  if (caption) {
    ctx.font = "500 12px 'Source Sans 3', sans-serif";
    const lines = wrapCaption(ctx, caption, w - 28);
    lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, 14, h - bar + 40 + i * 14));
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.68), width: w, height: h };
}

function wrapCaption(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function makeFieldDemo(label: string) {
  const w = 720;
  const h = 540;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", width: w, height: h };
  ctx.fillStyle = "#b44a2a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#9e3f24";
  for (let y = 20; y < h - 80; y += 40) {
    ctx.fillRect(0, y, w, 10);
  }
  ctx.fillStyle = "rgba(16,28,34,0.7)";
  ctx.fillRect(0, h - 120, w, 120);
  ctx.fillStyle = "#f7f1ea";
  ctx.font = "600 28px 'Barlow Condensed', sans-serif";
  ctx.fillText("ZENKO PLADS  ·  FELT", 28, h - 70);
  ctx.font = "500 20px 'Source Sans 3', sans-serif";
  ctx.fillText(label, 28, h - 36);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.72), width: w, height: h };
}

export async function videoPoster(file: File): Promise<string | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("video")), 4000);
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.4, (video.duration || 1) * 0.05);
        } catch {
          /* ignore */
        }
      };
      video.onseeked = () => {
        window.clearTimeout(t);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(t);
        reject(new Error("video"));
      };
    });
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.max(1, Math.round((480 * video.videoHeight) / (video.videoWidth || 480)));
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.62);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
