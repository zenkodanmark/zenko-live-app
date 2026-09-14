import { askGps } from "./geo.ts";
import { localeFor } from "./i18n.ts";
import type { Lang } from "./types.ts";
import { sbSafeSegment, supabase } from "./supabase.ts";
import { uploadPladsBytes } from "./plads-file.ts";

export type TimeKind = "normal" | "ot50" | "ot100";

export type TimeEntry = {
  id: string;
  employeeId: string;
  projectId: string;
  date: string;
  hours: number;
  type: TimeKind;
  note: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  createdBy: string;
  files: TimeEntryFile[];
};

export type TimeEntryFile = {
  id: string;
  entryId: string;
  fileId: string;
  path: string;
  mime: string;
};

export function parseHours(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 24) return null;
  return Math.round(n * 100) / 100;
}

export function isTimeKind(v: string): v is TimeKind {
  return v === "normal" || v === "ot50" || v === "ot100";
}

export function timerDayLabel(date: string, lang: Lang) {
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function ksWorkStamp(dateYmd: string) {
  return `${dateYmd}T12:00:00.000+02:00`;
}

export function monthCells(year: number, month: number) {
  const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function timerPhotoPath(projectId: string, date: string, entryId: string, name: string) {
  const ext = (name.match(/\.[a-z0-9]{1,8}$/i)?.[0] || ".jpg").toLowerCase();
  const stem = sbSafeSegment(name.replace(/\.[^.]+$/, "")) || "foto";
  return `sager/${sbSafeSegment(projectId)}/timer/${date}/${sbSafeSegment(entryId)}/${stem}${ext}`;
}

function str(v: unknown) {
  return v == null ? "" : String(v);
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fromEntryRow(r: Record<string, unknown>, files: TimeEntryFile[]): TimeEntry {
  const rawType = str(r.type);
  const type: TimeKind = isTimeKind(rawType) ? rawType : "normal";
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    projectId: str(r.project_id),
    date: str(r.date).slice(0, 10),
    hours: num(r.hours),
    type,
    note: str(r.note),
    lat: r.lat == null ? undefined : num(r.lat),
    lng: r.lng == null ? undefined : num(r.lng),
    createdAt: str(r.created_at),
    createdBy: str(r.created_by),
    files,
  };
}

function fromFileRow(r: Record<string, unknown>): TimeEntryFile {
  return {
    id: str(r.id),
    entryId: str(r.entry_id),
    fileId: str(r.file_id),
    path: str(r.path),
    mime: str(r.mime),
  };
}

export async function listMyTimeEntries(employeeId: string): Promise<TimeEntry[]> {
  if (!employeeId) return [];
  const { data, error } = await supabase().from("time_entries").select("*").eq("employee_id", employeeId).order("date", { ascending: false }).limit(400);
  if (error || !data?.length) return [];
  const ids = data.map((r) => str(r.id)).filter(Boolean);
  const filesBy: Record<string, TimeEntryFile[]> = {};
  if (ids.length) {
    const files = await supabase().from("time_entry_files").select("*").in("entry_id", ids);
    for (const row of files.data ?? []) {
      const f = fromFileRow(row as Record<string, unknown>);
      (filesBy[f.entryId] ??= []).push(f);
    }
  }
  return data.map((r) => fromEntryRow(r as Record<string, unknown>, filesBy[str(r.id)] ?? []));
}

export async function saveTimeEntry(input: {
  employeeId: string;
  projectId: string;
  date: string;
  hours: number;
  type: TimeKind;
  note: string;
  photos: { name: string; contentBase64: string; mimeType: string }[];
}): Promise<{ ok: true; row: TimeEntry } | { ok: false; error: string }> {
  const id = `te-${crypto.randomUUID().slice(0, 10)}`;
  let lat: number | undefined;
  let lng: number | undefined;
  try {
    const gps = await askGps(4000);
    if (gps.ok) {
      lat = gps.fix.lat;
      lng = gps.fix.lng;
    }
  } catch {
    /* optional */
  }
  const payload = {
    id,
    employee_id: input.employeeId,
    project_id: input.projectId,
    date: input.date,
    hours: input.hours,
    type: input.type,
    note: input.note || null,
    lat: lat ?? null,
    lng: lng ?? null,
    created_by: input.employeeId,
  };
  const ins = await supabase().from("time_entries").insert(payload).select("*").maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: ins.error?.message || "Ikke sendt" };
  const files: TimeEntryFile[] = [];
  for (let i = 0; i < input.photos.length; i++) {
    const p = input.photos[i]!;
    const name = p.name || `foto-${i + 1}.jpg`;
    const path = timerPhotoPath(input.projectId, input.date, id, `${i + 1}-${name}`);
    const up = await uploadPladsBytes({
      path,
      contentBase64: p.contentBase64,
      mimeType: p.mimeType || "image/jpeg",
      projectId: input.projectId,
      kind: "timer",
      name,
    });
    if (!up.ok || !up.fileId) continue;
    const fid = `tef-${crypto.randomUUID().slice(0, 10)}`;
    const row = { id: fid, entry_id: id, file_id: up.fileId, path, mime: p.mimeType || "image/jpeg" };
    await supabase().from("time_entry_files").insert(row);
    files.push({ id: fid, entryId: id, fileId: up.fileId, path, mime: row.mime });
  }
  return { ok: true, row: fromEntryRow(ins.data as Record<string, unknown>, files) };
}
