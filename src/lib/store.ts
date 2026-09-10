import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { insideZone } from "./geo";
import {
  ASSIGNMENTS,
  CONTROL_PLAN,
  EMPLOYEES,
  FIRM,
  PROJECTS,
  SEED_CAL,
  SEED_DOCS,
  SEED_ENTS,
  SEED_FIELD_ITEMS,
  SEED_ISSUES,
  SEED_KS_REPORTS,
  SEED_LOGS,
  SEED_NOTES,
  SEED_PACKS,
  SEED_PLANS,
  SEED_SLIPS,
  SEED_TFS,
  SEED_TODOS,
  copenhagenDate,
  dayKey,
  ensureBotWeek37,
  mergeAliasJobs,
  ensureMastersOnJobs,
  findControlPoint,
  isCrewRole,
  isMasterRole,
  projectById,
  canonicalProjectId,
  seedTodayDays,
} from "./seed";
import { clearDeviceUser, isLoggedOut, readDeviceUser, rememberDeviceUser } from "./device-auth";
import { loadCrew } from "./crew-live";
import { emitYard } from "./yard-bus";
import { holdRow, slimChat, slimDay, slimKs, slimNeed, slimOrder, slimTodo } from "./yard-slim";
import { goesToMaster, unsavedOnNewMessage } from "./chat";
import { noticeForChat, noticeForKs, noticeForTodo, noticeForTodoDone, flashBrowser } from "./notify";
import { rememberDrive, type DriveMap } from "./drive";
import { applyArchive, applyReopen, ensureProjectHandover } from "./job-archive";
import { isMaterialNeed, matchModtagelse, orderLines, scanBehov } from "./material";
import { seedDrivePhotos } from "./ks-drive";
import type {
  Assignment,
  CalEvent,
  ChatMessage,
  ChatThread,
  DayLog,
  DocFolder,
  Employee,
  Entrepreneur,
  ExceptionReason,
  FieldItem,
  GpsFix,
  GpsPing,
  InboxClass,
  InvoicePack,
  Issue,
  IssueKind,
  KsPhoto,
  KsReport,
  Lang,
  MaterialNeed,
  MaterialOrder,
  MaterialReceipt,
  MemoryNote,
  MaThreadMsg,
  Notice,
  PlanBlock,
  Project,
  QueueItem,
  ReopenReason,
  ReportStatus,
  Role,
  Supplier,
  SiteDoc,
  Slip,
  Offer,
  Tf,
  Todo,
  TodoKind,
  YardLog,
} from "./types";
import type { VoiceProblem } from "./voice-agent";

void CONTROL_PLAN;
void findControlPoint;


type YardState = {
  employeeId: string | null;
  langOverride: Lang | null;
  toast: string | null;
  employees: Employee[];
  projects: Project[];
  assignments: Assignment[];
  days: Record<string, DayLog>;
  issues: Issue[];
  slips: Slip[];
  offers: Offer[];
  tfs: Tf[];
  ents: Entrepreneur[];
  packs: InvoicePack[];
  ksReports: KsReport[];
  docs: SiteDoc[];
  todos: Todo[];
  problems: VoiceProblem[];
  notes: MemoryNote[];
  cal: CalEvent[];
  plans: PlanBlock[];
  pings: GpsPing[];
  queue: QueueItem[];
  events: { at: string; text: string }[];
  chats: ChatMessage[];
  threads: ChatThread[];
  logs: YardLog[];
  needs: MaterialNeed[];
  orders: MaterialOrder[];
  receipts: MaterialReceipt[];
  suppliers: Supplier[];
  drivePhotos: KsPhoto[];
  fieldItems: FieldItem[];
  inboxFolders: Record<string, string>;
  driveMaps: Record<string, DriveMap>;
  chatSeenAt: Record<string, string>;
  threadSeenAt: Record<string, string>;
  boardSeenAt: Record<string, string>;
  notices: Notice[];
  openMaId: string | null;
  openChatWith: string | null;
  openChatJobId: string | null;
  openOnSitePick: boolean;
  adminFolderId: string;
  serial: { as: number; tb: number; tf: number; er: number; ks: number; fb: number; mo: number };
  login: (id: string) => void;
  logout: () => void;
  setLang: (lang: Lang | null) => void;
  clearToast: () => void;
  notSent: () => void;
  checkIn: (employeeId: string, projectId: string, gps: GpsFix, demoGps?: boolean) => void;
  checkOut: (employeeId: string, gps: GpsFix) => void;
  setDayNote: (employeeId: string, note: string) => void;
  togglePause: (employeeId: string) => void;
  addPing: (employeeId: string, gps: GpsFix) => void;
  addPhotos: (employeeId: string, photos: KsPhoto[]) => void;
  addIssue: (input: { employeeId: string; projectId: string; kind: IssueKind; body: string; urgent: boolean; orderDraft?: string }) => void;
  resolveIssue: (id: string, status: Issue["status"]) => void;
  grantException: (employeeId: string, reason: ExceptionReason, note: string) => void;
  exportReady: () => void;
  addEmployee: (input: { name: string; pin: string; role: Role; language: Lang; phone?: string }) => string | null;
  logHours: (input: {
    employeeId: string;
    projectId: string;
    date: string;
    checkInAt: string;
    checkOutAt: string;
    photos?: KsPhoto[];
    workNote?: string;
  }) => void;
  setAssignment: (employeeId: string, projectId: string, on: boolean) => void;
  addProject: (input: { id?: string; name: string; address: string; lat: number; lng: number; createdBy: string; brief?: string; customer?: string; trade?: string; period?: string; qualityManager?: string; udbudFolderId?: string; driveRootId?: string }) => string;
  archiveProject: (id: string, archived: boolean, reason?: ReopenReason) => void;
  patchProject: (id: string, patch: Partial<Project>) => void;
  addSlip: (input: {
    projectId: string;
    title: string;
    location: string;
    body: string;
    masterSolution: string;
    customerPrice: string;
    hoursEst: number;
    materialsEst: string;
    photoIds?: string[];
    fromChatId?: string;
    number?: string;
  }) => Slip;
  addOffer: (input: {
    projectId: string;
    title: string;
    location: string;
    body: string;
    masterSolution: string;
    customerPrice: string;
    hoursEst: number;
    materialsEst: string;
    photoIds?: string[];
    fromChatId?: string;
    number?: string;
  }) => Offer;
  toggleSlipForwarded: (id: string) => void;
  toggleSlipPaid: (id: string) => void;
  toggleOfferForwarded: (id: string) => void;
  toggleOfferPaid: (id: string) => void;
  trashReport: (kind: "slip" | "offer" | "tf" | "ent" | "ks", id: string) => void;
  restoreReport: (kind: "slip" | "offer" | "tf" | "ent" | "ks", id: string) => void;
  addTf: (input: { projectId: string; question: string; title?: string; photoIds?: string[]; fromChatId?: string; number?: string }) => Tf;
  answerTf: (id: string, answer: string) => void;
  addEnt: (input: { projectId: string; title: string; location: string; body: string; noteHe: string; photoIds?: string[]; fromChatId?: string; number?: string }) => Entrepreneur;
  addPack: (input: { projectId: string; title: string; slipIds: string[] }) => void;
  addKsReport: (projectId: string, point: string, extra?: { photoIds?: string[]; deviations?: string; location?: string; task?: string; fromChatId?: string; number?: string; driveFileId?: string }) => KsReport;
  addTodo: (input: {
    projectId: string;
    assigneeId: string;
    assigneeIds?: string[];
    title: string;
    due: string;
    fromId?: string;
    body?: string;
    kind?: TodoKind;
    needsPhoto?: boolean;
    translations?: Record<string, string>;
    id?: string;
    driveFileId?: string;
    photoFileIds?: string[];
    lat?: number | null;
    lng?: number | null;
    gpsLabel?: string;
    sourceLang?: Lang;
    original?: string;
    orderId?: string;
    fromChatId?: string;
    ledelseStatus?: import("./types").LedelseStatus;
  }) => Todo;
  addPlan: (input: {
    employeeId?: string;
    employeeIds?: string[];
    projectId: string;
    title: string;
    start: string;
    end: string;
    source?: PlanBlock["source"];
    place?: string;
    days?: string[];
    todoId?: string;
    comment?: string;
  }) => PlanBlock;
  patchPlan: (id: string, patch: Partial<PlanBlock>) => void;
  removePlan: (id: string) => void;
  toggleTodo: (id: string) => void;
  completeTodo: (id: string, byId?: string, extra?: { photoFileIds?: string[]; lat?: number | null; lng?: number | null; gpsLabel?: string }) => void;
  patchTodo: (id: string, patch: Partial<Todo>) => void;
  removeTodo: (id: string) => void;
  patchEmployee: (id: string, patch: Partial<Employee>) => void;
  convertTodo: (id: string, kind: "slip" | "tf" | "ent" | "ks", projectId?: string) => string | null;
  moveReport: (from: "slip" | "tf" | "ent" | "ks", id: string, to: "slip" | "tf" | "ent" | "ks", projectId?: string) => string | null;
  archiveChat: (id: string) => void;
  hideChat: (id: string, employeeId: string) => void;
  addNeed: (input: Omit<MaterialNeed, "id" | "at" | "status"> & Partial<Pick<MaterialNeed, "status" | "at">>) => MaterialNeed;
  dismissNeed: (id: string) => void;
  addOrder: (input: Omit<MaterialOrder, "id" | "number" | "orderedAt" | "status"> & Partial<Pick<MaterialOrder, "status" | "orderedAt" | "number" | "id" | "driveFileId">>) => MaterialOrder;
  patchOrder: (id: string, patch: Partial<MaterialOrder>) => void;
  addReceipt: (input: Omit<MaterialReceipt, "id" | "at" | "match"> & Partial<Pick<MaterialReceipt, "at" | "match" | "warning">>) => MaterialReceipt;
  orderToKs: (orderId: string) => string | null;
  addOrderThread: (id: string, msg: MaThreadMsg) => void;
  toggleOrderLine: (id: string, index: number, who: string) => void;
  addSupplier: (input: { name: string; email: string }) => Supplier | null;
  removeSupplier: (id: string) => void;
  addProblem: (problem: VoiceProblem) => void;
  patchProblem: (id: string, patch: Partial<VoiceProblem>) => void;
  addNote: (projectId: string, body: string) => void;
  addCal: (input: Omit<CalEvent, "id">) => void;
  addDoc: (input: Omit<SiteDoc, "id" | "excerpt" | "receivedAt" | "page"> & Partial<Pick<SiteDoc, "excerpt" | "receivedAt" | "page">>) => void;
  setReportStatus: (kind: "slip" | "offer" | "tf" | "ent" | "pack" | "ks", id: string, status: ReportStatus) => void;
  patchReport: (kind: "slip" | "offer" | "tf" | "ent" | "pack" | "ks", id: string, patch: Record<string, unknown>) => void;
  resetAlex: () => void;
  pushEvent: (text: string) => void;
  addChat: (input: Omit<ChatMessage, "id" | "at">) => ChatMessage;
  patchChat: (id: string, patch: Partial<ChatMessage>) => void;
  saveChatThread: (messageId: string) => ChatThread | null;
  ensureChatThread: (messageId: string) => ChatThread | null;
  addLog: (input: Omit<YardLog, "id" | "at">) => void;
  updatePhoto: (employeeId: string, photoId: string, patch: Partial<KsPhoto>) => void;
  assignPhotoPoint: (employeeId: string, photoId: string, point: string) => void;
  setAdminFolder: (id: string) => void;
  patchPhoto: (photoId: string, patch: Partial<KsPhoto>) => void;
  upsertDrivePhotos: (photos: KsPhoto[]) => void;
  markChatSeen: (employeeId: string) => void;
  markThreadSeen: (employeeId: string, threadId: string) => void;
  markBoardPileSeen: (employeeId: string, pile: string) => void;
  pushNotice: (row: Notice) => void;
  setOpenMa: (id: string | null) => void;
  setOpenChatWith: (id: string | null, projectId?: string | null) => void;
  setOpenOnSitePick: (on: boolean) => void;
  markNoticeRead: (id: string, employeeId: string) => void;
  markNoticesRead: (employeeId: string) => void;
  addFieldItems: (items: FieldItem[]) => void;
  patchFieldItem: (id: string, patch: Partial<FieldItem>) => void;
  classifyFieldItem: (id: string, classifiedAs: InboxClass, masterId: string) => { reportId?: string; reportNumber?: string };
  classifyChat: (id: string, classifiedAs: InboxClass, masterId: string) => { reportId?: string; reportNumber?: string; needId?: string };
  replyTodo: (id: string, fromId: string, text: string) => void;
  attachFieldToReport: (kind: "slip" | "offer" | "tf" | "ent", reportId: string, fieldIds: string[]) => void;
  setInboxFolder: (projectId: string, folderId: string) => void;
  setDriveMap: (projectId: string, map: DriveMap) => void;
};

