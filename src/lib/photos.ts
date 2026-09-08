import { findControlPoint, suggestKsPoint } from "./seed";

function brickFill(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const mortar = "#d9d0c6";
  const bricks = ["#b44a2a", "#9e3f24", "#c45a36", "#8a3820", "#a84c30"];
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, w, h);
  const bh = 28;
  const bw = 72;
  const gap = 6;
  let y = 8;
  let row = 0;
  while (y < h) {
    const offset = row % 2 === 0 ? 0 : -(bw / 2);
    let x = offset;
    let col = 0;
    while (x < w) {
      ctx.fillStyle = bricks[(seed + row * 13 + col * 7) % bricks.length] ?? "#b44a2a";
      ctx.fillRect(x, y, bw - gap, bh - gap);
      x += bw;
      col += 1;
    }
    y += bh;
    row += 1;
  }
}

export function makeDemoPhoto(opts: {
  point: string;
  floor: string;
  room: string;
  gpsLabel: string;
  name: string;
  coords?: string;
  takenAt?: Date;
}) {
  const w = 720;
  const h = 540;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", width: w, height: h };
  brickFill(ctx, w, h, opts.point.charCodeAt(0) + opts.room.length * 3);
  ctx.fillStyle = "rgba(16,28,34,0.62)";
  ctx.fillRect(0, h - 148, w, 148);
  ctx.fillStyle = "#b44a2a";
  ctx.fillRect(0, h - 152, w, 6);
  ctx.fillStyle = "#f7f1ea";
  ctx.font = "600 28px 'Barlow Condensed', sans-serif";
  ctx.fillText("ZENKO PLADS  ·  KS", 28, h - 112);
  ctx.font = "600 36px 'Barlow Condensed', sans-serif";
  const point = findControlPoint(opts.point);
  ctx.fillText(`${opts.point}  ${point?.title ?? ""}`, 28, h - 72);
  ctx.font = "500 18px 'Source Sans 3', sans-serif";
  const when = (opts.takenAt ?? new Date()).toLocaleString("da-DK", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  ctx.fillText(`${opts.floor} · ${opts.room} · ${opts.gpsLabel}`, 28, h - 40);
  ctx.fillText(opts.coords ? `${opts.coords}  ·  ${opts.name}  ${when}` : `${opts.name}  ${when}`, 28, h - 16);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.72), width: w, height: h };
}

export async function stampFile(
  file: File,
  opts: { point?: string; floor?: string; room?: string; gpsLabel: string; name: string; coords?: string },
) {
  const bitmap = await loadImage(file);
  const max = 720;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return makeDemoPhoto({ point: opts.point ?? "KS", floor: opts.floor ?? "", room: opts.room ?? "", gpsLabel: opts.gpsLabel, name: opts.name, coords: opts.coords });
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  ctx.fillStyle = "rgba(16,28,34,0.62)";
  ctx.fillRect(0, h - 86, w, 86);
  ctx.fillStyle = "#b44a2a";
  ctx.fillRect(0, h - 90, w, 4);
  ctx.fillStyle = "#f7f1ea";
  ctx.font = "600 20px 'Barlow Condensed', sans-serif";
  ctx.fillText("ZENKO PLADS  ·  KS", 16, h - 54);
  ctx.font = "500 13px 'Source Sans 3', sans-serif";
  ctx.fillText(`${opts.gpsLabel} · ${opts.name}`, 16, h - 32);
  if (opts.coords) ctx.fillText(opts.coords, 16, h - 12);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.7), width: w, height: h };
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

export function pointFromFilename(name: string, projectId?: string) {
  return suggestKsPoint(name, projectId);
}
