export type UdKey = "plads" | "erfaring" | "dagsrapport";

export const UD_FOLDERS: { key: UdKey; name: string }[] = [
  { key: "plads", name: "11 Pladsfiler" },
  { key: "erfaring", name: "12 Erfaring" },
  { key: "dagsrapport", name: "13 Dagsrapport" },
];

export const UD_ERFARING_TYPES = ["Pladsregel", "Genvej", "Godkendt metode"] as const;
export const UD_DAGS_TYPES = ["Klargøring", "Vejr", "Levering", "Andet fag", "Stop"] as const;

export const UD_CAD_EXTS = ["3dm", "skp", "obj", "fbx", "dwg", "dxf", "ifc", "step", "stp", "stl", "glb", "gltf"] as const;

export const UD_GALLERY_ACCEPT = "image/*,image/jpeg,image/png,image/webp,image/heic,image/heif";

export const UD_FILE_ACCEPT = [
  "image/*",
  "video/*",
  "application/pdf",
  ".pdf,.doc,.docx,.txt,.xls,.xlsx",
  ...UD_CAD_EXTS.map((ext) => `.${ext}`),
  "model/gltf-binary",
  "model/gltf+json",
  "model/obj",
  "model/stl",
].join(",");

export type UdFileKind = "image" | "video" | "pdf" | "doc" | "model" | "file";

export function udNoteSlug(text: string, at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "note";
  return `${day}-${slug}.txt`;
}

export function udFolderName(key: UdKey) {
  return UD_FOLDERS.find((f) => f.name && f.key === key)?.name ?? "11 Pladsfiler";
}

export function isUdNote(name: string) {
  return /\.note\.json$/i.test(name);
}

export function isUdDraftNote(name: string) {
  return /\.draft\.note\.json$/i.test(name);
}

/** 11 / 12 / 13 only — never 01 Udbud. */
export function resolveUdFolder(asked: string): string | null {
  const q = (asked || "").toLowerCase();
  if (!q.trim()) return null;
  if (q.includes("erfaring") || q.includes("pladsregel") || q.includes("genvej") || q.includes("godkendt") || q.includes("12")) {
    return "12 Erfaring";
  }
  if (q.includes("dagsrapport") || q.includes("dagbog") || q.includes("klarg") || q.includes("vejr") || q.includes("levering") || q.includes("13")) {
    return "13 Dagsrapport";
  }
  if (q.includes("pladsfil") || q.includes("datablad") || q.includes("rettelses") || q.includes("11")) {
    return "11 Pladsfiler";
  }
  return null;
}

export function udFileKind(name: string, mime = ""): UdFileKind {
  const n = String(name || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|mov|webm|m4v|3gp)$/.test(n)) return "video";
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  const ext = n.includes(".") ? n.split(".").pop() || "" : "";
  if ((UD_CAD_EXTS as readonly string[]).includes(ext) || m.startsWith("model/")) return "model";
  if (/\.(docx?|xlsx?|pptx?|txt|rtf)$/.test(n)) return "doc";
  return "file";
}

export function udFilePreviewable(kind: UdFileKind) {
  return kind === "image" || kind === "video" || kind === "pdf";
}

export function mimeForUdFile(name: string, mime = "") {
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    obj: "model/obj",
    stl: "model/stl",
    fbx: "application/octet-stream",
    "3dm": "model/vnd.3dm",
    skp: "application/vnd.sketchup.skp",
    dwg: "image/vnd.dwg",
    dxf: "image/vnd.dxf",
    ifc: "application/x-step",
    step: "application/step",
    stp: "application/step",
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    gif: "image/gif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    txt: "text/plain",
  };
  return map[ext] || mime || "application/octet-stream";
}

export function udFallbackName(file: { name?: string; type?: string }) {
  const given = String(file.name || "").trim();
  if (given) return given;
  const kind = udFileKind("", file.type || "");
  if (kind === "model") {
    if ((file.type || "").includes("gltf+json")) return "model.gltf";
    return "scaniverse.glb";
  }
  if (kind === "image") return "foto.jpg";
  if (kind === "video") return "video.mp4";
  if (kind === "pdf") return "fil.pdf";
  return "fil";
}
