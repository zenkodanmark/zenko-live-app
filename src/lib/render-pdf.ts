import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { priceLabel } from "./sag-ledelse.ts";

export type PdfKind = "todo" | "tf" | "as" | "tb" | "er";

export type PdfPhoto = { src: string; caption?: string };

export type PdfDoc = {
  kind: PdfKind;
  id: string;
  number: string;
  title: string;
  projectId: string;
  projectName: string;
  customer: string;
  createdAt: string;
  body: string;
  extra?: string;
  extraHeading?: string;
  location?: string;
  priceRaw?: string;
  photos: PdfPhoto[];
  doneAt?: string;
};

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 48;
export const INNER_W = PAGE_W - MARGIN * 2;
export const PHOTO_MAX_H = 240;
export const CREAM = rgb(250 / 255, 248 / 255, 244 / 255);
export const TERRACOTTA = rgb(196 / 255, 92 / 255, 62 / 255);
export const NAVY = rgb(26 / 255, 43 / 255, 51 / 255);
export const INK = rgb(28 / 255, 25 / 255, 23 / 255);
export const MUTED = rgb(74 / 255, 69 / 255, 63 / 255);

export function pdfFilename(number: string) {
  const stem = String(number || "rapport").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "rapport";
  return `${stem}.pdf`;
}

export function pdfStoragePath(projectId: string, number: string) {
  const job = String(projectId || "sag").replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "sag";
  return `${job}/pdf/${pdfFilename(number)}`;
}

export function keptPrice(raw?: string | null) {
  if (raw == null || String(raw).trim() === "") return "";
  return priceLabel(raw);
}

export function headingFor(kind: PdfKind, number: string) {
  if (kind === "as") return `Aftaleseddel nr. ${number}`;
  if (kind === "tb") return `Tilbud nr. ${number}`;
  if (kind === "tf") return `Tilsynsnotat nr. ${number}`;
  if (kind === "er") return `Entreprenørrapport nr. ${number}`;
  return `To-do`;
}

export type LayoutBlock =
  | { kind: "keep"; key: string; h: number }
  | { kind: "photo"; key: string; h: number; index: number };

export function photoBoxHeight(srcW: number, srcH: number) {
  if (!srcW || !srcH) return PHOTO_MAX_H;
  const scaled = (INNER_W * srcH) / srcW;
  return Math.min(PHOTO_MAX_H, Math.max(90, scaled)) + 16;
}

/** Whole block stays on one page. Never splits a photo, title, price or description box. */
export function paginateKeepTogether(heights: { key: string; h: number }[], pageInner: number): string[][] {
  const usable = Math.max(80, pageInner);
  const pages: string[][] = [[]];
  let used = 0;
  for (const block of heights) {
    const h = Math.min(block.h, usable);
    if (pages[pages.length - 1]!.length && used + h > usable) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1]!.push(block.key);
    used += h;
  }
  return pages.filter((p) => p.length);
}

export function pdfSafe(s: string) {
  return String(s || "")
    .replace(/ø/g, "oe")
    .replace(/Ø/g, "Oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/å/g, "aa")
    .replace(/Å/g, "Aa")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[^\t\n\x20-\x7E]/g, "");
}

export function wrapLines(text: string, maxChars: number) {
  const out: string[] = [];
  for (const raw of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line) {
      out.push("");
      continue;
    }
    let rest = line;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(" ", maxChars);
      if (cut < maxChars * 0.5) cut = maxChars;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    out.push(rest);
  }
  return out;
}

function longDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "").slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function fontWrap(font: PDFFont, text: string, size: number, maxW: number) {
  const words = pdfSafe(text).replace(/\r\n/g, "\n").split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) lines.push(cur);
    cur = "";
  };
  for (const w of words) {
    if (/\n/.test(w)) {
      flush();
      continue;
    }
    const next = cur + w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
    else {
      flush();
      cur = w.trimStart();
    }
  }
  flush();
  return lines.length ? lines : [""];
}

function drawCream(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
}

