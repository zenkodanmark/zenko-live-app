import { projectIdFromSlug, slugForProject } from "./ks-customer";
import { orderLines } from "./material";
import { toSupplierThread } from "./ma-thread";
import { FIRM_PHONE, PROJECTS, projectById } from "./seed";
import type { MaShareStatus, MaThreadMsg, MaterialLine, MaterialOrder, MaterialReceipt, Project } from "./types";
import { isValidMaLineParam, isValidMaNr, isValidMaSlug } from "./route-guards.ts";

export { isValidMaLineParam, isValidMaNr, isValidMaSlug };
export { maThreadOriginal, shownMaThreadText, toSupplierThread } from "./ma-thread";

export type MaPublicLine = {
  n: string;
  product: string;
  spec: string;
  qty: number;
  unit: string;
  source: "udbud" | "mester";
  cite: string;
  productUrl: string;
  photoFileIds: string[];
  videoFileIds: string[];
  checked: boolean;
  checkedAt: string;
  checkedBy: string;
};

export type MaPublicPhoto = { fileId: string; n: string };

export type MaPublicOrder = {
  id: string;
  number: string;
  label: string;
  nr: string;
  slug: string;
  publicPath: string;
  projectId: string;
  sag: string;
  address: string;
  customer: string;
  phone: string;
  driverNote: string;
  orderedAt: string;
  expectedDate: string;
  shareStatus: MaShareStatus;
  missingData: boolean;
  dummy: boolean;
  lines: MaPublicLine[];
  thread: MaThreadMsg[];
  receiptPhotos: MaPublicPhoto[];
};

export function maNrFromNumber(number: string) {
  const m = String(number).match(/(\d{1,4})(?!.*\d)/);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n).padStart(3, "0");
}

export function maLabel(number: string) {
  const nr = maNrFromNumber(number);
  return nr ? `MA-2026-${nr}` : String(number);
}

export function maFolderName(number: string) {
  return maLabel(number);
}

export function maPublicPath(slug: string, number: string) {
  return `/ma/${slug}/${maNrFromNumber(number) || number}`;
}

export function maTelHref(phone: string) {
  const d = String(phone).replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 8) return `tel:+45${d}`;
  if (d.startsWith("45") && d.length >= 10) return `tel:+${d}`;
  if (d.startsWith("00")) return `tel:+${d.slice(2)}`;
  return `tel:+${d}`;
}

export function maDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }).replace(".", ".");
}

export function isMaPreview() {
  if (typeof window === "undefined") return !process.env.GROK_PROJECT_ID;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.includes("preview") || !import.meta.env.VITE_GROK_PROJECT_ID;
}

export function maLineN(i: number) {
  return String(i + 1).padStart(2, "0");
}

export function toMaPublic(order: MaterialOrder, receipts: MaterialReceipt[] = [], projects: Project[] = PROJECTS): MaPublicOrder {
  const job = projects.find((p) => p.id === order.projectId) ?? projectById(order.projectId);
  const slug = slugForProject(job);
  const nr = maNrFromNumber(order.number);
  const lines = orderLines(order).map((l, i) => toMaLine(l, i));
  const photos = receipts.flatMap((r) => r.photoFileIds).filter(Boolean);
  const extra = lines.flatMap((l) => l.photoFileIds);
  const all = [...new Set([...photos, ...extra])];
  return {
    id: order.id,
    number: order.number,
    label: maLabel(order.number),
    nr,
    slug,
    publicPath: order.publicPath || maPublicPath(slug, order.number),
    projectId: order.projectId,
    sag: job.name,
    address: order.deliveryAddress || job.address,
    customer: order.customer || job.customer || "",
    phone: order.phone || FIRM_PHONE,
    driverNote: order.driverNote || "",
    orderedAt: order.orderedAt,
    expectedDate: order.expectedDate,
    shareStatus: order.shareStatus ?? (order.status === "sent" ? "sendt" : "kladde"),
    missingData: false,
    dummy: false,
    lines,
    thread: (order.thread ?? []).map(toSupplierThread),
    receiptPhotos: all.map((fileId, i) => ({ fileId, n: maLineN(i) })),
  };
}

export function toMaLine(l: MaterialLine, i: number): MaPublicLine {
  return {
    n: maLineN(i),
    product: l.product,
    spec: l.spec,
    qty: l.qty,
    unit: l.unit || "stk",
    source: l.inUdbud ? "udbud" : "mester",
    cite: l.cite || "",
    productUrl: l.productUrl || "",
    photoFileIds: l.photoFileIds ?? [],
    videoFileIds: l.videoFileIds ?? [],
    checked: Boolean(l.checked),
    checkedAt: l.checkedAt || "",
    checkedBy: l.checkedBy || "",
  };
}

export function maLinesComplete(lines: { checked?: boolean }[]) {
  return lines.length > 0 && lines.every((l) => l.checked);
}

