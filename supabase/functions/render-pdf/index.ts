import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const INNER_W = PAGE_W - MARGIN * 2;
const PHOTO_MAX_H = 240;
const CREAM = rgb(250 / 255, 248 / 255, 244 / 255);
const TERRACOTTA = rgb(196 / 255, 92 / 255, 62 / 255);
const NAVY = rgb(26 / 255, 43 / 255, 51 / 255);
const INK = rgb(28 / 255, 25 / 255, 23 / 255);
const MUTED = rgb(74 / 255, 69 / 255, 63 / 255);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Kind = "todo" | "tf" | "as" | "tb" | "er";

function tablesOf(kind: Kind) {
  if (kind === "todo") return ["todos"];
  if (kind === "tf") return ["tfs"];
  if (kind === "as") return ["slips"];
  if (kind === "tb") return ["offers", "slips"];
  return ["ents"];
}

function headingFor(kind: Kind, number: string) {
  if (kind === "as") return `Aftaleseddel nr. ${number}`;
  if (kind === "tb") return `Tilbud nr. ${number}`;
  if (kind === "tf") return `Tilsynsnotat nr. ${number}`;
  if (kind === "er") return `Entreprenørrapport nr. ${number}`;
  return "To-do";
}

function filenameOf(number: string) {
  return `${String(number || "rapport").replace(/[^\w.-]+/g, "-")}.pdf`;
}

function pdfText(s: string) {
  return String(s ?? "");
}

function collapseRepeatedCopy(input: string): string {
  const s = String(input ?? "");
  if (s.length < 40) return s;
  if (s.length % 2 === 0) {
    const a = s.slice(0, s.length / 2);
    const b = s.slice(s.length / 2);
    if (a === b) return a;
  }
  const probe = s.slice(0, Math.min(96, Math.floor(s.length / 3)));
  if (probe.length >= 24) {
    const idx = s.indexOf(probe, probe.length);
    if (idx > 0) {
      const first = s.slice(0, idx);
      const second = s.slice(idx);
      if (first === second) return first;
    }
  }
  return s;
}

function descriptionOnce(title: string, body: string): { title: string; body: string } {
  const t = pdfText(title).trim();
  const b = collapseRepeatedCopy(pdfText(body)).trim();
  if (b && t && b === t) return { title: t, body: "" };
  return { title: t, body: b };
}

function noteOnce(title: string, body: string, extra: string): string {
  const e = collapseRepeatedCopy(pdfText(extra)).trim();
  if (!e) return "";
  const t = pdfText(title).trim();
  const b = collapseRepeatedCopy(pdfText(body)).trim();
  if (e === t || e === b) return "";
  return e;
}