export async function drawPdfBytes(
  doc: PdfDoc,
  fetchImage?: (src: string) => Promise<Uint8Array | null>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const images: { img: PDFImage; caption?: string }[] = [];
  for (const photo of doc.photos.slice(0, 24)) {
    if (!fetchImage || !photo.src) continue;
    try {
      const bytes = await fetchImage(photo.src);
      if (!bytes || bytes.byteLength < 24) continue;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      images.push({ img, caption: photo.caption });
    } catch {
      /* skip one broken photo — never guess */
    }
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  drawCream(page);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    drawCream(page);
    y = PAGE_H - MARGIN;
  };

  const ensure = (need: number) => {
    if (y - need < MARGIN) newPage();
  };

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont, color = INK) => {
    const safe = pdfSafe(s).replace(/[\r\n\t]+/g, " ");
    if (!safe) return;
    try {
      page.drawText(safe, { x, y: yy, size, font: f, color });
    } catch {
      page.drawText(safe.replace(/[^\x20-\x7E]/g, "?"), { x, y: yy, size, font: f, color });
    }
  };

  const heading = headingFor(doc.kind, doc.number);
  ensure(88);
  text("ZENKO DANMARK", MARGIN, y - 12, 10, bold, NAVY);
  text(`CVR ${"42285757"}`, MARGIN, y - 26, 9, font, MUTED);
  text(heading, MARGIN, y - 52, 16, bold, TERRACOTTA);
  y -= 70;
  if (doc.title) {
    const lines = fontWrap(bold, doc.title, 12, INNER_W);
    ensure(lines.length * 16 + 8);
    for (const line of lines) {
      text(line, MARGIN, y, 12, bold, NAVY);
      y -= 16;
    }
    y -= 6;
  }

  const meta: [string, string][] = [
    ["Til", doc.customer || "—"],
    ["Dato", longDate(doc.createdAt)],
    ["Byggesag", doc.projectName || "—"],
  ];
  if (doc.location) meta.push(["Lokation", doc.location]);
  if (doc.doneAt) meta.push(["Udført", longDate(doc.doneAt)]);
  ensure(meta.length * 14 + 12);
  for (const [k, v] of meta) {
    text(`${k}:`, MARGIN, y, 10, bold, NAVY);
    text(v, MARGIN + 70, y, 10, font, INK);
    y -= 14;
  }
  y -= 10;

  const bodyBox = (title: string, body: string) => {
    const lines = fontWrap(font, body || "—", 10, INNER_W - 16);
    const h = 28 + lines.length * 13 + 16;
    ensure(h);
    page.drawRectangle({
      x: MARGIN,
      y: y - h,
      width: INNER_W,
      height: h,
      borderColor: rgb(0.85, 0.82, 0.77),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
    text(title, MARGIN + 8, y - 16, 11, bold, NAVY);
    let ty = y - 32;
    for (const line of lines) {
      text(line.slice(0, 220), MARGIN + 8, ty, 10, font, INK);
      ty -= 13;
    }
    y -= h + 10;
  };

  bodyBox(doc.kind === "tf" ? "Spørgsmål" : "Beskrivelse", doc.body || "Ingen beskrivelse");
  if (doc.extra) bodyBox(doc.extraHeading || (doc.kind === "tf" ? "Svar" : "Bemærkning"), doc.extra);

  const price = keptPrice(doc.priceRaw);
  if (price) {
    ensure(40);
    text("Pris ekskl. moms", MARGIN, y, 10, bold, NAVY);
    text(price, MARGIN + 120, y, 14, bold, TERRACOTTA);
    y -= 28;
  }

  if (images.length) {
    ensure(24);
    text("Fotos", MARGIN, y, 12, bold, NAVY);
    y -= 18;
    images.forEach((item, i) => {
      const maxW = INNER_W;
      const maxH = PHOTO_MAX_H;
      const scale = Math.min(maxW / item.img.width, maxH / item.img.height, 1);
      const w = item.img.width * scale;
      const h = item.img.height * scale;
      const block = h + 18;
      ensure(block);
      page.drawImage(item.img, { x: MARGIN, y: y - h, width: w, height: h });
      if (item.caption) text(item.caption, MARGIN, y - h - 12, 8, font, MUTED);
      y -= block + 8;
      void i;
    });
  }

  const bytes = await pdf.save();
  return bytes;
}
