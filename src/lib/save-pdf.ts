import { lookupProject, useYard } from "./store";
import { photoSrc } from "./tf-share";
import { softrAsFieldItems } from "./softr-as";
import { fileHref, uploadPladsBlob } from "./plads-file";
import { SB_ANON, SB_URL, supabase } from "./supabase";
import { drawPdfBytes, pdfFilename, pdfStoragePath, type PdfDoc, type PdfKind, type PdfPhoto } from "./render-pdf";
import type { FieldItem, Todo } from "./types";

export type SavePdfKind = PdfKind;

function tablesOf(kind: SavePdfKind) {
  if (kind === "todo") return ["todos"];
  if (kind === "tf") return ["tfs"];
  if (kind === "as") return ["slips"];
  if (kind === "tb") return ["offers", "slips"];
  return ["ents"];
}

function storeKind(kind: SavePdfKind): "todo" | "tf" | "slip" | "offer" | "ent" {
  if (kind === "as") return "slip";
  if (kind === "tb") return "offer";
  if (kind === "er") return "ent";
  return kind;
}

function fieldPhotos(): FieldItem[] {
  const s = useYard.getState();
  return [...softrAsFieldItems(), ...(s.fieldItems ?? [])];
}

function photoFromId(id: string): PdfPhoto | null {
  const fields = fieldPhotos();
  const hit = fields.find((f) => f.id === id || f.driveFileId === id);
  if (hit) {
    const src = photoSrc(hit) || fileHref(id);
    return src ? { src, caption: hit.name } : null;
  }
  const src = fileHref(id) || (id.startsWith("http") || id.startsWith("/") ? id : "");
  return src ? { src } : null;
}

function photosFromIds(ids: string[]): PdfPhoto[] {
  const out: PdfPhoto[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    const p = photoFromId(id);
    if (!p) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

function todoPhotoIds(td: Todo) {
  return [...(td.photoFileIds ?? []), ...(td.donePhotoFileIds ?? [])].filter(Boolean);
}

export function pdfDocFromStore(kind: SavePdfKind, id: string): PdfDoc | null {
  const s = useYard.getState();
  if (kind === "todo") {
    const td = s.todos.find((x) => x.id === id);
    if (!td) return null;
    const job = lookupProject(td.projectId);
    return {
      kind,
      id: td.id,
      number: td.id,
      title: td.title,
      projectId: td.projectId,
      projectName: job.name,
      customer: job.customer || "",
      createdAt: td.createdAt,
      body: td.body || td.original || "",
      doneAt: td.doneAt,
      photos: photosFromIds(todoPhotoIds(td)),
    };
  }
  if (kind === "tf") {
    const row = s.tfs.find((x) => x.id === id);
    if (!row) return null;
    const job = lookupProject(row.projectId);
    return {
      kind,
      id: row.id,
      number: row.number,
      title: row.title || row.question.slice(0, 80),
      projectId: row.projectId,
      projectName: job.name,
      customer: job.customer || "",
      createdAt: row.createdAt,
      body: row.question,
      extra: row.answer,
      extraHeading: "Svar",
      photos: photosFromIds(row.photoIds ?? []),
    };
  }
  if (kind === "er") {
    const row = s.ents.find((x) => x.id === id);
    if (!row) return null;
    const job = lookupProject(row.projectId);
    return {
      kind,
      id: row.id,
      number: row.number,
      title: row.title,
      projectId: row.projectId,
      projectName: job.name,
      customer: job.customer || "",
      createdAt: row.createdAt,
      body: row.body,
      extra: row.noteHe,
      extraHeading: "Bemærkning",
      location: row.location,
      photos: photosFromIds(row.photoIds ?? []),
    };
  }
  const row = kind === "tb" ? (s.offers ?? []).find((x) => x.id === id) ?? s.slips.find((x) => x.id === id) : s.slips.find((x) => x.id === id);
  if (!row) return null;
  const job = lookupProject(row.projectId);
  return {
    kind,
    id: row.id,
    number: row.number,
    title: row.title,
    projectId: row.projectId,
    projectName: job.name,
    customer: job.customer || "",
    createdAt: row.createdAt,
    body: row.body,
    extra: row.masterSolution,
    extraHeading: "Kunde bemærkning",
    location: row.location,
    priceRaw: row.customerPrice,
    photos: photosFromIds(row.photoIds ?? []),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

function asArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function fetchImageBytes(src: string): Promise<Uint8Array | null> {
  try {
    if (src.startsWith("data:")) {
      const raw = src.slice(src.indexOf(",") + 1);
      const bin = atob(raw);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function tryEdge(kind: SavePdfKind, id: string, photos: string[]): Promise<{ bytes: Uint8Array; path: string } | null> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/render-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SB_ANON}`,
        apikey: SB_ANON,
      },
      body: JSON.stringify({ type: kind, id, photos }),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("pdf") && !ctype.includes("octet-stream")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 80) return null;
    const path = res.headers.get("x-pdf-path") || "";
    return { bytes: buf, path };
  } catch {
    return null;
  }
}

async function writePdfPath(kind: SavePdfKind, id: string, path: string) {
  const sb = supabase();
  for (const table of tablesOf(kind)) {
    try {
      const upd = await sb.from(table).update({ pdf_path: path, updated_at: new Date().toISOString() }).eq("id", id);
      if (!upd.error) break;
    } catch {
      /* next table */
    }
  }
  const sk = storeKind(kind);
  if (sk === "todo") {
    useYard.getState().patchTodo(id, { pdfPath: path } as Partial<Todo>);
    return;
  }
  useYard.getState().patchReport(sk, id, { pdfPath: path });
}

export async function saveReportPdf(kind: SavePdfKind, id: string): Promise<{ ok: boolean; error: string }> {
  const doc = pdfDocFromStore(kind, id);
  const photoUrls = doc?.photos.map((p) => p.src) ?? [];
  let bytes: Uint8Array | null = null;
  let path = "";
  const edge = await tryEdge(kind, id, photoUrls);
  if (edge) {
    bytes = edge.bytes;
    path = edge.path;
  }
  if (!bytes) {
    if (!doc) return { ok: false, error: "Rapporten findes ikke" };
    bytes = await drawPdfBytes(doc, fetchImageBytes);
  }
  const filename = pdfFilename(doc?.number || id);
  const storagePath = path || pdfStoragePath(doc?.projectId || "sag", doc?.number || id);
  if (!path) {
    const blob = new Blob([asArrayBuffer(bytes)], { type: "application/pdf" });
    const up = await uploadPladsBlob({
      path: storagePath,
      blob,
      mimeType: "application/pdf",
      projectId: doc?.projectId,
      kind: "pdf",
      name: filename,
    });
    if (up.ok) path = storagePath;
  }
  if (path) await writePdfPath(kind, id, path);
  downloadBlob(new Blob([asArrayBuffer(bytes)], { type: "application/pdf" }), filename);
  return { ok: true, error: "" };
}

export function savePdfKindFromReport(kind: "slip" | "offer" | "tf" | "ent" | "todo"): SavePdfKind {
  if (kind === "slip") return "as";
  if (kind === "offer") return "tb";
  if (kind === "ent") return "er";
  return kind;
}
