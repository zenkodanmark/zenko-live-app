import { hoursWorked } from "./seed.ts";
import type { DriveMap } from "./drive.ts";
import type {
  Assignment,
  CalEvent,
  ChatMessage,
  DayLog,
  Employee,
  Entrepreneur,
  FieldItem,
  InvoicePack,
  Issue,
  KsPhoto,
  KsReport,
  MemoryNote,
  PlanBlock,
  Project,
  SiteDoc,
  Slip,
  Tf,
  Todo,
  YardLog,
} from "./types.ts";
import type { VoiceProblem } from "./voice-agent.ts";

export type YardSnapIn = {
  employees: Employee[];
  projects: Project[];
  assignments: Assignment[];
  plans: PlanBlock[];
  todos: Todo[];
  days: Record<string, DayLog>;
  slips: Slip[];
  tfs: Tf[];
  ents: Entrepreneur[];
  ksReports: KsReport[];
  packs: InvoicePack[];
  cal: CalEvent[];
  chats: ChatMessage[];
  issues?: Issue[];
  notes?: MemoryNote[];
  docs?: SiteDoc[];
  fieldItems?: FieldItem[];
  drivePhotos?: KsPhoto[];
  driveMaps?: Record<string, DriveMap>;
  inboxFolders?: Record<string, string>;
  serial?: { as: number; tf: number; er: number; ks: number; fb: number };
  logs?: YardLog[];
  problems?: VoiceProblem[];
};

function slimSlip(x: Slip) {
  return {
    id: x.id,
    number: x.number,
    projectId: x.projectId,
    title: x.title,
    location: x.location,
    body: (x.body ?? "").slice(0, 400),
    status: x.status,
    customerPrice: x.customerPrice,
    forwarded: x.forwarded,
    paid: x.paid,
    trashedAt: x.trashedAt,
    source: x.source,
    createdAt: x.createdAt,
  };
}

export function yardSnapshotJson(s: YardSnapIn) {
  const hours = Object.values(s.days)
    .filter((d) => d.checkInAt)
    .map((d) => ({
      employeeId: d.employeeId,
      date: d.date,
      projectId: d.projectId,
      minutes: Math.round(hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now()) * 60),
      note: d.workNote ?? "",
      source: d.source ?? "app",
      open: !d.checkOutAt,
      photos: (d.photos ?? []).length,
    }));
  const payload = {
    kind: "zenko-admin-backup",
    version: 2,
    at: new Date().toISOString(),
    serial: s.serial ?? null,
    employees: s.employees.map((e) => ({ id: e.id, name: e.name, role: e.role, language: e.language, pin: e.pin })),
    projects: s.projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      status: p.status,
      customer: p.customer,
      lat: p.lat,
      lng: p.lng,
      createdBy: p.createdBy,
      handedOverAt: p.handedOverAt,
      archivedAt: p.archivedAt,
      reopenReason: p.reopenReason,
    })),
    assignments: s.assignments,
    driveMaps: s.driveMaps ?? {},
    inboxFolders: s.inboxFolders ?? {},
    plans: s.plans,
    todos: (s.todos ?? []).map((t) => ({
      id: t.id,
      projectId: t.projectId,
      assigneeId: t.assigneeId,
      title: t.title,
      due: t.due,
      done: t.done,
      kind: t.kind,
      driveFileId: t.driveFileId,
      photoFileIds: t.photoFileIds,
    })),
    problems: (s.problems ?? []).map((p) => ({
      id: p.id,
      projectId: p.projectId,
      fromId: p.fromId,
      status: p.status,
      text: p.text.slice(0, 400),
      driveFileId: p.driveFileId,
    })),
    hours,
    issues: (s.issues ?? []).map((i) => ({
      id: i.id,
      projectId: i.projectId,
      employeeId: i.employeeId,
      kind: i.kind,
      body: (i.body ?? "").slice(0, 400),
      status: i.status,
      urgent: i.urgent,
    })),
    notes: (s.notes ?? []).map((n) => ({ id: n.id, projectId: n.projectId, body: (n.body ?? "").slice(0, 400), at: n.createdAt })),
    docs: (s.docs ?? []).map((d) => ({ id: d.id, projectId: d.projectId, title: d.title, folder: d.folder })),
    fieldItems: (s.fieldItems ?? [])
      .filter((f) => !String(f.id).startsWith("softr-"))
      .map((f) => ({
        id: f.id,
        projectId: f.projectId,
        employeeId: f.employeeId,
        kind: f.kind,
        name: f.name,
        note: f.note,
        status: f.status,
        driveFileId: f.driveFileId,
      })),
    drivePhotos: (s.drivePhotos ?? [])
      .filter((p) => p.driveFileId)
      .map((p) => ({
        id: p.id,
        driveFileId: p.driveFileId,
        projectId: p.projectId,
        employeeName: p.employeeName,
        takenAt: p.takenAt,
        point: p.point,
      })),
    reports: {
      slips: s.slips.map(slimSlip),
      tfs: s.tfs.map((x) => ({
        id: x.id,
        number: x.number,
        projectId: x.projectId,
        title: x.title ?? x.question,
        status: x.status,
        answered: x.answered,
        trashedAt: x.trashedAt,
        createdAt: x.createdAt,
      })),
      ents: s.ents.map((x) => ({
        id: x.id,
        number: x.number,
        projectId: x.projectId,
        title: x.title,
        status: x.status,
        trashedAt: x.trashedAt,
        createdAt: x.createdAt,
      })),
      ks: s.ksReports.map((x) => ({
        id: x.id,
        number: x.number,
        projectId: x.projectId,
        point: x.point,
        status: x.status,
        employeeName: x.employeeName,
        location: x.location,
        photoIds: x.photoIds,
        trashedAt: x.trashedAt,
        createdAt: x.createdAt,
      })),
      packs: s.packs.map((x) => ({ id: x.id, number: x.number, projectId: x.projectId, title: x.title })),
    },
    calendar: s.cal.map((e) => ({ id: e.id, projectId: e.projectId, title: e.title, at: e.at, kind: e.kind, source: e.source })),
    chats: s.chats.slice(-120).map((c) => ({
      id: c.id,
      at: c.at,
      fromId: c.fromId,
      projectId: c.projectId,
      text: (c.translations?.da || c.original || "").slice(0, 240),
    })),
    logs: (s.logs ?? []).slice(0, 80).map((l) => ({ at: l.at, text: l.text })),
  };
  return JSON.stringify(payload);
}