function pad(n: number) {
  return String(n).padStart(3, "0");
}
function emptyDay(employeeId: string, date = copenhagenDate()): DayLog {
  return {
    employeeId,
    date,
    projectId: "",
    checkInAt: null,
    checkOutAt: null,
    pauseStartedAt: null,
    pauseMinutes: 0,
    photos: [],
    gpsInside: true,
    checkInGps: null,
    checkOutGps: null,
    demoGps: false,
    status: "open" as const
  };
}
function finalizeStatus(day: DayLog): DayLog {
  if (!day.checkOutAt) return {
    ...day,
    status: "open" as const
  };
  if (day.status === "exported") return day;
  return {
    ...day,
    status: "ready"
  };
}
function seedDays(): Record<string, DayLog> {
  return seedTodayDays();
}
function seedEvents(): { at: string; text: string }[] {
  return [];
}
const PERSIST_NAME = "zenko-plads-v32";
let liveSessionId: string | null = null;
let yardPushTimer: ReturnType<typeof setTimeout> | null = null;
let persistPushPaused = true;
let softrHydrateStarted = false;

function isSoftrRow(row: { id?: string; source?: string } | null | undefined) {
  if (!row) return false;
  if (row.source === "softr") return true;
  const id = String(row.id || "");
  return id.includes("-softr-") || id.startsWith("softr-");
}
function liveRows<T extends { id?: string; source?: string }>(rows: T[] | undefined | null): T[] {
  return (rows ?? []).filter((r) => !isSoftrRow(r));
}
function releasePersistPush() {
  if (typeof window === "undefined") {
    persistPushPaused = false;
    return;
  }
  window.setTimeout(() => {
    persistPushPaused = false;
  }, 2000);
}
function queueSoftrHydrate() {
  if (softrHydrateStarted || typeof window === "undefined") return;
  try {
    if (window.location.pathname === "/") return;
  } catch {
    return;
  }
  softrHydrateStarted = true;
  const start = () => {
    void import("./softr-ks")
      .then(async (ks) => {
        const [as, er, tf] = await Promise.all([import("./softr-as"), import("./softr-er"), import("./softr-tf")]);
        useYard.setState((s) => {
          const next = {
            ksReports: [...s.ksReports],
            slips: [...s.slips],
            offers: [...(s.offers ?? [])],
            tfs: [...s.tfs],
            ents: [...s.ents],
            drivePhotos: [...(s.drivePhotos ?? [])],
            fieldItems: [...(s.fieldItems ?? [])],
          };
          ks.ensureSoftrKs(next);
          as.ensureSoftrAs(next);
          er.ensureSoftrEr(next);
          tf.ensureSoftrTf(next);
          return next;
        });
      })
      .catch(() => {
        softrHydrateStarted = false;
      });
  };
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) ric(start, { timeout: 1200 });
  else window.setTimeout(start, 60);
}
function queueYardPush(json: string) {
  if (typeof window === "undefined") return;
  if (persistPushPaused) return;
  try {
    if (window.location.pathname === "/") return;
  } catch {
    return;
  }
  if (yardPushTimer) window.clearTimeout(yardPushTimer);
  yardPushTimer = window.setTimeout(() => {
    void import("./supabase-sync").then((m) => m.publishYardState(json)).catch(() => {});
  }, 2000);
}
function yardStorage() {
  const memory = new Map<string, string>();
  const mem = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    }
  };
  if (typeof window === "undefined") return mem;
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith("zenko-plads") && k !== PERSIST_NAME) window.localStorage.removeItem(k);
  } catch {}
  return {
    getItem: (k: string) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return mem.getItem(k);
      }
    },
    setItem: (k: string, v: string) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        try {
          for (const key of Object.keys(window.localStorage)) if (key.startsWith("zenko-plads")) window.localStorage.removeItem(key);
          window.localStorage.setItem(k, v);
        } catch {
          mem.setItem(k, v);
        }
      }
      queueYardPush(v);
    },
    removeItem: (k: string) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        mem.removeItem(k);
      }
    }
  };
}
function slimUrl<T extends { dataUrl?: string; driveFileId?: string }>(row: T): T {
  const src = row.dataUrl ?? "";
  if (!src || src.startsWith("/") || src.startsWith("http://") || src.startsWith("https://")) return row;
  if (row.driveFileId) return { ...row, dataUrl: "" };
  return row;
}
function makeTodo(input: Parameters<YardState["addTodo"]>[0], fromId: string): Todo {
  const ids = [...new Set((input.assigneeIds?.length ? input.assigneeIds : [input.assigneeId]).filter(Boolean))];
  return {
    id: input.id ?? `td-${crypto.randomUUID().slice(0, 6)}`,
    projectId: input.projectId,
    assigneeId: ids[0] ?? input.assigneeId,
    assigneeIds: ids.length ? ids : undefined,
    fromId: input.fromId ?? fromId,
    title: input.title,
    body: input.body ?? input.title,
    kind: input.kind ?? "task",
    due: input.due,
    done: false,
    needsPhoto: input.needsPhoto,
    translations: input.translations,
    driveFileId: input.driveFileId,
    photoFileIds: input.photoFileIds,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    gpsLabel: input.gpsLabel,
    sourceLang: input.sourceLang,
    original: input.original ?? input.body ?? input.title,
    orderId: input.orderId,
    fromChatId: input.fromChatId,
    ledelseStatus: input.ledelseStatus,
    createdAt: (new Date()).toISOString(),
    updatedAt: (new Date()).toISOString(),
  };
}
export const useYard = create<YardState>()(
  persist(
    (set, get) => ({
  employeeId: null,
  langOverride: null,
  toast: null,
  employees: EMPLOYEES,
  projects: PROJECTS,
  assignments: ASSIGNMENTS,
  days: seedDays(),
  issues: SEED_ISSUES,
  slips: SEED_SLIPS,
  offers: [] as Offer[],
  tfs: SEED_TFS,
  ents: SEED_ENTS,
  packs: SEED_PACKS,
  ksReports: SEED_KS_REPORTS,
  docs: SEED_DOCS,
  todos: SEED_TODOS,
  problems: [],
  notes: SEED_NOTES,
  cal: SEED_CAL,
  plans: SEED_PLANS,
  pings: [],
  queue: [],
  events: seedEvents(),
  chats: [],
  threads: [],
  logs: SEED_LOGS,
  needs: [],
  orders: [],
  receipts: [],
  suppliers: [] as Supplier[],
  drivePhotos: seedDrivePhotos(),
  fieldItems: SEED_FIELD_ITEMS,
  inboxFolders: {},
  driveMaps: {},
  chatSeenAt: {},
  threadSeenAt: {},
  boardSeenAt: {},
  notices: [] as Notice[],
  openMaId: null as string | null,
  openChatWith: null as string | null,
  openChatJobId: null as string | null,
  openOnSitePick: false,
  adminFolderId: "",
  serial: {
    as: 6,
    tb: 1,
    tf: 7,
    er: 1,
    ks: 5,
    fb: 1,
    mo: 1
  },
  login: (id) => {
    liveSessionId = id;
    const crew = typeof window !== "undefined" ? loadCrew() : [];
    const byId = new Map(get().employees.map((e) => [e.id, e]));
    for (const e of crew) {
      if (!e?.id) continue;
      const prev = byId.get(e.id);
      byId.set(e.id, prev ? { ...prev, ...e } : e);
    }
    const emp = byId.get(id) ?? EMPLOYEES.find((e) => e.id === id);
    if (emp) {
      rememberDeviceUser({ id: emp.id, role: emp.role });
      if (!byId.has(emp.id)) byId.set(emp.id, emp);
    }
    set({
      employeeId: id,
      employees: [...byId.values()],
    });
  },
  logout: () => {
    liveSessionId = null;
    clearDeviceUser();
    set({ employeeId: null });
  },
  setLang: (lang) => set({ langOverride: lang }),
  clearToast: () => set({ toast: null }),
  notSent: () => set({ toast: "Ikke sendt. I sender selv." }),
  checkIn: (employeeId, projectId, gps, demoGps) => {
    const key = dayKey(employeeId);
    const project = get().projects.find((p) => p.id === projectId) ?? projectById(projectId);
    const inside = insideZone(gps, project);
    const emp = get().employees.find((e) => e.id === employeeId);
    const log = {
      id: `lg-${crypto.randomUUID().slice(0, 6)}`,
      at: gps.at,
      kind: "checkin" as const,
      employeeId,
      projectId,
      text: `${emp?.name ?? "Ansat"} mødt på ${project.name}.`
    };
    set((s) => ({
      days: {
        ...s.days,
        [key]: {
          ...s.days[key] ?? emptyDay(employeeId),
          projectId,
          checkInAt: gps.at,
          checkInGps: gps,
          gpsInside: inside,
          demoGps: Boolean(demoGps),
          checkOutAt: null,
          status: "open" as const
        }
      },
      logs: [log, ...s.logs].slice(0, 400),
      events: [{
        at: gps.at,
        text: log.text
      }, ...s.events].slice(0, 40)
    }));
    const day = get().days[key];
    if (day) emitYard({ kind: "day", id: key, payload: slimDay(day), event: "checkin", actorId: employeeId, name: emp?.name });
  },
  checkOut: (employeeId, gps) => {
    const key = dayKey(employeeId);
    let extras: KsReport[] = [];
    set((s) => {
      const cur = s.days[key] ?? emptyDay(employeeId);
      const next = finalizeStatus({
        ...cur,
        checkOutAt: gps.at,
        checkOutGps: gps,
        pauseStartedAt: null
      });
      const emp = s.employees.find((e) => e.id === employeeId);
      const points = [...new Set(cur.photos.filter((p) => p.point && p.point !== "div").map((p) => p.point))];
      let ksN = s.serial.ks;
      const extraReports = points.map((point) => {
        const row = {
          id: `ksr-${crypto.randomUUID().slice(0, 8)}`,
          number: `Z-KS-2026-${String(ksN).padStart(3, "0")}`,
          projectId: cur.projectId,
          point,
          createdAt: gps.at,
          status: "issued" as const,
          deviations: "Ingen afvigelser.",
          approved: true,
          employeeName: emp?.name ?? "Svend",
          crew: emp?.name ?? "Sjak",
          process: "Murerarbejde",
          trade: "Murer",
          company: FIRM,
          photoIds: cur.photos.filter((p) => p.point === point).map((p) => p.id)
        };
        ksN += 1;
        return row;
      });
      extras = extraReports;
      const log = {
        id: `lg-${crypto.randomUUID().slice(0, 6)}`,
        at: gps.at,
        kind: "checkout" as const,
        employeeId,
        projectId: cur.projectId,
        text: `${emp?.name ?? "Svend"} gik hjem. KS ${cur.photos.length} fotos. Rapporter: ${points.join(", ") || "ingen"}.`
      };
      return {
        days: {
          ...s.days,
          [key]: next
        },
        ksReports: extraReports.length ? [...extraReports, ...s.ksReports] : s.ksReports,
        serial: extraReports.length ? {
          ...s.serial,
          ks: ksN
        } : s.serial,
        logs: [log, ...s.logs].slice(0, 400)
      };
    });
    const day = get().days[key];
    const emp = get().employees.find((e) => e.id === employeeId);
    if (day) emitYard({ kind: "day", id: key, payload: slimDay(day), event: "checkout", actorId: employeeId, name: emp?.name });
    for (const row of extras) emitYard({ kind: "ks", id: row.id, payload: slimKs(row), isNew: true, actorId: employeeId });
  },
  setDayNote: (employeeId, note) => {
    const key = dayKey(employeeId);
    set((s) => ({
      days: {
        ...s.days,
        [key]: {
          ...(s.days[key] ?? emptyDay(employeeId)),
          workNote: note,
        },
      },
    }));
    const day = get().days[key];
    if (day) emitYard({ kind: "day", id: key, payload: slimDay(day), event: null, actorId: employeeId });
  },
  togglePause: (employeeId) => {
    const key = dayKey(employeeId);
    set((s) => {
      const cur = s.days[key];
      if (!cur) return s;
      if (cur.pauseStartedAt) {
        const extra = (Date.now() - new Date(cur.pauseStartedAt).getTime()) / 6e4;
        return { days: {
          ...s.days,
          [key]: {
            ...cur,
            pauseStartedAt: null,
            pauseMinutes: cur.pauseMinutes + extra
          }
        } };
      }
      return { days: {
        ...s.days,
        [key]: {
          ...cur,
          pauseStartedAt: (new Date()).toISOString()
        }
      } };
    });
  },
  addPing: (employeeId, gps) => {
    const day = get().days[dayKey(employeeId)];
    if (!day?.projectId) return;
    const project = get().projects.find((p) => p.id === day.projectId);
    if (!project) return;
    const ping = {
      id: `pg-${crypto.randomUUID().slice(0, 6)}`,
      employeeId,
      projectId: day.projectId,
      at: gps.at,
      lat: gps.lat,
      lng: gps.lng,
      inside: insideZone(gps, project)
    };
    set((s) => ({
      pings: [ping, ...s.pings].slice(0, 200),
      days: {
        ...s.days,
        [dayKey(employeeId)]: {
          ...day,
          gpsInside: ping.inside
        }
      }
    }));
  },
  addPhotos: (employeeId, photos) => {
    const key = dayKey(employeeId);
    const emp = get().employees.find((e) => e.id === employeeId);
    const logs = photos.map((p) => ({
      id: `lg-${p.id}`,
      at: p.takenAt,
      kind: "ks" as const,
      employeeId,
      projectId: p.projectId,
      text: `${emp?.name ?? "Svend"} KS ${p.point} ${p.floor} ${p.room} ${p.recognized === "div" ? "(div)" : ""}`.trim()
    }));
    set((s) => {
      const cur = s.days[key] ?? emptyDay(employeeId);
      const projectId = photos[0]?.projectId || cur.projectId;
      return {
        days: {
          ...s.days,
          [key]: finalizeStatus({
            ...cur,
            projectId,
            photos: [...cur.photos, ...photos]
          })
        },
        logs: [...logs, ...s.logs].slice(0, 400)
      };
    });
  },
  addIssue: (input) => {
    const row = {
      id: `iss-${crypto.randomUUID().slice(0, 6)}`,
      createdAt: (new Date()).toISOString(),
      status: "open" as const,
      ...input
    };
    set((s) => ({
      issues: [row, ...s.issues],
      events: [{
        at: row.createdAt,
        text: `Besked: ${row.body.slice(0, 80)}`
      }, ...s.events].slice(0, 40)
    }));
  },
  resolveIssue: (id, status) => set((s) => ({ issues: s.issues.map((i) => i.id === id ? {
    ...i,
    status
  } : i) })),
  grantException: (employeeId, reason, note) => {
    const key = dayKey(employeeId);
    set((s) => {
      const cur = s.days[key] ?? emptyDay(employeeId);
      return { days: {
        ...s.days,
        [key]: finalizeStatus({
          ...cur,
          exceptionReason: reason,
          exceptionNote: note
        })
      } };
    });
  },
  exportReady: () => set((s) => {
    const date = copenhagenDate();
    const days = { ...s.days };
    for (const [k, d] of Object.entries(days)) if (d.date === date && d.status === "ready") days[k] = {
      ...d,
      status: "exported"
    };
    return {
      days,
      toast: "CSV hentet. Ikke sendt. I sender selv."
    };
  }),
  addEmployee: (input) => {
    const pin = String(input.pin ?? "").replace(/\D/g, "").slice(0, 4);
    if (pin.length !== 4) return null;
    const id = `emp-${crypto.randomUUID().slice(0, 6)}`;
    const initials = input.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    set((s) => ({
      employees: [...s.employees, {
        id,
        initials,
        ...input,
        pin,
      }],
      toast: "Medarbejder oprettet. De logger ind med pinkoden."
    }));
    const next = get().employees;
    void import("./crew-live").then((m) => {
      m.saveCrew(next);
      const emp = next.find((e) => e.id === id);
      if (emp) void m.publishEmployee(emp);
    });
    return id;
  },
  logHours: (input) => {
    const key = dayKey(input.employeeId, input.date);
    const emp = get().employees.find((e) => e.id === input.employeeId);
    const prev = get().days[key] ?? emptyDay(input.employeeId, input.date);
    const day = finalizeStatus({
      ...prev,
      employeeId: input.employeeId,
      date: input.date,
      projectId: input.projectId,
      checkInAt: input.checkInAt,
      checkOutAt: input.checkOutAt,
      photos: [...(prev.photos ?? []), ...(input.photos ?? [])],
      workNote: input.workNote || prev.workNote,
      source: "mester",
      gpsInside: true,
      demoGps: true,
      checkInGps: null,
      checkOutGps: null,
    });
    set((s) => ({
      days: { ...s.days, [key]: day },
      toast: "Timer gemt.",
    }));
    const saved = get().days[key];
    if (saved) {
      emitYard({
        kind: "day",
        id: key,
        payload: slimDay(saved),
        event: null,
        actorId: get().employeeId ?? input.employeeId,
        name: emp?.name,
      });
    }
  },
  setAssignment: (employeeId, projectId, on) => set((s) => ({ assignments: on ? [...s.assignments.filter((a) => !(a.employeeId === employeeId && a.projectId === projectId)), {
    employeeId,
    projectId
  }] : s.assignments.filter((a) => !(a.employeeId === employeeId && a.projectId === projectId)) })),
  addProject: (input) => {
    const existing = get().projects.find((p) => p.id === input.id || p.name.toLowerCase() === input.name.toLowerCase());
    if (existing) return existing.id;
    const id = input.id && !get().projects.some((p) => p.id === input.id) ? input.id : `job-${crypto.randomUUID().slice(0, 6)}`;
    const project = {
      udbudFolderId: input.udbudFolderId ?? "",
      driveRootId: input.driveRootId ?? "",
      brief: input.brief ?? `${input.name}.`,
      huddle: "Mød 07.00. KS efter kontrolplanen.",
      nextTask: "KS på pladsen — tag de billeder arbejdet kræver.",
      status: "active" as const,
      source: "Oprettet på plads",
      radiusM: 160,
      customer: input.customer ?? "",
      trade: input.trade,
      period: input.period,
      qualityManager: input.qualityManager,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdBy: input.createdBy,
      id,
      ksType: "alm" as const
    };
    set((s) => ({
      projects: [project, ...s.projects],
      assignments: [
        ...s.employees.map((e) => ({
          employeeId: e.id,
          projectId: id
        })),
        ...s.assignments
      ],
      toast: `${input.name} oprettet.`,
    }));
    const created = get().projects.find((p) => p.id === id);
    if (created) void import("./sb-live").then((m) => m.publishProject(created));
    return id;
  },
  archiveProject: (id, archived, reason) => set((s) => {
    const now = new Date().toISOString();
    const name = s.projects.find((p) => p.id === id)?.name ?? "Sagen";
    return {
      projects: s.projects.map((p) => {
        if (p.id !== id) return p;
        if (archived) return applyArchive(p, now);
        return applyReopen(p, reason ?? "mangler", now);
      }),
      toast: archived
        ? `${name} er afsluttet. Genåbnes ved mangler eller 1-/5-års aflevering.`
        : `${name} er aktiv igen.`,
    };
  }),
  patchProject: (id, patch) => {
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    const row = get().projects.find((p) => p.id === id);
    if (row) void import("./sb-live").then((m) => m.publishProject(row));
  },
  addSlip: (input) => {
    const n = get().serial.as;
    const slip = {
      id: `slip-${crypto.randomUUID().slice(0, 8)}`,
      number: `Z-AS-2026-${pad(n)}`,
      createdAt: (new Date()).toISOString(),
      status: "draft" as const,
      forwarded: false,
      paid: false,
      photoIds: [],
      ledelseStatus: "skjult" as const,
      ...input
    };
    set((s) => ({
      slips: [slip, ...s.slips],
      serial: {
        ...s.serial,
        as: n + 1
      },
      toast: "Gemt."
    }));
    void import("./sb-live").then((m) => m.publishSlip(slip));
    return slip;
  },
  addOffer: (input) => {
    const n = get().serial.tb ?? 1;
    const offer: Offer = {
      id: `offer-${crypto.randomUUID().slice(0, 8)}`,
      number: input.number || `TB-2026-${pad(n)}`,
      createdAt: (new Date()).toISOString(),
      status: "draft" as const,
      forwarded: false,
      paid: false,
      photoIds: [],
      ledelseStatus: "skjult" as const,
      kundeStatus: "skjult" as const,
      ...input,
    };
    set((s) => ({
      offers: [offer, ...(s.offers ?? [])],
      serial: {
        ...s.serial,
        tb: n + 1,
      },
      toast: "Gemt.",
    }));
    void import("./sb-live").then((m) => m.publishOffer(offer));
    return offer;
  },
  toggleSlipForwarded: (id) => set((s) => ({ slips: s.slips.map((x) => x.id === id ? {
    ...x,
    forwarded: !x.forwarded
  } : x) })),
  toggleSlipPaid: (id) => set((s) => ({ slips: s.slips.map((x) => x.id === id ? {
    ...x,
    paid: !x.paid
  } : x) })),
  toggleOfferForwarded: (id) => set((s) => ({ offers: (s.offers ?? []).map((x) => x.id === id ? {
    ...x,
    forwarded: !x.forwarded
  } : x) })),
  toggleOfferPaid: (id) => set((s) => ({ offers: (s.offers ?? []).map((x) => x.id === id ? {
    ...x,
    paid: !x.paid
  } : x) })),
  trashReport: (kind, id) => {
    const at = (new Date()).toISOString();
    set((s) => {
      if (kind === "slip") return {
        slips: s.slips.map((x) => x.id === id ? {
          ...x,
          trashedAt: at
        } : x),
        toast: "I papirkurv. Kan hentes igen."
      };
      if (kind === "offer") return {
        offers: (s.offers ?? []).map((x) => x.id === id ? {
          ...x,
          trashedAt: at
        } : x),
        toast: "I papirkurv. Kan hentes igen."
      };
      if (kind === "tf") return {
        tfs: s.tfs.map((x) => x.id === id ? {
          ...x,
          trashedAt: at
        } : x),
        toast: "I papirkurv. Kan hentes igen."
      };
      if (kind === "ent") return {
        ents: s.ents.map((x) => x.id === id ? {
          ...x,
          trashedAt: at
        } : x),
        toast: "I papirkurv. Kan hentes igen."
      };
      return {
        ksReports: s.ksReports.map((x) => x.id === id ? {
          ...x,
          trashedAt: at
        } : x),
        toast: "I papirkurv. Kan hentes igen."
      };
    });
  },
  restoreReport: (kind, id) => set((s) => {
    if (kind === "slip") return {
      slips: s.slips.map((x) => x.id === id ? {
        ...x,
        trashedAt: undefined
      } : x),
      toast: "Hentet fra papirkurv."
    };
    if (kind === "offer") return {
      offers: (s.offers ?? []).map((x) => x.id === id ? {
        ...x,
        trashedAt: undefined
      } : x),
      toast: "Hentet fra papirkurv."
    };
    if (kind === "tf") return {
      tfs: s.tfs.map((x) => x.id === id ? {
        ...x,
        trashedAt: undefined
      } : x),
      toast: "Hentet fra papirkurv."
    };
    if (kind === "ent") return {
      ents: s.ents.map((x) => x.id === id ? {
        ...x,
        trashedAt: undefined
      } : x),
      toast: "Hentet fra papirkurv."
    };
    return {
      ksReports: s.ksReports.map((x) => x.id === id ? {
        ...x,
        trashedAt: undefined
      } : x),
      toast: "Hentet fra papirkurv."
    };
  }),
  addTf: (input) => {
    const n = get().serial.tf;
    const tf = {
      id: `tf-${crypto.randomUUID().slice(0, 8)}`,
      number: `Z-TF-2026-${pad(n)}`,
      createdAt: (new Date()).toISOString(),
      status: "draft" as const,
      answered: false,
      photoIds: [],
      ledelseStatus: "skjult" as const,
      ...input
    };
    set((s) => ({
      tfs: [tf, ...s.tfs],
      serial: {
        ...s.serial,
        tf: n + 1
      },
      toast: "Gemt."
    }));
    void import("./sb-live").then((m) => m.publishTf(tf));
    return tf;
  },
  answerTf: (id, answer) =>
    set((s) => ({
      tfs: s.tfs.map((x) =>
        x.id === id
          ? {
              ...x,
              answer,
              answered: true,
              answeredAt: new Date().toISOString(),
              ledelseReplies: [...(x.ledelseReplies ?? []), { id: `rpl-${Date.now().toString(36)}`, text: answer, at: new Date().toISOString() }],
            }
          : x,
      ),
    })),
  addEnt: (input) => {
    const n = get().serial.er;
    const ent = {
      id: `ent-${crypto.randomUUID().slice(0, 8)}`,
      number: `Z-ER-2026-${pad(n)}`,
      createdAt: (new Date()).toISOString(),
      status: "draft" as const,
      ledelseStatus: "skjult" as const,
      ...input,
      photoIds: input.photoIds ?? []
    };
    set((s) => ({
      ents: [ent, ...s.ents],
      serial: {
        ...s.serial,
        er: n + 1
      },
      toast: "Gemt."
    }));
    void import("./sb-live").then((m) => m.publishEnt(ent));
    return ent;
  },
  addPack: (input) => {
    const n = get().serial.fb;
    const pack = {
      id: `pack-${crypto.randomUUID().slice(0, 8)}`,
      number: `Z-FB-2026-${pad(n)}`,
      createdAt: (new Date()).toISOString(),
      status: "draft" as const,
      ...input
    };
    set((s) => ({
      packs: [pack, ...s.packs],
      serial: {
        ...s.serial,
        fb: n + 1
      }
    }));
  },
  addKsReport: (projectId, point, extra) => {
    const n = get().serial.ks;
    const number = extra?.number ?? `Z-KS-2026-${pad(n)}`;
    const parsed = Number(String(number).replace(/\D/g, "").slice(-3)) || n;
    const emp = get().employees.find((e) => e.id === get().employeeId);
    const date = copenhagenDate();
    const crew = [...new Set(Object.values(get().days).filter((d) => d.projectId === projectId && d.date === date && d.checkInAt).map((d) => get().employees.find((e) => e.id === d.employeeId)?.name).filter((name) => Boolean(name)))].join(", ");
    const row = {
      id: `ksr-${crypto.randomUUID().slice(0, 8)}`,
      number,
      projectId,
      point,
      createdAt: (new Date()).toISOString(),
      status: "issued" as const,
      deviations: extra?.deviations?.trim() || "Ingen afvigelser.",
      approved: true,
      employeeName: emp?.name ?? "Mester",
      employeeId: emp?.id,
      crew: crew || emp?.name || "Sjak",
      process: "Murerarbejde",
      trade: "Murer",
      company: FIRM,
      photoIds: extra?.photoIds ?? [],
      location: extra?.location,
      task: extra?.task,
      fromChatId: extra?.fromChatId,
      kundeStatus: "skjult" as const
    };
    set((s) => ({
      ksReports: [row, ...s.ksReports],
      serial: {
        ...s.serial,
        ks: Math.max(n, parsed) + 1
      }
    }));
    const ksNote = noticeForKs(row, get().employees);
    if (ksNote) get().pushNotice(ksNote);
    emitYard({ kind: "ks", id: row.id, payload: slimKs(row), isNew: true, actorId: get().employeeId ?? row.employeeId ?? "" });
    return row;
  },
  addTodo: (input) => {
    const row = makeTodo(input, get().employeeId ?? "emp-ole");
    set((s) => ({ todos: [row, ...(s.todos ?? [])] }));
    const n = noticeForTodo(row);
    if (n) get().pushNotice(n);
    holdRow(row.id);
    emitYard({ kind: "todo", id: row.id, payload: slimTodo(row), isNew: true, actorId: get().employeeId ?? row.fromId });
    void import("./todo-live").then((m) => m.publishTodo(row));
    return row;
  },
  addPlan: (input) => {
    const ids = [...new Set((input.employeeIds?.length ? input.employeeIds : [input.employeeId ?? ""]).filter(Boolean))];
    const row = {
      id: `pl-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: ids[0] ?? "",
      employeeIds: ids,
      projectId: input.projectId,
      title: input.title,
      start: input.start,
      end: input.end,
      place: input.place,
      days: input.days,
      todoId: input.todoId,
      comment: input.comment,
      createdAt: (new Date()).toISOString(),
      createdBy: get().employeeId ?? "emp-ole",
      source: input.source ?? "manual",
      updatedAt: new Date().toISOString(),
    };
    const key = (p: PlanBlock) => `${[...(p.employeeIds?.length ? p.employeeIds : [p.employeeId])].slice().sort().join(",")}|${p.start}|${p.end}|${p.projectId}|${p.title}|${p.todoId ?? ""}`;
    set((s) => ({ plans: [...s.plans.filter((p) => key(p) !== key(row) && p.id !== row.id), row] }));
    holdRow(row.id);
    void import("./sb-live").then((m) => m.publishPlan(row));
    return row;
  },
  patchPlan: (id, patch) => {
    set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)) }));
    const row = get().plans.find((p) => p.id === id);
    if (row) {
      holdRow(row.id);
      void import("./sb-live").then((m) => m.publishPlan(row));
    }
  },
  removePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
  toggleTodo: (id) => set((s) => ({ todos: s.todos.map((t) => {
    if (t.id !== id) return t;
    if (t.done) return {
      ...t,
      done: false,
      doneAt: undefined,
      doneById: undefined
    };
    const byId = s.employeeId ?? t.assigneeId;
    const who = s.employees.find((e) => e.id === byId)?.name ?? "Ansat";
    const at = (new Date()).toISOString();
    return {
      ...t,
      done: true,
      doneAt: at,
      doneById: byId,
      history: [...(t.history ?? []), { at, text: `${who} udførte` }]
    };
  }) })),
  completeTodo: (id, byId, extra) => {
    const before = get().todos.find((t) => t.id === id);
    set((s) => {
    const whoId = byId ?? s.employeeId ?? "";
    const who = s.employees.find((e) => e.id === whoId)?.name ?? "Ansat";
    const at = (new Date()).toISOString();
    return {
      todos: s.todos.map((t) => t.id === id ? {
        ...t,
        done: true,
        doneAt: at,
        doneById: whoId || t.doneById,
        donePhotoFileIds: extra?.photoFileIds?.length ? [...(t.donePhotoFileIds ?? []), ...extra.photoFileIds] : t.donePhotoFileIds,
        doneLat: extra?.lat ?? t.doneLat,
        doneLng: extra?.lng ?? t.doneLng,
        doneGpsLabel: extra?.gpsLabel ?? t.doneGpsLabel,
        history: [...(t.history ?? []), { at, text: extra?.photoFileIds?.length ? `${who} udførte · ${extra.photoFileIds.length} foto` : `${who} udførte` }]
      } : t)
    };
  });
    const after = get().todos.find((t) => t.id === id);
    if (before && after) {
      const n = noticeForTodoDone(before, after, get().employees);
      if (n) get().pushNotice(n);
      emitYard({ kind: "todo", id: after.id, payload: slimTodo(after), isNew: false, actorId: after.doneById ?? get().employeeId ?? "" });
    }
  },
  patchTodo: (id, patch) => {
    const before = get().todos.find((t) => t.id === id);
    if (!before) return;
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() } : t)),
    }));
    const after = get().todos.find((t) => t.id === id);
    if (after) {
      holdRow(after.id);
      emitYard({ kind: "todo", id: after.id, payload: slimTodo(after), isNew: false, actorId: get().employeeId ?? after.fromId });
    }
  },
  replyTodo: (id, fromId, text) => {
    const note = text.trim();
    if (!note) return;
    const who = get().employees.find((e) => e.id === fromId)?.name ?? "Ansat";
    const at = new Date().toISOString();
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id
          ? {
              ...t,
              reply: note,
              history: [...(t.history ?? []), { at, text: `${who}: ${note}` }],
            }
          : t,
      ),
      toast: `${who} svarede på to-do`,
    }));
  },
  removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id), toast: "To-do slettet." })),
  patchEmployee: (id, patch) => {
    const pin = patch.pin !== undefined ? String(patch.pin).replace(/\D/g, "").slice(0, 4) : undefined;
    if (pin !== undefined && pin.length !== 4) {
      set({ toast: "Pinkode skal være fire cifre." });
      return;
    }
    set((s) => ({
      employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch, ...(pin !== undefined ? { pin } : {}) } : e)),
      toast: pin !== undefined ? "PIN gemt." : "Gemt.",
    }));
    const next = get().employees;
    void import("./crew-live").then((m) => {
      m.saveCrew(next);
      const emp = next.find((e) => e.id === id);
      if (emp) void m.publishEmployee(emp);
    });
  },
  convertTodo: (id, kind, projectId) => {
    const td = get().todos.find((x) => x.id === id);
    if (!td) return null;
    const jobId = projectId || td.projectId;
    const job = get().projects.find((p) => p.id === jobId);
    const title = td.title.slice(0, 80);
    const body = td.body || td.title;
    const photoIds = [...new Set([
      ...(td.photoFileIds ?? []),
      ...(td.donePhotoFileIds ?? []),
      td.driveFileId ?? "",
      ...((() => {
        if (!td.fromChatId) return [] as string[];
        const msg = get().chats.find((c) => c.id === td.fromChatId);
        return (msg?.photos ?? []).map((p) => p.driveFileId ?? "").filter(Boolean);
      })()),
    ].filter(Boolean))];
    let createdId = "";
    if (kind === "slip") {
      const row = get().addSlip({
        projectId: jobId,
        title,
        location: job?.name ?? "",
        body,
        masterSolution: body,
        customerPrice: "",
        hoursEst: 0,
        materialsEst: "",
        photoIds,
      });
      createdId = row.id;
    } else if (kind === "tf") {
      const row = get().addTf({ projectId: jobId, question: body, title, photoIds });
      createdId = row.id;
    } else if (kind === "ent") {
      const row = get().addEnt({ projectId: jobId, title, location: job?.name ?? "", body, noteHe: body, photoIds });
      createdId = row.id;
    } else {
      const row = get().addKsReport(jobId, "div", { deviations: body, location: job?.name ?? "", task: title, photoIds });
      createdId = row.id;
    }
    get().patchTodo(id, { done: true, doneAt: new Date().toISOString() });
    return createdId;
  },
  moveReport: (from, id, to, projectId) => {
    if (from === to && !projectId) return id;
    const s = get();
    const jobFallback = projectId;
    if (from === "slip") {
      const row = s.slips.find((x) => x.id === id);
      if (!row) return null;
      const jobId = jobFallback || row.projectId;
      get().trashReport("slip", id);
      if (to === "slip") {
        get().restoreReport("slip", id);
        get().patchReport("slip", id, { projectId: jobId });
        return id;
      }
      if (to === "tf") return get().addTf({ projectId: jobId, question: row.body || row.title, title: row.title, photoIds: row.photoIds }).id;
      if (to === "ent") return get().addEnt({ projectId: jobId, title: row.title, location: row.location, body: row.body, noteHe: row.masterSolution, photoIds: row.photoIds }).id;
      return get().addKsReport(jobId, "div", { deviations: row.body, location: row.location, task: row.title, photoIds: row.photoIds }).id;
    }
    if (from === "tf") {
      const row = s.tfs.find((x) => x.id === id);
      if (!row) return null;
      const jobId = jobFallback || row.projectId;
      get().trashReport("tf", id);
      if (to === "tf") {
        get().restoreReport("tf", id);
        get().patchReport("tf", id, { projectId: jobId });
        return id;
      }
      const title = row.title || row.question.slice(0, 48);
      if (to === "slip") return get().addSlip({ projectId: jobId, title, location: "", body: row.question, masterSolution: row.answer || "", customerPrice: "", hoursEst: 0, materialsEst: "", photoIds: row.photoIds }).id;
      if (to === "ent") return get().addEnt({ projectId: jobId, title, location: "", body: row.question, noteHe: row.answer || "", photoIds: row.photoIds }).id;
      return get().addKsReport(jobId, "div", { deviations: row.question, task: title, photoIds: row.photoIds }).id;
    }
    if (from === "ent") {
      const row = s.ents.find((x) => x.id === id);
      if (!row) return null;
      const jobId = jobFallback || row.projectId;
      get().trashReport("ent", id);
      if (to === "ent") {
        get().restoreReport("ent", id);
        get().patchReport("ent", id, { projectId: jobId });
        return id;
      }
      if (to === "slip") return get().addSlip({ projectId: jobId, title: row.title, location: row.location, body: row.body, masterSolution: row.noteHe, customerPrice: "", hoursEst: 0, materialsEst: "", photoIds: row.photoIds }).id;
      if (to === "tf") return get().addTf({ projectId: jobId, question: row.body || row.title, title: row.title, photoIds: row.photoIds }).id;
      return get().addKsReport(jobId, "div", { deviations: row.body, location: row.location, task: row.title, photoIds: row.photoIds }).id;
    }
    const row = s.ksReports.find((x) => x.id === id);
    if (!row) return null;
    const jobId = jobFallback || row.projectId;
    get().trashReport("ks", id);
    if (to === "ks") {
      get().restoreReport("ks", id);
      get().patchReport("ks", id, { projectId: jobId });
      return id;
    }
    const title = row.task || row.point;
    const body = row.deviations || title;
    if (to === "slip") return get().addSlip({ projectId: jobId, title, location: row.location ?? "", body, masterSolution: body, customerPrice: "", hoursEst: 0, materialsEst: "", photoIds: row.photoIds }).id;
    if (to === "tf") return get().addTf({ projectId: jobId, question: body, title, photoIds: row.photoIds }).id;
    return get().addEnt({ projectId: jobId, title, location: row.location ?? "", body, noteHe: body, photoIds: row.photoIds }).id;
  },
  archiveChat: (id) => set((s) => ({
    chats: s.chats.map((c) => (c.id === id ? { ...c, archivedAt: new Date().toISOString(), handledAt: c.handledAt || new Date().toISOString() } : c)),
  })),
  hideChat: (id, employeeId) => set((s) => {
    const root = s.chats.find((x) => x.id === id);
    const threadId = root?.threadId;
    return {
      chats: s.chats.map((c) => {
        if (c.id !== id && !(threadId && c.threadId === threadId)) return c;
        return { ...c, hiddenBy: [...new Set([...(c.hiddenBy ?? []), employeeId])] };
      }),
    };
  }),
  addNeed: (input) => {
    const row: MaterialNeed = {
      id: `nd-${crypto.randomUUID().slice(0, 8)}`,
      at: input.at ?? new Date().toISOString(),
      status: input.status ?? "need",
      chatId: input.chatId,
      projectId: input.projectId,
      fromId: input.fromId,
      keywords: input.keywords,
      text: input.text,
    };
    set((s) => ({ needs: [row, ...(s.needs ?? [])] }));
    emitYard({ kind: "need", id: row.id, payload: slimNeed(row), isNew: true, actorId: get().employeeId ?? row.fromId });
    return row;
  },
  dismissNeed: (id) => {
    set((s) => ({ needs: (s.needs ?? []).map((n) => (n.id === id ? { ...n, status: "dismissed" as const } : n)) }));
    const row = get().needs.find((n) => n.id === id);
    if (row) emitYard({ kind: "need", id: row.id, payload: slimNeed(row), isNew: false, actorId: get().employeeId ?? row.fromId });
  },
  addOrder: (input) => {
    const n = get().serial.mo ?? 1;
    const number = input.number ?? `MA-2026-${String(n).padStart(3, "0")}`;
    const parsed = Number(String(number).replace(/\D/g, "").slice(-3)) || n;
    const row: MaterialOrder = {
      ...input,
      id: input.id ?? `mo-${crypto.randomUUID().slice(0, 8)}`,
      number,
      orderedAt: input.orderedAt ?? new Date().toISOString(),
      status: input.status ?? "draft",
    };
    set((s) => ({
      orders: [row, ...(s.orders ?? [])],
      serial: { ...s.serial, mo: Math.max(n, parsed) + 1 },
      needs: (s.needs ?? []).map((nd) => (nd.id === row.needId ? { ...nd, status: "ordered" as const } : nd)),
    }));
    emitYard({ kind: "order", id: row.id, payload: slimOrder(row), isNew: true, actorId: get().employeeId ?? row.fromId });
    void import("./sb-live").then((m) => m.publishOrder(row));
    return row;
  },
  patchOrder: (id, patch) => {
    set((s) => ({ orders: (s.orders ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
    const row = get().orders.find((o) => o.id === id);
    if (row) emitYard({ kind: "order", id: row.id, payload: slimOrder(row), isNew: false, actorId: get().employeeId ?? row.fromId });
  },
  addOrderThread: (id, msg) => {
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, thread: [...(o.thread ?? []), msg] } : o)),
    }));
    if (msg.from !== "leverandor") return;
    const o = get().orders.find((x) => x.id === id);
    const toIds = get().employees.filter((e) => isMasterRole(e.role)).map((e) => e.id);
    if (!toIds.length) return;
    get().pushNotice({
      id: `nt-ma-${id}-${msg.at}`,
      at: msg.at,
      kind: "ma",
      title: "Svar fra leverandør",
      body: [o?.number, msg.text.slice(0, 80)].filter(Boolean).join(" · "),
      toIds,
      fromId: "leverandor",
      refId: id,
      projectId: o?.projectId,
      readBy: [],
    });
  },
  toggleOrderLine: (id, index, who) => {
    const o = get().orders.find((x) => x.id === id);
    if (!o) return;
    const now = new Date().toISOString();
    const lines = orderLines(o).map((l, i) => {
      if (i !== index) return l;
      const on = !l.checked;
      return { ...l, checked: on, checkedAt: on ? now : "", checkedBy: on ? who : "" };
    });
    const all = lines.length > 0 && lines.every((l) => l.checked);
    get().patchOrder(id, { lines, status: all ? "received" : o.status === "received" ? "sent" : o.status });
  },
  addSupplier: (input) => {
    const name = input.name.trim();
    const email = input.email.trim();
    if (!name || !email.includes("@")) return null;
    const row: Supplier = { id: `sup-${crypto.randomUUID().slice(0, 6)}`, name, email };
    set((s) => ({ suppliers: [row, ...(s.suppliers ?? [])] }));
    return row;
  },
  removeSupplier: (id) => set((s) => ({ suppliers: (s.suppliers ?? []).filter((x) => x.id !== id) })),
  addReceipt: (input) => {
    const order = get().orders.find((o) => o.id === input.orderId);
    const guessed = { product: input.guessedProduct ?? "", qty: input.guessedQty ?? null };
    const match = order
      ? matchModtagelse(order.product, order.qty, guessed.product, guessed.qty)
      : { ok: true, warning: "" };
    const row: MaterialReceipt = {
      id: `rc-${crypto.randomUUID().slice(0, 8)}`,
      at: input.at ?? new Date().toISOString(),
      match: input.match ?? (guessed.product || guessed.qty != null ? (match.ok ? "ok" : "mismatch") : "unknown"),
      warning: input.warning ?? match.warning,
      orderId: input.orderId,
      projectId: input.projectId,
      employeeId: input.employeeId,
      source: input.source,
      photoFileIds: input.photoFileIds,
      gpsLabel: input.gpsLabel,
      lat: input.lat,
      lng: input.lng,
      note: input.note,
      guessedProduct: input.guessedProduct,
      guessedQty: input.guessedQty,
      driveFileId: input.driveFileId,
    };
    set((s) => ({
      receipts: [row, ...s.receipts],
      orders: s.orders.map((o) =>
        o.id === row.orderId
          ? {
              ...o,
              status: row.match === "mismatch" ? "mismatch" : o.status === "ks" ? "ks" : "received",
              warning: row.warning || o.warning,
            }
          : o,
      ),
      todos: s.todos.map((td) =>
        td.orderId === row.orderId && !td.done
          ? { ...td, done: true, doneAt: row.at, doneById: row.employeeId, donePhotoFileIds: [...(td.donePhotoFileIds ?? []), ...row.photoFileIds] }
          : td,
      ),
      toast: row.warning ? row.warning : row.match === "ok" ? "Modtaget OK" : s.toast,
    }));
    return row;
  },
  orderToKs: (orderId) => {
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return null;
    const recs = get().receipts.filter((r) => r.orderId === orderId);
    const photos = recs.flatMap((r) => r.photoFileIds);
    const warn = recs.map((r) => r.warning).filter(Boolean).join(" ");
    const ks = get().addKsReport(order.projectId, "Modtagelseskontrol", {
      task: `Materiale ${order.product}`,
      location: order.deliveryAddress,
      deviations: warn || `Modtaget ${order.product} · ${order.qty} ${order.unit}. Ingen afvigelser.`,
      photoIds: photos,
    });
    get().patchOrder(orderId, { ksReportId: ks.id, status: "ks" });
    return ks.id;
  },
  addProblem: (problem) => set((s) => ({ problems: [problem, ...(s.problems ?? []).filter((p) => p.id !== problem.id)] })),
  patchProblem: (id, patch) => set((s) => ({ problems: (s.problems ?? []).map((p) => p.id === id ? { ...p, ...patch } : p) })),
  addNote: (projectId, body) => set((s) => ({ notes: [{
    id: `mn-${crypto.randomUUID().slice(0, 6)}`,
    projectId,
    body,
    createdAt: (new Date()).toISOString()
  }, ...s.notes] })),
  addCal: (input) => set((s) => ({ cal: [{
    id: `cal-${crypto.randomUUID().slice(0, 6)}`,
    ...input
  }, ...s.cal] })),
  addDoc: (input) => set((s) => ({ docs: [{
    id: `doc-${crypto.randomUUID().slice(0, 6)}`,
    excerpt: input.body.slice(0, 140),
    receivedAt: (new Date()).toISOString(),
    page: "—",
    ...input
  }, ...s.docs] })),
  setReportStatus: (kind, id, status) => set((s) => {
    if (kind === "slip") return { slips: s.slips.map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
    if (kind === "offer") return { offers: (s.offers ?? []).map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
    if (kind === "tf") return { tfs: s.tfs.map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
    if (kind === "ent") return { ents: s.ents.map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
    if (kind === "pack") return { packs: s.packs.map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
    return { ksReports: s.ksReports.map((x) => x.id === id ? {
      ...x,
      status
    } : x) };
  }),
  patchReport: (kind, id, patch) => {
    set((s) => {
      const mix = <T extends { id: string }>(rows: T[]) => rows.map((x) => (x.id === id ? ({ ...x, ...patch } as T) : x));
      if (kind === "slip") return { slips: mix(s.slips) };
      if (kind === "offer") return { offers: mix(s.offers ?? []) };
      if (kind === "tf") return { tfs: mix(s.tfs) };
      if (kind === "ent") return { ents: mix(s.ents) };
      if (kind === "pack") return { packs: mix(s.packs) };
      return { ksReports: mix(s.ksReports) };
    });
    const s = get();
    if (kind === "tf") {
      const row = s.tfs.find((x) => x.id === id);
      if (row) {
        holdRow(row.id);
        void import("./sb-live").then((m) => m.publishTf(row));
      }
    } else if (kind === "slip") {
      const row = s.slips.find((x) => x.id === id);
      if (row) {
        holdRow(row.id);
        void import("./sb-live").then((m) => m.publishSlip(row));
      }
    } else if (kind === "offer") {
      const row = (s.offers ?? []).find((x) => x.id === id);
      if (row) {
        holdRow(row.id);
        void import("./sb-live").then((m) => m.publishOffer(row));
      }
    } else if (kind === "ent") {
      const row = s.ents.find((x) => x.id === id);
      if (row) {
        holdRow(row.id);
        void import("./sb-live").then((m) => m.publishEnt(row));
      }
    } else if (kind === "ks") {
      const row = s.ksReports.find((x) => x.id === id);
      if (row) {
        holdRow(row.id);
        emitYard({ kind: "ks", id: row.id, payload: slimKs(row), isNew: false, actorId: get().employeeId ?? row.employeeId ?? "" });
      }
    }
  },
  resetAlex: () => {
    const key = dayKey("emp-alex");
    set((s) => ({
      days: {
        ...s.days,
        [key]: emptyDay("emp-alex")
      },
      toast: "Alex' dag nulstillet."
    }));
  },
  pushEvent: (text) => set((s) => ({ events: [{
    at: (new Date()).toISOString(),
    text
  }, ...s.events].slice(0, 40) })),
  addChat: (input) => {
    const row = {
      id: `ch-${crypto.randomUUID().slice(0, 8)}`,
      at: (new Date()).toISOString(),
      ...input,
      photos: (input.photos ?? []).map((p) => {
        const { dataUrl: _drop, ...rest } = p;
        return rest;
      }),
      files: (input.files ?? []).map((f) => {
        const { dataUrl: _drop, ...rest } = f;
        return rest;
      }),
    };
    const from = get().employees.find((e) => e.id === input.fromId);
    const log = {
      id: `lg-${row.id}`,
      at: row.at,
      kind: "chat" as const,
      employeeId: row.fromId,
      projectId: row.projectId,
      text: `${from?.name ?? "Ansat"}: ${row.translations.da ?? row.original}`
    };
    set((s) => ({
      chats: [row, ...s.chats].slice(0, 400),
      logs: [log, ...s.logs].slice(0, 400),
      events: [{
        at: row.at,
        text: `Chat: ${(row.translations.da ?? row.original).slice(0, 80)}`
      }, ...s.events].slice(0, 40),
      threads: unsavedOnNewMessage(s.threads ?? [], row.threadId),
    }));
    const body = row.translations.da ?? row.original;
    if (from && isCrewRole(from.role) && goesToMaster(row.to, get().employees) && isMaterialNeed(body)) {
      get().addNeed({
        chatId: row.id,
        projectId: row.projectId,
        fromId: row.fromId,
        keywords: scanBehov(body),
        text: body,
      });
    }
    const chatNote = noticeForChat(row, get().employees, get().assignments);
    if (chatNote) get().pushNotice(chatNote);
    emitYard({ kind: "chat", id: row.id, payload: slimChat(row), isNew: true, actorId: row.fromId });
    return row;
  },
  patchChat: (id, patch) => {
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    const row = get().chats.find((c) => c.id === id);
    if (row) emitYard({ kind: "chat", id, payload: slimChat(row), isNew: false, actorId: get().employeeId ?? row.fromId });
  },
  saveChatThread: (messageId) => {
    const thread = get().ensureChatThread(messageId);
    if (!thread) return null;
    const saved = { ...thread, savedAt: thread.savedAt ?? new Date().toISOString() };
    set((s) => ({
      threads: (s.threads ?? []).map((t) => (t.id === saved.id ? saved : t)),
      toast: "Gemt chat",
    }));
    return saved;
  },
  ensureChatThread: (messageId) => {
    const msg = get().chats.find((c) => c.id === messageId);
    if (!msg) return null;
    const existing = get().threads ?? [];
    if (msg.threadId) {
      const hit = existing.find((t) => t.id === msg.threadId);
      if (hit) return hit;
      const thread = {
        id: msg.threadId,
        title: (msg.translations.da ?? msg.original).slice(0, 72),
        rootId: msg.id,
        projectId: msg.projectId,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ threads: [thread, ...(s.threads ?? [])] }));
      return thread;
    }
    const thread = {
      id: `thr-${crypto.randomUUID().slice(0, 8)}`,
      title: (msg.translations.da ?? msg.original).slice(0, 72),
      rootId: msg.id,
      projectId: msg.projectId,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      threads: [thread, ...(s.threads ?? [])],
      chats: s.chats.map((c) => (c.id === msg.id ? { ...c, threadId: thread.id } : c)),
    }));
    return thread;
  },
  addLog: (input) => set((s) => ({ logs: [{
    id: `lg-${crypto.randomUUID().slice(0, 6)}`,
    at: (new Date()).toISOString(),
    ...input
  }, ...s.logs].slice(0, 400) })),
  updatePhoto: (employeeId, photoId, patch) => {
    const key = dayKey(employeeId);
    set((s) => {
      const cur = s.days[key];
      if (!cur) return s;
      return { days: {
        ...s.days,
        [key]: {
          ...cur,
          photos: cur.photos.map((p) => p.id === photoId ? {
            ...p,
            ...patch
          } : p)
        }
      } };
    });
  },
  assignPhotoPoint: (employeeId, photoId, point) => {
    get().updatePhoto(employeeId, photoId, {
      point,
      recognized: "plan",
      masterAssigned: true
    });
  },
  setAdminFolder: (id) => set({ adminFolderId: id }),
  patchPhoto: (photoId, patch) => set((s) => {
    const days = { ...s.days };
    for (const [k, d] of Object.entries(days)) if (d.photos.some((p) => p.id === photoId)) days[k] = {
      ...d,
      photos: d.photos.map((p) => p.id === photoId ? {
        ...p,
        ...patch
      } : p)
    };
    return {
      days,
      drivePhotos: s.drivePhotos.map((p) => p.id === photoId ? {
        ...p,
        ...patch
      } : p)
    };
  }),
  upsertDrivePhotos: (photos) => set((s) => {
    const byId = new Map(s.drivePhotos.map((p) => [p.id, p]));
    for (const p of photos) {
      const prev = byId.get(p.id);
      if (prev?.masterAssigned || prev?.overrideNote) byId.set(p.id, {
        ...p,
        point: prev.point,
        floor: prev.floor || p.floor,
        room: prev.room || p.room,
        recognized: prev.recognized,
        masterAssigned: prev.masterAssigned,
        overrideNote: prev.overrideNote,
        workerNote: prev.workerNote ?? p.workerNote
      });
      else byId.set(p.id, {
        ...prev,
        ...p,
        dataUrl: p.driveFileId || prev?.driveFileId ? "" : p.dataUrl || prev?.dataUrl || "",
      });
    }
    return { drivePhotos: [...byId.values()] };
  }),
  markChatSeen: (employeeId) => set((s) => ({ chatSeenAt: {
    ...s.chatSeenAt,
    [employeeId]: (new Date()).toISOString()
  } })),
  markThreadSeen: (employeeId, threadId) => set((s) => ({
    threadSeenAt: {
      ...(s.threadSeenAt ?? {}),
      [`${employeeId}::${threadId}`]: new Date().toISOString(),
    },
  })),
  markBoardPileSeen: (employeeId, pile) => set((s) => ({
    boardSeenAt: {
      ...(s.boardSeenAt ?? {}),
      [`${employeeId}::${pile}`]: new Date().toISOString(),
    },
  })),
  pushNotice: (row) => {
    set((s) => {
      const notices = s.notices ?? [];
      if (notices.some((n) => n.id === row.id || (n.kind === row.kind && n.refId === row.refId && n.kind !== "todo-done"))) return s;
      return { notices: [row, ...notices].slice(0, 80) };
    });
    const me = get().employeeId;
    if (me && row.toIds.includes(me) && row.fromId !== me) flashBrowser(row.title, row.body);
  },
  markNoticeRead: (id, employeeId) => set((s) => ({
    notices: (s.notices ?? []).map((n) => n.id === id && !n.readBy.includes(employeeId) ? { ...n, readBy: [...n.readBy, employeeId] } : n),
  })),
  markNoticesRead: (employeeId) => set((s) => ({
    notices: (s.notices ?? []).map((n) => n.toIds.includes(employeeId) && !n.readBy.includes(employeeId) ? { ...n, readBy: [...n.readBy, employeeId] } : n),
  })),
  setOpenMa: (id) => set({ openMaId: id }),
  setOpenChatWith: (id, projectId) =>
    set({
      openChatWith: id,
      ...(projectId ? { openChatJobId: projectId } : {}),
    }),
  setOpenOnSitePick: (on) => set({ openOnSitePick: on }),
  addFieldItems: (items) => set((s) => ({ fieldItems: [...items, ...s.fieldItems].slice(0, 400) })),
  patchFieldItem: (id, patch) => set((s) => ({ fieldItems: s.fieldItems.map((f) => f.id === id ? {
    ...f,
    ...patch
  } : f) })),
  classifyFieldItem: (id, classifiedAs, masterId) => {
    const item = get().fieldItems.find((f) => f.id === id);
    if (!item) return {};
    const at = (new Date()).toISOString();
    let result: { reportId?: string; reportNumber?: string } = {};
    if (classifiedAs === "materials") {
      get().addIssue({
        employeeId: item.employeeId,
        projectId: item.projectId,
        kind: "materials",
        body: item.note || item.name,
        urgent: false,
        orderDraft: item.note
      });
      result = { reportId: get().issues[0]?.id };
    } else if (classifiedAs === "extra") {
      const slip = get().addSlip({
        projectId: item.projectId,
        title: (item.note || item.name).slice(0, 48),
        location: item.projectName,
        body: item.note || item.name,
        masterSolution: "Kladde.",
        customerPrice: "0 kr.",
        hoursEst: 1,
        materialsEst: "—",
        photoIds: item.dataUrl ? [item.id] : []
      });
      result = {
        reportId: slip.id,
        reportNumber: slip.number
      };
    } else if (classifiedAs === "tf") {
      const tf = get().addTf({
        projectId: item.projectId,
        question: item.note || item.name,
        photoIds: item.dataUrl ? [item.id] : []
      });
      result = {
        reportId: tf.id,
        reportNumber: tf.number
      };
    } else {
      const ent = get().addEnt({
        projectId: item.projectId,
        title: (item.note || item.name).slice(0, 48),
        location: item.projectName,
        body: item.note || item.name,
        noteHe: "—",
        photoIds: item.dataUrl ? [item.id] : []
      });
      result = {
        reportId: ent.id,
        reportNumber: ent.number
      };
    }
    set((s) => ({ fieldItems: s.fieldItems.map((f) => f.id === id ? {
      ...f,
      status: "classified" as const,
      classifiedAs,
      classifiedAt: at,
      classifiedBy: masterId,
      reportId: result.reportId
    } : f) }));
    return result;
  },
  classifyChat: (id, classifiedAs, masterId) => {
    const msg = get().chats.find((c) => c.id === id);
    if (!msg) return {};
    const note = msg.translations.da ?? msg.original;
    const job = get().projects.find((p) => p.id === msg.projectId);
    let result: { reportId?: string; reportNumber?: string; needId?: string } = {};
    const tid = msg.threadId;
    const bunch = tid ? get().chats.filter((c) => c.threadId === tid || c.id === msg.id) : [msg];
    const seen = new Set<string>();
    const threadPhotos = bunch.flatMap((c) => c.photos ?? []).filter((ph) => {
      const key = ph.driveFileId || ph.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const items: FieldItem[] = threadPhotos.map((ph) => {
      return {
        id: ph.id,
        projectId: msg.projectId,
        projectName: job?.name ?? "",
        employeeId: msg.fromId,
        employeeName: get().employees.find((e) => e.id === msg.fromId)?.name ?? "",
        kind: "photo" as const,
        name: ph.name ?? "foto",
        mimeType: "image/jpeg",
        dataUrl: ph.dataUrl,
        driveFileId: ph.driveFileId,
        note,
        takenAt: msg.at,
        status: "inbox" as const
      };
    });
    if (items.length) get().addFieldItems(items);
    if (classifiedAs === "materials") {
      get().addIssue({
        employeeId: msg.fromId,
        projectId: msg.projectId,
        kind: "materials",
        body: note,
        urgent: false,
        orderDraft: note
      });
      if ((isMaterialNeed(note) || scanBehov(note).length) && !(get().needs ?? []).some((n) => n.chatId === msg.id && n.status === "need")) {
        get().addNeed({
          chatId: msg.id,
          projectId: msg.projectId,
          fromId: msg.fromId,
          keywords: scanBehov(note).length ? scanBehov(note) : ["mørtel"],
          text: note,
        });
      }
      const need = (get().needs ?? []).find((n) => n.chatId === msg.id && n.status === "need") ?? get().addNeed({
        chatId: msg.id,
        projectId: msg.projectId,
        fromId: msg.fromId,
        keywords: scanBehov(note).length ? scanBehov(note) : ["mørtel"],
        text: note,
      });
      result = { reportId: need.id, needId: need.id };
    } else if (classifiedAs === "extra") {
      const slip = get().addSlip({
        projectId: msg.projectId,
        title: note.slice(0, 48),
        location: job?.name ?? "",
        body: note,
        masterSolution: "Kladde.",
        customerPrice: "0 kr.",
        hoursEst: 1,
        materialsEst: "—",
        photoIds: items.map((x) => x.id),
        fromChatId: msg.id,
      });
      result = {
        reportId: slip.id,
        reportNumber: slip.number
      };
    } else if (classifiedAs === "tf") {
      const tf = get().addTf({
        projectId: msg.projectId,
        question: note,
        photoIds: items.map((x) => x.id),
        fromChatId: msg.id,
      });
      result = {
        reportId: tf.id,
        reportNumber: tf.number
      };
    } else if (classifiedAs === "ks") {
      const ks = get().addKsReport(msg.projectId, "div", {
        deviations: note,
        task: note.slice(0, 48),
        photoIds: items.map((x) => x.id),
        fromChatId: msg.id,
      });
      result = {
        reportId: ks.id,
        reportNumber: ks.number
      };
    } else if (classifiedAs === "todo") {
      const created = get().addTodo({
        projectId: msg.projectId,
        assigneeId: msg.fromId,
        assigneeIds: [msg.fromId],
        title: note.slice(0, 80),
        due: copenhagenDate(),
        body: note,
        photoFileIds: threadPhotos.map((p) => p.driveFileId).filter((id): id is string => Boolean(id)),
        original: msg.original,
        sourceLang: msg.sourceLang,
        translations: msg.translations,
        fromChatId: msg.id,
      });
      result = { reportId: created.id };
    } else {
      const ent = get().addEnt({
        projectId: msg.projectId,
        title: note.slice(0, 48),
        location: job?.name ?? "",
        body: note,
        noteHe: "—",
        photoIds: items.map((x) => x.id),
        fromChatId: msg.id,
      });
      result = {
        reportId: ent.id,
        reportNumber: ent.number
      };
    }
    const at = (new Date()).toISOString();
    set((s) => ({ chats: s.chats.map((c) => c.id === id ? {
      ...c,
      classifiedAs,
      classifiedAt: at
    } : c) }));
    const updated = get().chats.find((c) => c.id === id);
    if (updated) emitYard({ kind: "chat", id, payload: slimChat(updated), isNew: false, actorId: masterId });
    return result;
  },
  attachFieldToReport: (kind, reportId, fieldIds) => set((s) => {
    const merge = (ids: string[]) => [...new Set([...ids, ...fieldIds])];
    if (kind === "slip") return { slips: s.slips.map((x) => x.id === reportId ? {
      ...x,
      photoIds: merge(x.photoIds)
    } : x) };
    if (kind === "offer") return { offers: (s.offers ?? []).map((x) => x.id === reportId ? {
      ...x,
      photoIds: merge(x.photoIds)
    } : x) };
    if (kind === "tf") return { tfs: s.tfs.map((x) => x.id === reportId ? {
      ...x,
      photoIds: merge(x.photoIds)
    } : x) };
    return { ents: s.ents.map((x) => x.id === reportId ? {
      ...x,
      photoIds: merge(x.photoIds)
    } : x) };
  }),
  setInboxFolder: (projectId, folderId) => set((s) => ({ inboxFolders: {
    ...s.inboxFolders,
    [projectId]: folderId
  } })),
  setDriveMap: (projectId, map) => {
    rememberDrive(projectId, map);
    set((s) => ({
      driveMaps: {
        ...s.driveMaps,
        [projectId]: map,
      },
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, udbudFolderId: map.udbud || p.udbudFolderId, driveRootId: map.root || p.driveRootId }
          : p,
      ),
    }));
  },
} as YardState),
    {
      name: PERSIST_NAME,
  version: 50,
  storage: createJSONStorage(() => yardStorage()),
  partialize: (s) => ({
    employeeId: s.employeeId,
    langOverride: s.langOverride,
    employees: s.employees,
    projects: s.projects,
    assignments: s.assignments,
    days: Object.fromEntries(Object.entries(s.days).map(([k, d]) => [k, {
      ...d,
      photos: (d.photos ?? []).map(slimUrl)
    }])),
    issues: s.issues,
    slips: liveRows(s.slips),
    offers: liveRows(s.offers ?? []),
    tfs: liveRows(s.tfs),
    ents: liveRows(s.ents),
    packs: s.packs,
    ksReports: liveRows(s.ksReports),
    docs: s.docs,
    todos: s.todos,
    problems: s.problems ?? [],
    notes: s.notes,
    cal: s.cal,
    plans: s.plans ?? [],
    chats: (s.chats ?? []).map((c) => ({
      ...c,
      photos: (c.photos ?? []).map((p) => ({ ...p, dataUrl: undefined })),
      files: (c.files ?? []).map((f) => ({ ...f, dataUrl: undefined })),
    })),
    threads: s.threads ?? [],
    logs: (s.logs ?? []).slice(0, 80),
    needs: s.needs ?? [],
    orders: s.orders ?? [],
    receipts: s.receipts ?? [],
    suppliers: s.suppliers ?? [],
    fieldItems: liveRows(s.fieldItems).map(slimUrl),
    inboxFolders: s.inboxFolders,
    driveMaps: s.driveMaps,
    chatSeenAt: s.chatSeenAt,
    threadSeenAt: s.threadSeenAt ?? {},
    boardSeenAt: s.boardSeenAt ?? {},
    notices: s.notices ?? [],
    adminFolderId: s.adminFolderId,
    serial: s.serial
  }),
  migrate: (persisted: unknown) => {
    const fresh = {
      employeeId: null,
      langOverride: null,
      toast: null,
      employees: EMPLOYEES,
      projects: PROJECTS,
      assignments: ASSIGNMENTS,
      days: seedDays(),
      issues: SEED_ISSUES,
      slips: SEED_SLIPS,
      offers: [] as Offer[],
      tfs: SEED_TFS,
      ents: SEED_ENTS,
      packs: SEED_PACKS,
      ksReports: SEED_KS_REPORTS,
      docs: SEED_DOCS,
      todos: [],
      problems: [],
      notes: SEED_NOTES,
      cal: SEED_CAL,
      plans: SEED_PLANS,
      pings: [],
      queue: [],
      events: seedEvents(),
      chats: [],
      threads: [] as ChatThread[],
      logs: SEED_LOGS,
      needs: [],
      orders: [],
      receipts: [],
      suppliers: [] as Supplier[],
      drivePhotos: seedDrivePhotos(),
      fieldItems: SEED_FIELD_ITEMS,
      inboxFolders: {},
      driveMaps: {},
      chatSeenAt: {},
      threadSeenAt: {},
      boardSeenAt: {},
      notices: [] as Notice[],
      openMaId: null as string | null,
      openChatWith: null as string | null,
      openChatJobId: null as string | null,
      openOnSitePick: false,
      adminFolderId: "",
      serial: {
        as: 6,
        tb: 1,
        tf: 7,
        er: 1,
        ks: 5,
        fb: 1,
        mo: 1
      }
    };
    if (!persisted || typeof persisted !== "object") return fresh;
    const prev = persisted as Record<string, unknown>;
    const next = {
      ...fresh,
      ...prev
    };
    if (!Array.isArray(next.plans)) next.plans = SEED_PLANS;
    if (!Array.isArray(next.notices)) next.notices = [];
    if (!Array.isArray(next.problems)) next.problems = [];
    if (!Array.isArray(next.projects) || !next.projects.length) next.projects = PROJECTS;
    if (!Array.isArray(next.assignments)) next.assignments = ASSIGNMENTS;
    if (!Array.isArray(next.employees) || !next.employees.length) next.employees = EMPLOYEES;
    if (!Array.isArray(next.suppliers)) next.suppliers = [];
    ensureBotWeek37(next);
    mergeAliasJobs(next);
    ensureMastersOnJobs(next);
    if (Array.isArray(next.ksReports)) next.ksReports = liveRows(next.ksReports);
    if (Array.isArray(next.slips)) next.slips = liveRows(next.slips);
    if (!Array.isArray(next.offers)) next.offers = [];
    else next.offers = liveRows(next.offers);
    if (Array.isArray(next.ents)) next.ents = liveRows(next.ents);
    if (Array.isArray(next.tfs)) next.tfs = liveRows(next.tfs);
    if (Array.isArray(next.fieldItems)) next.fieldItems = liveRows(next.fieldItems);
    if (Array.isArray(next.drivePhotos)) next.drivePhotos = liveRows(next.drivePhotos);
    if (Array.isArray(next.docs) && !next.docs.some((d) => d.id === "doc-islev-mur")) next.docs = [...SEED_DOCS.filter((d) => d.id.startsWith("doc-islev")), ...next.docs];
    if (Array.isArray(next.todos)) next.todos = next.todos.filter((td) => td.id !== "td-lang-ion");
    if (!next.threadSeenAt || typeof next.threadSeenAt !== "object") next.threadSeenAt = {};
    if (!next.boardSeenAt || typeof next.boardSeenAt !== "object") next.boardSeenAt = {};
    if (Array.isArray(next.chats)) next.chats = next.chats.filter((c) => c.id !== "ch-lang-ion" && c.id !== "ch-lang-osvaldo" && c.id !== "ch-mat-ion");
    if (!Array.isArray(next.needs)) next.needs = [];
    if (!Array.isArray(next.orders)) next.orders = [];
    if (!Array.isArray(next.receipts)) next.receipts = [];
    if (next.serial && typeof next.serial === "object" && next.serial !== null && !("mo" in next.serial)) {
      next.serial = Object.assign({}, next.serial, { mo: 1 });
    }
    if (next.serial && typeof next.serial === "object" && next.serial !== null && !("tb" in next.serial)) {
      next.serial = Object.assign({}, next.serial, { tb: 1 });
    }
    if (Array.isArray(next.needs)) next.needs = next.needs.filter((n) => n.id !== "nd-mat-ion" && n.chatId !== "ch-mat-ion");
    if (Array.isArray(next.projects)) {
      next.projects = next.projects.map((p) => ensureProjectHandover(p, PROJECTS.find((s) => s.id === p.id)));
    }
    return next;
  },
  onRehydrateStorage: () => (state) => {
    if (!state) return;
    if (!Array.isArray(state.threads)) state.threads = [];
    if (!state.threadSeenAt || typeof state.threadSeenAt !== "object") state.threadSeenAt = {};
    if (!state.boardSeenAt || typeof state.boardSeenAt !== "object") state.boardSeenAt = {};
    if (!Array.isArray(state.notices)) state.notices = [];
    if (!Array.isArray(state.plans)) state.plans = SEED_PLANS;
    if (!Array.isArray(state.problems)) state.problems = [];
    if (!Array.isArray(state.employees) || !state.employees.length) state.employees = EMPLOYEES;
    else {
      const seedPin = new Map(EMPLOYEES.map((e) => [e.id, e.pin]));
      state.employees = state.employees.map((e) => {
        const pin = String(e.pin ?? "").replace(/\D/g, "");
        if (pin.length === 4) return e;
        const fallback = seedPin.get(e.id);
        return fallback ? { ...e, pin: fallback } : e;
      });
    }
    const liveCrew = loadCrew();
    if (liveCrew.length) {
      const byId = new Map(state.employees.map((e) => [e.id, e]));
      for (const e of liveCrew) {
        if (!e?.id) continue;
        const prev = byId.get(e.id);
        byId.set(e.id, prev ? { ...prev, ...e } : e);
      }
      state.employees = [...byId.values()];
    }
    void import("./crew-live").then((m) => m.saveCrew(state.employees));
    if (!state.days || typeof state.days !== "object") state.days = seedDays();
    if (!Array.isArray(state.tfs)) state.tfs = SEED_TFS;
    if (!state.drivePhotos?.length) state.drivePhotos = seedDrivePhotos();
    if (Array.isArray(state.projects) && Array.isArray(state.assignments) && Array.isArray(state.plans)) {
      ensureBotWeek37(state);
      mergeAliasJobs(state);
      ensureMastersOnJobs(state);
    }
    if (Array.isArray(state.ksReports)) state.ksReports = liveRows(state.ksReports);
    if (Array.isArray(state.slips)) state.slips = liveRows(state.slips);
    if (!Array.isArray(state.offers)) state.offers = [];
    else state.offers = liveRows(state.offers);
    if (Array.isArray(state.ents)) state.ents = liveRows(state.ents);
    if (Array.isArray(state.tfs)) state.tfs = liveRows(state.tfs);
    if (Array.isArray(state.fieldItems)) state.fieldItems = liveRows(state.fieldItems);
    if (Array.isArray(state.drivePhotos)) state.drivePhotos = liveRows(state.drivePhotos);
    if (Array.isArray(state.docs) && !state.docs.some((d) => d.id === "doc-islev-mur")) state.docs = [...SEED_DOCS.filter((d) => d.id.startsWith("doc-islev")), ...state.docs];
    if (Array.isArray(state.todos)) state.todos = state.todos.filter((td) => td.id !== "td-lang-ion");
    if (Array.isArray(state.chats)) state.chats = state.chats.filter((c) => c.id !== "ch-lang-ion" && c.id !== "ch-lang-osvaldo" && c.id !== "ch-mat-ion");
    if (!Array.isArray(state.needs)) state.needs = [];
    if (!Array.isArray(state.orders)) state.orders = [];
    if (!Array.isArray(state.receipts)) state.receipts = [];
    if (state.serial && typeof state.serial === "object" && !("mo" in state.serial)) {
      state.serial = Object.assign({}, state.serial, { mo: 1 });
    }
    if (state.serial && typeof state.serial === "object" && !("tb" in state.serial)) {
      state.serial = Object.assign({}, state.serial, { tb: 1 });
    }
    if (Array.isArray(state.needs)) state.needs = state.needs.filter((n) => n.id !== "nd-mat-ion" && n.chatId !== "ch-mat-ion");
    if (Array.isArray(state.projects)) {
      state.projects = state.projects.map((p) => ensureProjectHandover(p, PROJECTS.find((s) => s.id === p.id)));
    }
    if (state.driveMaps) for (const [id, map] of Object.entries(state.driveMaps)) rememberDrive(id, map);
    try {
      const who = readDeviceUser();
      const id = liveSessionId || (who && !isLoggedOut() ? who.id : null);
      if (id) state.employeeId = id;
    } catch {
      if (liveSessionId) state.employeeId = liveSessionId;
    }
    queueSoftrHydrate();
    releasePersistPush();
  }
    },
  ),
);

try {
  if (typeof window !== "undefined") {
    const kick = () => {
      queueSoftrHydrate();
      releasePersistPush();
    };
    if (useYard.persist.hasHydrated()) kick();
    else useYard.persist.onFinishHydration(kick);
  }
} catch {
  /* */
}

export function useSessionEmployee() {
  return useYard((s) => {
    let id = s.employeeId || liveSessionId;
    if (!id && typeof window !== "undefined" && !isLoggedOut()) {
      id = readDeviceUser()?.id ?? null;
    }
    if (!id) return null;
    return s.employees.find((e) => e.id === id) ?? loadCrew().find((e) => e.id === id) ?? EMPLOYEES.find((e) => e.id === id) ?? null;
  });
}
export function todayLog(employeeId: string, days: Record<string, DayLog>) {
  return days[dayKey(employeeId)] ?? emptyDay(employeeId);
}
export function payrollReady(day: DayLog) {
  if (!day.checkInAt || !day.checkOutAt) return false;
  if (day.status === "exported") return false;
  return true;
}
export function visibleProjects(employeeId: string, role: Role, projects: Project[], assignments: Assignment[]) {
  if (isMasterRole(role)) return projects;
  const ids = new Set(assignments.filter((a) => a.employeeId === employeeId).map((a) => a.projectId));
  return projects.filter((p) => ids.has(p.id));
}
export function activeAssigned(employeeId: string, role: Role, projects: Project[], assignments: Assignment[]) {
  return visibleProjects(employeeId, role, projects, assignments).filter((p) => p.status === "active");
}
export function lookupProject(id: string) {
  const cid = canonicalProjectId(id);
  return useYard.getState().projects.find((p) => p.id === cid) ?? projectById(cid);
}

export { emptyDay };
export { hoursWorked, dayKey } from "./seed";
