import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadPdfFontBytes, PAGE_H, PAGE_W, pdfText } from "./render-pdf.ts";

/** 40pt ≈ 14,1 mm — inside the 12–16 mm page margin. */
const MARGIN = 40;
const INNER = PAGE_W - MARGIN * 2;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.29, 0.27, 0.25);
const LINE = rgb(0.75, 0.72, 0.68);

const NR_W = 118;
const DATE_W = 78;
const AMT_W = 78;
const GAP = 12;
const TITLE_X = MARGIN + NR_W + GAP;
const TITLE_W = INNER - NR_W - DATE_W - AMT_W - GAP * 3;
const DATE_X = TITLE_X + TITLE_W + GAP;
const AMT_RIGHT = PAGE_W - MARGIN;

export type SamlingPdfRow = {
  number: string;
  title: string;
  dateLabel: string;
  priceLabel: string;
  customer: string;
  createdAt: string;
  projectName: string;
  body: string;
  note: string;
  location: string;
  photos: { src: string }[];
  replies: { at: string; text: string }[];
};

export type SamlingPdfInput = {
  jobName: string;
  client: string;
  dateLabel: string;
  totalLabel: string;
  rows: SamlingPdfRow[];
  fetchImage?: (src: string) => Promise<Uint8Array | null>;
};

type Pen = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  slip: string;
};

function longDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "").slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function dmy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "").slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function wrap(font: PDFFont, text: string, size: number, maxW: number) {
  const lines: string[] = [];
  const paras = pdfText(text).replace(/\r\n/g, "\n").split("\n");
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let cur = "";
    const pushWord = (word: string) => {
      if (font.widthOfTextAtSize(word, size) <= maxW) {
        cur = word;
        return;
      }
      let chunk = "";
      for (const ch of word) {
        const next = chunk + ch;
        if (font.widthOfTextAtSize(next, size) <= maxW) chunk = next;
        else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      cur = chunk;
    };
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
      else {
        if (cur) lines.push(cur);
        pushWord(word);
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length ? lines : [""];
}

function blank(pen: Pen) {
  pen.page = pen.pdf.addPage([PAGE_W, PAGE_H]);
  pen.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
  pen.y = PAGE_H - MARGIN;
}

function text(pen: Pen, value: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  const line = pdfText(value).replace(/[\r\n]+/g, " ");
  if (!line) return;
  try {
    pen.page.drawText(line, { x, y, size, font, color });
  } catch {
    const safe = line.replace(/[^\u0000-\u024F\u1E00-\u1EFF]/g, "");
    if (!safe.trim()) return;
    try {
      pen.page.drawText(safe, { x, y, size, font, color });
    } catch {
      /* skip one glyph the font cannot draw */
    }
  }
}

function rule(pen: Pen) {
  pen.page.drawLine({ start: { x: MARGIN, y: pen.y }, end: { x: AMT_RIGHT, y: pen.y }, thickness: 0.6, color: LINE });
}

function ensure(pen: Pen, need: number) {
  if (pen.y - need >= MARGIN) return;
  blank(pen);
  if (pen.slip) {
    text(pen, pen.slip, MARGIN, pen.y - 10, 9, pen.font, MUTED);
    pen.y -= 18;
  }
}

function lines(pen: Pen, rows: string[], size: number, font: PDFFont, gap = 4) {
  for (const line of rows) {
    ensure(pen, size + gap);
    text(pen, line, MARGIN, pen.y - size, size, font);
    pen.y -= size + gap;
  }
}

function section(pen: Pen, label: string, body: string) {
  ensure(pen, 36);
  text(pen, label, MARGIN, pen.y - 12, 12, pen.bold);
  pen.y -= 18;
  const wrapped = wrap(pen.font, body || "—", 11, INNER);
  lines(pen, wrapped, 11, pen.font, 3);
  pen.y -= 8;
}

function drawCover(pen: Pen, input: SamlingPdfInput) {
  blank(pen);
  text(pen, "ZENKO · AS-samling", MARGIN, pen.y - 14, 12, pen.bold);
  pen.y -= 22;
  const nameLines = wrap(pen.bold, input.jobName || "Sag", 18, INNER);
  lines(pen, nameLines, 18, pen.bold, 2);
  pen.y -= 6;
  const meta: [string, string][] = [
    ["Til", input.client || "—"],
    ["Dato", input.dateLabel || "—"],
    ["Antal", String(input.rows.length)],
  ];
  for (const [k, v] of meta) {
    ensure(pen, 16);
    text(pen, k, MARGIN, pen.y - 11, 11, pen.bold);
    text(pen, v, MARGIN + 52, pen.y - 11, 11, pen.font);
    pen.y -= 16;
  }
  pen.y -= 8;
  ensure(pen, 18);
  text(pen, "NR", MARGIN, pen.y - 10, 9, pen.bold, MUTED);
  text(pen, "Titel", TITLE_X, pen.y - 10, 9, pen.bold, MUTED);
  text(pen, "Dato", DATE_X, pen.y - 10, 9, pen.bold, MUTED);
  const bel = "Beløb";
  text(pen, bel, AMT_RIGHT - pen.bold.widthOfTextAtSize(bel, 9), pen.y - 10, 9, pen.bold, MUTED);
  pen.y -= 14;
  rule(pen);
  pen.y -= 8;

  for (const row of input.rows) {
    const titleLines = wrap(pen.font, row.title || "—", 10, TITLE_W);
    const block = Math.max(1, titleLines.length) * 13 + 6;
    ensure(pen, block);
    const top = pen.y - 10;
    const nrSize = pen.bold.widthOfTextAtSize(row.number, 10) <= NR_W ? 10 : 8;
    text(pen, row.number, MARGIN, top, nrSize, pen.bold);
    titleLines.forEach((line, i) => text(pen, line, TITLE_X, top - i * 13, 10, pen.font));
    text(pen, row.dateLabel, DATE_X, top, 10, pen.font);
    const amt = row.priceLabel || "—";
    text(pen, amt, AMT_RIGHT - pen.font.widthOfTextAtSize(amt, 10), top, 10, pen.font);
    pen.y -= block;
    rule(pen);
    pen.y -= 4;
  }

  pen.y -= 8;
  ensure(pen, 22);
  const sum = `I alt ${input.totalLabel}`;
  text(pen, sum, AMT_RIGHT - pen.bold.widthOfTextAtSize(sum, 14), pen.y - 14, 14, pen.bold);
}

async function embedPhoto(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    if (bytes.byteLength < 24) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

async function drawSlip(pen: Pen, row: SamlingPdfRow, fetchImage?: SamlingPdfInput["fetchImage"]) {
  blank(pen);
  pen.slip = row.number;
  const heading = `Aftaleseddel nr: ${row.number}`;
  const headLines = wrap(pen.bold, heading, 16, INNER);
  lines(pen, headLines, 16, pen.bold, 3);
  if (row.title) {
    pen.y -= 2;
    lines(pen, wrap(pen.font, row.title, 12, INNER), 12, pen.font, 3);
  }
  pen.y -= 4;
  rule(pen);
  pen.y -= 12;
  const meta: [string, string][] = [
    ["Til", row.customer || "—"],
    ["Dato", longDate(row.createdAt)],
    ["Byggesag", row.projectName || "—"],
  ];
  for (const [k, v] of meta) {
    ensure(pen, 16);
    text(pen, `${k}:`, MARGIN, pen.y - 11, 11, pen.bold);
    const rest = wrap(pen.font, v, 11, INNER - 78);
    text(pen, rest[0] || "—", MARGIN + 78, pen.y - 11, 11, pen.font);
    pen.y -= 16;
    for (const extra of rest.slice(1)) {
      ensure(pen, 14);
      text(pen, extra, MARGIN + 78, pen.y - 11, 11, pen.font);
      pen.y -= 14;
    }
  }
  pen.y -= 6;
  section(pen, "Beskrivelse", row.body?.trim() || "Ingen beskrivelse");
  section(pen, "Kunde bemærkning", row.note?.trim() || "Ingen bemærkning");
  section(pen, "Lokation", row.location?.trim() || "Ikke angivet");
  ensure(pen, 22);
  text(pen, "Pris eksl moms", MARGIN, pen.y - 12, 11, pen.bold);
  text(pen, row.priceLabel || "—", MARGIN + 120, pen.y - 13, 13, pen.bold);
  pen.y -= 24;

  for (const reply of row.replies) {
    const chunk = `${dmy(reply.at)}  ${reply.text || ""}`.trim();
    if (!chunk) continue;
    section(pen, "Byggeledelse", chunk);
  }

  const srcs = row.photos.map((p) => p.src).filter(Boolean).slice(0, 24);
  const images: PDFImage[] = [];
  if (fetchImage) {
    const fetched = await Promise.all(
      srcs.map(async (src) => {
        try {
          return await fetchImage(src);
        } catch {
          return null;
        }
      }),
    );
    for (const bytes of fetched) {
      if (!bytes) continue;
      const img = await embedPhoto(pen.pdf, bytes);
      if (img) images.push(img);
    }
  }
  if (!images.length) {
    pen.slip = "";
    return;
  }
  ensure(pen, 22);
  text(pen, "Billeder", MARGIN, pen.y - 12, 12, pen.bold);
  pen.y -= 18;
  for (const img of images) {
    const maxW = INNER;
    const maxH = 230;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensure(pen, h + 10);
    pen.page.drawImage(img, { x: MARGIN, y: pen.y - h, width: w, height: h });
    pen.y -= h + 10;
  }
  pen.slip = "";
}

export async function buildSamlingPdf(input: SamlingPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const packed = await loadPdfFontBytes();
  const font = await pdf.embedFont(packed.regular, { subset: true });
  const bold = await pdf.embedFont(packed.bold, { subset: true });
  const pen: Pen = { pdf, page: null as unknown as PDFPage, font, bold, y: 0, slip: "" };
  drawCover(pen, input);
  for (const row of input.rows) await drawSlip(pen, row, input.fetchImage);
  return pdf.save();
}
