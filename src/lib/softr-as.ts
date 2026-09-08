import type { FieldItem, Slip } from "./types";
import { isSoftrEtNumber } from "./softr-et-numbers.ts";
import { isSoftrTfNumber } from "./softr-tf-numbers.ts";
import { driveDisplayUrl } from "./tf-share.ts";
import { defaultLedelseStatus } from "./sag-ledelse-defaults.ts";
import manifest from "./softr-as-manifest.json" with { type: "json" };

type SoftrAsPhoto = { file: string; name: string; driveFileId?: string; driveUrl?: string };
type SoftrAsRow = {
  id: string;
  no: number;
  date: string;
  title: string;
  body: string;
  loc: string;
  price: number | null;
  solution: string;
  customer: string;
  softrProject: string;
  projectId: string;
  projectName: string;
  photos: SoftrAsPhoto[];
};

const ALL_ROWS = manifest as SoftrAsRow[];
const ROWS = ALL_ROWS.filter((r) => !isSoftrEtNumber(r.no) && !isSoftrTfNumber(r.no));

export function softrAsSlips(): Slip[] {
  return ROWS.map((r) => ({
    id: `slip-softr-${r.no}`,
    number: `AS-${r.no}`,
    projectId: r.projectId,
    title: r.title || `Aftaleseddel ${r.no}`,
    location: r.loc || "",
    body: r.body || r.title || "",
    masterSolution: r.solution || "",
    customerPrice: r.price != null && r.price !== 0 ? `${r.price} kr` : "0 kr",
    hoursEst: 0,
    materialsEst: "—",
    createdAt: r.date || new Date().toISOString(),
    status: "issued" as const,
    forwarded: false,
    paid: false,
    photoIds: r.photos.map((_, i) => `softr-as-${r.no}-${i + 1}`),
    source: "softr",
    ledelseStatus: defaultLedelseStatus("as", `AS-${r.no}`),
  }));
}

export function softrAsFieldItems(): FieldItem[] {
  const out: FieldItem[] = [];
  for (const r of ALL_ROWS) {
    r.photos.forEach((p, i) => {
      const et = isSoftrEtNumber(r.no);
      const tf = isSoftrTfNumber(r.no);
      out.push({
        id: `softr-as-${r.no}-${i + 1}`,
        projectId: r.projectId,
        projectName: r.projectName,
        employeeId: "softr",
        employeeName: "Softr",
        kind: "photo",
        name: p.name,
        mimeType: "image/jpeg",
        dataUrl: p.driveFileId ? driveDisplayUrl(p.driveFileId) : p.file,
        note: r.title,
        takenAt: r.date || new Date().toISOString(),
        status: "classified",
        classifiedAs: et ? "ent" : tf ? "tf" : "extra",
        reportId: et ? `ent-softr-${r.no}` : tf ? `tf-softr-${r.no}` : `slip-softr-${r.no}`,
        gpsLabel: r.loc || r.projectName,
        driveFileId: p.driveFileId,
        driveUrl: p.driveUrl,
      });
    });
  }
  return out;
}

export function ensureSoftrAs(state: { slips: Slip[]; fieldItems?: FieldItem[] }) {
  if (!Array.isArray(state.slips)) state.slips = [];
  state.slips = state.slips.filter((s) => {
    if (!String(s.id).startsWith("slip-softr-")) return true;
    return !isSoftrEtNumber(s.number) && !isSoftrTfNumber(s.number);
  });
  const fresh = softrAsSlips();
  const byId = new Map(state.slips.map((s) => [s.id, s]));
  for (const row of fresh) {
    const prev = byId.get(row.id);
    if (!prev) {
      state.slips = [row, ...state.slips];
      continue;
    }
    if (prev.trashedAt) continue;
    prev.photoIds = row.photoIds;
    prev.title = row.title;
    prev.body = row.body;
    prev.location = row.location;
    prev.masterSolution = row.masterSolution;
    prev.customerPrice = row.customerPrice;
    prev.projectId = row.projectId;
    prev.source = "softr";
    prev.status = "issued";
    if (prev.ledelseStatus == null) prev.ledelseStatus = row.ledelseStatus;
  }
  for (const slip of state.slips) {
    if (slip.ledelseStatus == null) slip.ledelseStatus = defaultLedelseStatus("as", slip.number);
  }
  const photos = softrAsFieldItems();
  if (!Array.isArray(state.fieldItems)) state.fieldItems = [];
  const have = new Set(state.fieldItems.map((p) => p.id));
  const extra = photos.filter((p) => !have.has(p.id));
  if (extra.length) state.fieldItems = [...extra, ...state.fieldItems];
  return state;
}

export function hydrateSoftrSlip(slip: Slip): Slip {
  const fresh = softrAsSlips().find((s) => s.id === slip.id);
  if (!fresh) return { ...slip, ledelseStatus: slip.ledelseStatus ?? defaultLedelseStatus("as", slip.number) };
  return { ...slip, ...fresh, trashedAt: slip.trashedAt, ledelseStatus: slip.ledelseStatus ?? fresh.ledelseStatus };
}