export function formatOrdreTxt(order: MaPublicOrder): string {
  const body = order.lines
    .map((l) => {
      const hak = l.checked ? "[x]" : "[ ]";
      const who = l.checked ? `  ${l.checkedAt || ""}  ${l.checkedBy || ""}` : "";
      const note = l.spec ? `\n    ${l.spec}` : "";
      return `${l.n}  ${l.product}  ${l.qty} ${l.unit}  ${hak}${who}${note}`;
    })
    .join("\n\n");
  return [
    "ZENKO MA",
    order.label,
    `Sag: ${order.sag}`,
    `Adresse: ${order.address}`,
    `Telefon: ${order.phone}`,
    `Chauffør: ${order.driverNote}`,
    `Dato: ${order.orderedAt}`,
    `Status: ${order.shareStatus}`,
    "",
    body,
    "",
    "---JSON---",
    JSON.stringify(order, null, 2),
  ].join("\n");
}

export function parseOrdreTxt(raw: string): MaPublicOrder | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const i = text.indexOf("---JSON---");
  const json = i >= 0 ? text.slice(i + 10).trim() : text;
  try {
    const o = JSON.parse(json) as MaPublicOrder;
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

export function formatChatLine(msg: MaThreadMsg) {
  return `${msg.at}  ${msg.name || msg.from}  ${msg.text.replace(/\s+/g, " ").trim()}`;
}

export function findOrderByPublic(orders: MaterialOrder[], slug: string, nr: string, projects: Project[] = PROJECTS) {
  const want = maNrFromNumber(nr);
  const pid = projectIdFromSlug(slug, projects);
  return orders
    .filter((o) => maNrFromNumber(o.number) === want && (!pid || o.projectId === pid || slugForProject(projectById(o.projectId)) === slug))
    .sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1))[0] ?? null;
}

export function dummyMaOrder(): MaPublicOrder {
  return {
    id: "mo-dummy-017",
    number: "MA-2026-017",
    label: "MA-2026-017",
    nr: "017",
    slug: "islevvaenge",
    publicPath: "/ma/islevvaenge/017",
    projectId: "job-islevvaenge",
    sag: "Islevvænge",
    address: "Fortvej 50, 2610 Rødovre",
    customer: "Ole Jepsen A/S",
    phone: "23 23 23 83",
    driverNote: "Indkørsel via Nørregade. Stilles ved container.",
    orderedAt: "2026-09-05T08:00:00.000Z",
    expectedDate: "2026-09-08",
    shareStatus: "sendt",
    missingData: false,
    dummy: true,
    lines: [
      { n: "01", product: "KC 50/50/700 mørtel", spec: "KC 50/50/700 til opmuring. Skrabefuge. Ingen afsyring.", qty: 12, unit: "sække", source: "udbud", cite: "Zmur 213.202", productUrl: "", photoFileIds: [], videoFileIds: [], checked: false, checkedAt: "", checkedBy: "" },
      { n: "02", product: "Brædder", spec: "Udfyldt af mester.", qty: 20, unit: "stk", source: "mester", cite: "", productUrl: "", photoFileIds: [], videoFileIds: [], checked: false, checkedAt: "", checkedBy: "" },
      { n: "03", product: "Afdækning", spec: "Presenning / ruller til afdækning.", qty: 4, unit: "ruller", source: "mester", cite: "", productUrl: "", photoFileIds: [], videoFileIds: [], checked: false, checkedAt: "", checkedBy: "" },
    ],
    thread: [],
    receiptPhotos: [],
  };
}

export function emptyMaOrder(slug: string, nr: string, projects: Project[] = PROJECTS): MaPublicOrder {
  const pid = projectIdFromSlug(slug, projects);
  const job = pid ? projects.find((p) => p.id === pid) ?? projectById(pid) : null;
  const label = maLabel(nr);
  return {
    id: "",
    number: label,
    label,
    nr: maNrFromNumber(nr) || nr,
    slug,
    publicPath: maPublicPath(slug, nr),
    projectId: pid ?? "",
    sag: job?.name || slug,
    address: job?.address || "",
    customer: job?.customer || "",
    phone: FIRM_PHONE,
    driverNote: "",
    orderedAt: "",
    expectedDate: "",
    shareStatus: "kladde",
    missingData: true,
    dummy: false,
    lines: [],
    thread: [],
    receiptPhotos: [],
  };
}

export function supplierMailBody(order: MaPublicOrder, origin: string) {
  const lines = order.lines.map((l) => `${l.n} ${l.product} — ${l.qty} ${l.unit}`).join("\n");
  const url = `${origin.replace(/\/$/, "")}${order.publicPath}`;
  return [
    `Materialebestilling ${order.label}`,
    `${order.sag} · ${order.address}`,
    order.phone ? `Kontakt ankomst: ${order.phone}` : "",
    order.driverNote ? `Chauffør: ${order.driverNote}` : "",
    "",
    lines,
    "",
    `Åbn ordren: ${url}`,
  ]
    .filter((l, i, arr) => l !== "" || (arr[i - 1] !== "" && i !== arr.length - 1))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