function keptPrice(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return "";
  const da = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${da},-`;
}

function longDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || "").slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const FONT_CACHE: { regular?: Uint8Array; bold?: Uint8Array } = {};

async function loadFont(weight: "regular" | "bold"): Promise<Uint8Array> {
  const hit = FONT_CACHE[weight];
  if (hit && hit.byteLength > 1000) return hit;
  const name = weight === "bold" ? "NotoSans-Bold.ttf" : "NotoSans-Regular.ttf";
  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const urls = [
    `${sbUrl}/storage/v1/object/public/plads/fonts/${name}`,
    `https://zenkodanmark.github.io/fonts/${name}`,
    `https://raw.githubusercontent.com/zenkodanmark/zenko-live-app/main/public/fonts/${name}`,
  ];
  try {
    const local = await Deno.readFile(new URL(`./${name}`, import.meta.url));
    if (local.byteLength > 1000) {
      FONT_CACHE[weight] = local;
      return local;
    }
  } catch {
    /* remote */
  }
  for (const url of urls) {
    if (!url.startsWith("http")) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > 1000 && buf[0] === 0x00 && buf[1] === 0x01) {
        FONT_CACHE[weight] = buf;
        return buf;
      }
    } catch {
      /* next */
    }
  }
  throw new Error(`PDF-font mangler: ${name}`);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return new Response("method", { status: 405, headers: CORS });
    let body: { type?: string; id?: string; photos?: string[] } = {};
    try {
      body = await req.json();
    } catch {
      return new Response("bad json", { status: 400, headers: CORS });
    }
    const kind = body.type as Kind;
    const id = String(body.id || "");
    if (!id || !["todo", "tf", "as", "tb", "er"].includes(kind)) {
      return new Response("bad input", { status: 400, headers: CORS });
    }
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const sb = createClient(url, key, { auth: { persistSession: false } });
    let rec: Record<string, unknown> | null = null;
    let table = tablesOf(kind)[0]!;
    for (const t of tablesOf(kind)) {
      const { data, error } = await sb.from(t).select("*").eq("id", id).maybeSingle();
      if (!error && data) {
        rec = data as Record<string, unknown>;
        table = t;
        break;
      }
    }
    if (!rec) {
      const byNumber = await sb.from(tablesOf(kind)[0]!).select("*").eq("number", id).maybeSingle();
      if (!byNumber.error && byNumber.data) {
        rec = byNumber.data as Record<string, unknown>;
      }
    }
    if (!rec) return new Response("not found", { status: 404, headers: CORS });
    const number = String(rec.number || rec.id || "rapport");
    const title = String(rec.title || rec.question || "");
    const createdAt = String(rec.created_at || "");
    const projectId = String(rec.project_id || "sag");
    let projectName = "";
    let customer = "";
    if (projectId) {
      const p = await sb.from("projects").select("name,customer").eq("id", projectId).maybeSingle();
      projectName = String((p.data as { name?: string } | null)?.name || "");
      customer = String((p.data as { customer?: string } | null)?.customer || "");
    }
    const bodyText =
      kind === "tf" ? String(rec.question || "") : kind === "todo" ? String(rec.body || rec.original || "") : String(rec.body || "");
    const extraRaw =
      kind === "tf" ? String(rec.answer || "") : kind === "er" ? String(rec.note_he || "") : String(rec.master_solution || "");
    const copy = descriptionOnce(title, bodyText);
    const extra = noteOnce(copy.title, copy.body, extraRaw);
    const priceRaw = kind === "as" || kind === "tb" ? String(rec.customer_price || "") : "";
    const photoIds = Array.isArray(rec.photo_ids)
      ? (rec.photo_ids as string[])
      : Array.isArray(rec.photo_file_ids)
        ? (rec.photo_file_ids as string[])
        : [];
    const photoUrls = [
      ...(Array.isArray(body.photos) ? body.photos : []),
      ...photoIds.filter((u) => /^https?:\/\//.test(u) || u.includes("/")),
    ].filter(Boolean);

    const [regularBytes, boldBytes] = await Promise.all([loadFont("regular"), loadFont("bold")]);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(regularBytes, { subset: true });
    const bold = await pdf.embedFont(boldBytes, { subset: true });
    const images: { img: Awaited<ReturnType<typeof pdf.embedJpg>>; w: number; h: number }[] = [];
    for (const src of photoUrls.slice(0, 24)) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength < 32) continue;
        const img = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        images.push({ img, w: img.width, h: img.height });
      } catch {
        /* skip */
      }
    }

    const wrap = (f: typeof font, text: string, size: number, maxW: number) => {
      const words = pdfText(text).replace(/\r\n/g, "\n").split(/(\s+)/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        if (/\n/.test(w)) {
          lines.push(cur);
          cur = "";
          continue;
        }
        const next = cur + w;
        if (f.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
        else {
          lines.push(cur);
          cur = w.trimStart();
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    };

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    const cream = () => page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    cream();
    let y = PAGE_H - MARGIN;
    const ensure = (need: number) => {
      if (y - need < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        cream();
        y = PAGE_H - MARGIN;
      }
    };
    const text = (s: string, x: number, yy: number, size: number, f: typeof font, color = INK) => {
      const line = pdfText(s).replace(/[\r\n]+/g, " ");
      if (!line) return;
      page.drawText(line, { x, y: yy, size, font: f, color });
    };

    ensure(80);
    text("ZENKO DANMARK", MARGIN, y - 12, 10, bold, NAVY);
    text("CVR 42285757", MARGIN, y - 26, 9, font, MUTED);
    text(headingFor(kind, number), MARGIN, y - 52, 16, bold, TERRACOTTA);
    y -= 70;
    if (copy.title) {
      const lines = wrap(bold, copy.title, 12, INNER_W);
      ensure(lines.length * 16 + 8);
      for (const line of lines) {
        text(line, MARGIN, y, 12, bold, NAVY);
        y -= 16;
      }
      y -= 6;
    }
    const meta: [string, string][] = [
      ["Til", customer || "—"],
      ["Dato", longDate(createdAt)],
      ["Byggesag", projectName || "—"],
    ];
    if (rec.location) meta.push(["Lokation", String(rec.location)]);
    if (kind === "todo" && rec.done_at) meta.push(["Udført", longDate(String(rec.done_at))]);
    ensure(meta.length * 14 + 10);
    for (const [k, v] of meta) {
      text(`${k}:`, MARGIN, y, 10, bold, NAVY);
      text(String(v), MARGIN + 70, y, 10, font, INK);
      y -= 14;
    }
    y -= 8;

    const box = (heading: string, content: string) => {
      const lines = wrap(font, content || "—", 10, INNER_W - 16);
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
      text(heading, MARGIN + 8, y - 16, 11, bold, NAVY);
      let ty = y - 32;
      for (const line of lines) {
        text(line, MARGIN + 8, ty, 10, font, INK);
        ty -= 13;
      }
      y -= h + 10;
    };
    if (copy.body) box(kind === "tf" ? "Spørgsmål" : "Beskrivelse", copy.body);
    if (extra) box(kind === "tf" ? "Svar" : "Bemærkning", extra);
    const price = keptPrice(priceRaw);
    if (price) {
      ensure(40);
      text("Pris ekskl. moms", MARGIN, y, 10, bold, NAVY);
      text(price, MARGIN + 120, y, 14, bold, TERRACOTTA);
      y -= 28;
    }
    if (images.length) {
      ensure(22);
      text("Fotos", MARGIN, y, 12, bold, NAVY);
      y -= 18;
      for (const item of images) {
        const scale = Math.min(INNER_W / item.w, PHOTO_MAX_H / item.h, 1);
        const w = item.w * scale;
        const h = item.h * scale;
        ensure(h + 16);
        page.drawImage(item.img, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 12;
      }
    }

    const bytes = await pdf.save();
    const path = `${projectId.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "sag"}/pdf/${filenameOf(number)}`;
    try {
      await sb.storage.from("plads").upload(path, bytes, { upsert: true, contentType: "application/pdf" });
      await sb.from(table).update({ pdf_path: path, updated_at: new Date().toISOString() }).eq("id", rec.id || id);
    } catch {
      /* still return the file */
    }
    return new Response(bytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameOf(number)}"`,
        "x-pdf-path": path,
      },
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: { ...CORS, "Content-Type": "text/plain" } });
  }
});
