import type { KsPhoto, KsReport } from "./types";
import manifest from "./softr-ks-manifest.json" with { type: "json" };

type SoftrPhoto = { file: string; name: string; bytes: number; driveFileId?: string; driveUrl?: string };
type SoftrRow = {
  id: string;
  no: number;
  date: string;
  user: string;
  qc: string;
  point: string;
  task: string;
  loc: string;
  scope: string;
  method: string;
  criteria: string;
  hours: number | null;
  kunde?: string;
  projectId?: string;
  projectName?: string;
  photos: SoftrPhoto[];
};

const GPS: Record<string, { lat: number; lng: number; name: string }> = {
  "job-hillerodsholm": { lat: 55.9298, lng: 12.3105, name: "Hillerødsholm" },
  "job-islevvaenge": { lat: 55.7034, lng: 12.4535, name: "Islevvænge" },
  "job-kaerhuset": { lat: 54.9475, lng: 9.851, name: "Kærhuset" },
  "job-provestenen": { lat: 55.9706, lng: 11.9985, name: "Prøvestenen Frederiksværk" },
};

const ALL = manifest as SoftrRow[];
const ROWS = ALL.filter((r) => r.projectId && r.projectId.startsWith("job-"));

function displayUser(raw: string) {
  const u = raw.toLowerCase();
  if (u.includes("osmorero") || u.includes("osvaldo")) return "Osvaldo";
  if (u.includes("federico")) return "Federico";
  if (u.includes("alex")) return "Alex I";
  if (u.includes("ion")) return "Ion Zafier";
  if (u.includes("marius")) return "Marius Pater";
  if (u.includes("ole")) return "Ole";
  if (u.includes("yevhen")) return "Yevhenii";
  return raw.trim() || "Softr";
}

function employeeIdOf(name: string) {
  const u = name.toLowerCase();
  if (u.includes("osvaldo")) return "emp-osvaldo";
  if (u.includes("federico")) return "emp-federico";
  if (u.includes("alex")) return "emp-alex";
  if (u.includes("ion")) return "emp-ion";
  if (u.includes("marius")) return "emp-marius";
  if (u.includes("ole")) return "emp-ole";
  return "softr";
}

function pointOf(r: SoftrRow) {
  const m = String(r.qc || r.point || "").match(/(\d+\.\d+)/);
  if (m) return m[1];
  return r.qc || r.task || `KS ${r.no}`;
}

export function softrKsPhotos(): KsPhoto[] {
  const out: KsPhoto[] = [];
  for (const r of ROWS) {
    const user = displayUser(r.user);
    const proj = GPS[r.projectId!] ?? { lat: 55.93, lng: 12.3, name: r.projectName || "Sag" };
    r.photos.forEach((p, i) => {
      out.push({
        id: `softr-ks-${r.no}-${i + 1}`,
        dataUrl: p.driveFileId ? "" : p.file,
        takenAt: `${r.date}T11:00:00.000Z`,
        floor: r.loc || "Plads",
        room: r.loc || proj.name,
        point: pointOf(r),
        gpsLabel: proj.name,
        lat: proj.lat,
        lng: proj.lng,
        accuracyM: null,
        gpsSource: "unknown",
        projectId: r.projectId!,
        projectName: r.projectName || proj.name,
        employeeId: employeeIdOf(user),
        employeeName: user,
        originalName: p.name,
        mimeType: "image/jpeg",
        bytes: p.bytes,
        deviceLabel: "softr",
        driveFileId: p.driveFileId,
        driveUrl: p.driveUrl,
        recognized: "plan",
        recognitionLabel: r.qc || r.task,
        recognitionNote: r.task,
        guessPoint: pointOf(r),
        guessLabel: r.qc || r.task,
      });
    });
  }
  return out;
}

export function softrKsReports(): KsReport[] {
  return ROWS.map((r) => {
    const user = displayUser(r.user);
    return {
      id: `ksr-softr-${r.no}`,
      number: String(r.no),
      projectId: r.projectId!,
      point: pointOf(r),
      createdAt: `${r.date}T11:00:00.000Z`,
      status: "issued",
      deviations: r.criteria ? `${r.criteria}.` : "Ingen afvigelser.",
      approved: true,
      employeeName: user,
      crew: user,
      process: "Murerarbejde",
      trade: "Murer",
      company: "Zenko Danmark ApS",
      photoIds: r.photos.map((_, i) => `softr-ks-${r.no}-${i + 1}`),
      location: r.loc || r.projectName || "",
      task: r.task,
      qcScope: r.scope,
      qcMethod: r.method,
      source: "softr",
      kundeStatus: r.kunde === "Til Kundeliste" || r.no === 2 ? "med_til_kunden" : "skjult",
    };
  });
}

export function ensureSoftrKs(state: { ksReports: KsReport[]; drivePhotos?: KsPhoto[] }) {
  if (!Array.isArray(state.ksReports)) state.ksReports = [];
  const fresh = softrKsReports();
  const byId = new Map(state.ksReports.map((r) => [r.id, r]));
  for (const row of fresh) {
    const prev = byId.get(row.id);
    if (!prev) {
      state.ksReports = [row, ...state.ksReports];
      continue;
    }
    if (prev.trashedAt) continue;
    prev.photoIds = row.photoIds;
    prev.employeeName = row.employeeName;
    prev.crew = row.crew;
    prev.location = row.location;
    prev.task = row.task;
    prev.qcScope = row.qcScope;
    prev.qcMethod = row.qcMethod;
    prev.source = "softr";
    prev.point = row.point;
    prev.deviations = row.deviations;
    prev.approved = row.approved;
    prev.projectId = row.projectId;
    if (prev.kundeStatus == null) prev.kundeStatus = row.kundeStatus;
  }
  const photos = softrKsPhotos();
  if (!Array.isArray(state.drivePhotos)) state.drivePhotos = [];
  const have = new Set(state.drivePhotos.map((p) => p.id));
  const extra = photos.filter((p) => !have.has(p.id));
  if (extra.length) state.drivePhotos = [...extra, ...state.drivePhotos];
  return state;
}

export function hydrateSoftrReport(report: KsReport): KsReport {
  const fresh = softrKsReports().find((r) => r.id === report.id || r.number === report.number);
  if (!fresh) return report;
  return { ...report, ...fresh, trashedAt: report.trashedAt, kundeStatus: report.kundeStatus ?? fresh.kundeStatus };
}
