import type {
  Assignment,
  ChatMessage,
  ChatTarget,
  DayLog,
  Employee,
  Entrepreneur,
  FieldItem,
  Issue,
  KsReport,
  LedelseStatus,
  MaterialNeed,
  MaterialOrder,
  MaterialReceipt,
  Notice,
  PlanBlock,
  Project,
  Slip,
  Tf,
  Todo,
} from "./types";

function str(v: unknown, fallback = "") {
  return v == null ? fallback : String(v);
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(v: unknown) {
  return Boolean(v);
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function iso(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  return s || null;
}

function ledelseOf(v: unknown): { ledelseStatus: LedelseStatus } | Record<string, never> {
  const s = str(v);
  if (s === "med_til_ledelse" || s === "skjult") return { ledelseStatus: s };
  return {};
}

export function empToRow(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    language: e.language,
    pin: e.pin ?? "",
    initials: e.initials ?? "",
    payroll_no: e.payrollNo ?? null,
    phone: e.phone ?? null,
    profile_file_id: e.profileFileId ?? null,
  };
}
export function empFromRow(r: Record<string, unknown>): Employee {
  return {
    id: str(r.id),
    name: str(r.name),
    role: r.role as Employee["role"],
    language: r.language as Employee["language"],
    pin: str(r.pin),
    initials: str(r.initials),
    payrollNo: str(r.payroll_no) || undefined,
    phone: str(r.phone) || undefined,
    profileFileId: str(r.profile_file_id) || undefined,
  };
}

export function projectToRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    address: p.address ?? "",
    lat: p.lat,
    lng: p.lng,
    radius_m: p.radiusM,
    brief: p.brief ?? "",
    huddle: p.huddle ?? "",
    next_task: p.nextTask ?? "",
    status: p.status,
    customer: p.customer ?? null,
    created_by: p.createdBy ?? null,
    udbud_folder_id: p.udbudFolderId ?? null,
    drive_root_id: p.driveRootId ?? null,
    source: p.source ?? null,
    ks_type: p.ksType ?? null,
    trade: p.trade ?? null,
    period: p.period ?? null,
    quality_manager: p.qualityManager ?? null,
    handed_over_at: p.handedOverAt ?? null,
    archived_at: p.archivedAt ?? null,
    reopen_reason: p.reopenReason ?? null,
    reopen_at: p.reopenAt ?? null,
    ledelse_pin: p.ledelsePin ?? null,
  };
}
export function projectFromRow(r: Record<string, unknown>): Project {
  return {
    id: str(r.id),
    name: str(r.name),
    address: str(r.address),
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
    radiusM: Number(r.radius_m) || 160,
    brief: str(r.brief),
    huddle: str(r.huddle),
    nextTask: str(r.next_task),
    udbudFolderId: str(r.udbud_folder_id),
    driveRootId: str(r.drive_root_id) || undefined,
    status: (r.status as Project["status"]) || "active",
    createdBy: str(r.created_by),
    source: str(r.source) || undefined,
    customer: str(r.customer) || undefined,
    ksType: (r.ks_type as Project["ksType"]) || undefined,
    trade: str(r.trade) || undefined,
    period: str(r.period) || undefined,
    qualityManager: str(r.quality_manager) || undefined,
    handedOverAt: str(r.handed_over_at) || undefined,
    archivedAt: str(r.archived_at) || undefined,
    reopenReason: (r.reopen_reason as Project["reopenReason"]) || undefined,
    reopenAt: str(r.reopen_at) || undefined,
    ...( /^\d{4}$/.test(str(r.ledelse_pin)) ? { ledelsePin: str(r.ledelse_pin) } : {}),
  };
}

export function assignmentToRow(a: Assignment) {
  return { employee_id: a.employeeId, project_id: a.projectId };
}
export function assignmentFromRow(r: Record<string, unknown>): Assignment {
  return { employeeId: str(r.employee_id), projectId: str(r.project_id) };
}

export function todoToRow(t: Todo) {
  return {
    id: t.id,
    project_id: t.projectId,
    assignee_id: t.assigneeId,
    assignee_ids: t.assigneeIds ?? [],
    from_id: t.fromId,
    title: t.title,
    body: t.body,
    kind: t.kind ?? null,
    due: t.due ?? null,
    done: Boolean(t.done),
    done_at: t.doneAt ?? null,
    done_by_id: t.doneById ?? null,
    needs_photo: t.needsPhoto ?? null,
    translations: t.translations ?? {},
    drive_file_id: t.driveFileId ?? null,
    photo_file_ids: t.photoFileIds ?? [],
    lat: t.lat ?? null,
    lng: t.lng ?? null,
    gps_label: t.gpsLabel ?? null,
    source_lang: t.sourceLang ?? null,
    original: t.original ?? null,
    created_at: t.createdAt,
    reply: t.reply ?? null,
    history: t.history ?? [],
    done_photo_file_ids: t.donePhotoFileIds ?? [],
    done_gps_label: t.doneGpsLabel ?? null,
    done_lat: t.doneLat ?? null,
    done_lng: t.doneLng ?? null,
    order_id: t.orderId ?? null,
    from_chat_id: t.fromChatId ?? null,
    ledelse_status: t.ledelseStatus ?? null,
  };
}
export function todoFromRow(r: Record<string, unknown>): Todo {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    assigneeId: str(r.assignee_id),
    assigneeIds: arr<string>(r.assignee_ids),
    fromId: str(r.from_id),
    title: str(r.title),
    body: str(r.body),
    kind: (r.kind as Todo["kind"]) || undefined,
    due: str(r.due) || undefined,
    done: bool(r.done),
    doneAt: iso(r.done_at) || undefined,
    doneById: str(r.done_by_id) || undefined,
    needsPhoto: r.needs_photo == null ? undefined : bool(r.needs_photo),
    translations: (r.translations as Todo["translations"]) ?? undefined,
    driveFileId: str(r.drive_file_id) || undefined,
    photoFileIds: arr<string>(r.photo_file_ids),
    lat: num(r.lat),
    lng: num(r.lng),
    gpsLabel: str(r.gps_label) || undefined,
    sourceLang: (r.source_lang as Todo["sourceLang"]) || undefined,
    original: str(r.original) || undefined,
    createdAt: iso(r.created_at) || "",
    reply: str(r.reply) || undefined,
    history: arr(r.history),
    donePhotoFileIds: arr<string>(r.done_photo_file_ids),
    doneGpsLabel: str(r.done_gps_label) || undefined,
    doneLat: num(r.done_lat),
    doneLng: num(r.done_lng),
    orderId: str(r.order_id) || undefined,
    fromChatId: str(r.from_chat_id) || undefined,
    ...ledelseOf(r.ledelse_status),
  };
}

function targetToCols(to: ChatTarget) {
  if (to.kind === "employee") return { to_kind: "employee", to_id: to.id, to_ids: [] as string[] };
  if (to.kind === "employees") return { to_kind: "employees", to_id: to.ids[0] ?? "", to_ids: to.ids };
  if (to.kind === "crew") return { to_kind: "crew", to_id: to.projectId, to_ids: [] as string[] };
  return { to_kind: "masters", to_id: "", to_ids: [] as string[] };
}
function targetFromCols(r: Record<string, unknown>): ChatTarget {
  const kind = str(r.to_kind);
  if (kind === "masters") return { kind: "masters" };
  if (kind === "crew") return { kind: "crew", projectId: str(r.to_id) };
  if (kind === "employees") return { kind: "employees", ids: arr<string>(r.to_ids) };
  return { kind: "employee", id: str(r.to_id) };
}

export function chatToRow(c: ChatMessage) {
  return {
    id: c.id,
    at: c.at,
    from_id: c.fromId,
    ...targetToCols(c.to),
    project_id: c.projectId,
    source_lang: c.sourceLang,
    original: c.original,
    translations: c.translations ?? {},
    via_voice: c.viaVoice ?? null,
    thread_id: c.threadId ?? null,
    photos: (c.photos ?? []).map((p) => ({ ...p, dataUrl: p.driveFileId ? "" : p.dataUrl })),
    files: (c.files ?? []).map((f) => ({ ...f, dataUrl: f.driveFileId ? "" : f.dataUrl })),
    classified_as: c.classifiedAs ?? null,
    classified_at: c.classifiedAt ?? null,
    handled_at: c.handledAt ?? null,
    hidden_by: c.hiddenBy ?? [],
    from_agent: c.fromAgent ?? null,
    archived_at: c.archivedAt ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    gps_label: c.gpsLabel ?? null,
  };
}
export function chatFromRow(r: Record<string, unknown>): ChatMessage {
  return {
    id: str(r.id),
    at: iso(r.at) || "",
    fromId: str(r.from_id),
    to: targetFromCols(r),
    projectId: str(r.project_id),
    sourceLang: (r.source_lang as ChatMessage["sourceLang"]) || "da",
    original: str(r.original),
    translations: (r.translations as ChatMessage["translations"]) ?? {},
    viaVoice: r.via_voice == null ? undefined : bool(r.via_voice),
    threadId: str(r.thread_id) || undefined,
    photos: arr(r.photos),
    files: arr(r.files),
    classifiedAs: (r.classified_as as ChatMessage["classifiedAs"]) || undefined,
    classifiedAt: iso(r.classified_at) || undefined,
    handledAt: iso(r.handled_at) || undefined,
    hiddenBy: arr<string>(r.hidden_by),
    fromAgent: r.from_agent == null ? undefined : bool(r.from_agent),
    archivedAt: iso(r.archived_at) || undefined,
    lat: num(r.lat),
    lng: num(r.lng),
    gpsLabel: str(r.gps_label) || undefined,
  };
}

export function ksToRow(k: KsReport) {
  return {
    id: k.id,
    number: k.number,
    project_id: k.projectId,
    point: k.point,
    created_at: k.createdAt,
    status: k.status,
    deviations: k.deviations ?? null,
    approved: k.approved ?? null,
    employee_name: k.employeeName ?? null,
    employee_id: k.employeeId ?? null,
    crew: k.crew ?? null,
    process: k.process ?? null,
    trade: k.trade ?? null,
    company: k.company ?? null,
    photo_ids: k.photoIds ?? [],
    location: k.location ?? null,
    task: k.task ?? null,
    from_chat_id: k.fromChatId ?? null,
    kunde_status: k.kundeStatus ?? null,
    trashed_at: k.trashedAt ?? null,
    qc_scope: k.qcScope ?? null,
    qc_method: k.qcMethod ?? null,
    source: k.source ?? null,
  };
}
export function ksFromRow(r: Record<string, unknown>): KsReport {
  return {
    id: str(r.id),
    number: str(r.number),
    projectId: str(r.project_id),
    point: str(r.point),
    createdAt: iso(r.created_at) || "",
    status: (r.status as KsReport["status"]) || "draft",
    deviations: str(r.deviations) || undefined,
    approved: r.approved == null ? undefined : bool(r.approved),
    employeeName: str(r.employee_name) || undefined,
    employeeId: str(r.employee_id) || undefined,
    crew: str(r.crew) || undefined,
    process: str(r.process) || undefined,
    trade: str(r.trade) || undefined,
    company: str(r.company) || undefined,
    photoIds: arr<string>(r.photo_ids),
    location: str(r.location) || undefined,
    task: str(r.task) || undefined,
    fromChatId: str(r.from_chat_id) || undefined,
    kundeStatus: (r.kunde_status as KsReport["kundeStatus"]) || undefined,
    trashedAt: iso(r.trashed_at) || undefined,
    qcScope: str(r.qc_scope) || undefined,
    qcMethod: str(r.qc_method) || undefined,
    source: str(r.source) || undefined,
    ...(Array.isArray(r.ledelse_replies) ? { ledelseReplies: arr(r.ledelse_replies) } : {}),
  };
}

export function dayToRow(d: DayLog, id?: string) {
  return {
    id: id || `${d.employeeId}:${d.date}`,
    employee_id: d.employeeId,
    date: d.date,
    project_id: d.projectId,
    check_in_at: d.checkInAt,
    check_out_at: d.checkOutAt,
    pause_started_at: d.pauseStartedAt,
    pause_minutes: d.pauseMinutes ?? 0,
    photos: (d.photos ?? []).map((p) => ({ ...p, dataUrl: p.driveFileId ? "" : p.dataUrl })),
    gps_inside: d.gpsInside,
    check_in_gps: d.checkInGps,
    check_out_gps: d.checkOutGps,
    demo_gps: d.demoGps,
    status: d.status,
    work_note: d.workNote ?? null,
    source: d.source ?? null,
    payroll_minutes: d.payrollMinutes ?? null,
    exception_reason: d.exceptionReason ?? null,
    exception_note: d.exceptionNote ?? null,
    double_booked: d.doubleBooked ?? null,
    payroll_no: d.payrollNo ?? null,
  };
}
export function dayFromRow(r: Record<string, unknown>): DayLog {
  return {
    employeeId: str(r.employee_id),
    date: str(r.date),
    projectId: str(r.project_id),
    checkInAt: iso(r.check_in_at),
    checkOutAt: iso(r.check_out_at),
    pauseStartedAt: iso(r.pause_started_at),
    pauseMinutes: Number(r.pause_minutes) || 0,
    photos: arr(r.photos),
    gpsInside: bool(r.gps_inside),
    checkInGps: (r.check_in_gps as DayLog["checkInGps"]) ?? null,
    checkOutGps: (r.check_out_gps as DayLog["checkOutGps"]) ?? null,
    demoGps: bool(r.demo_gps),
    status: (r.status as DayLog["status"]) || "open",
    workNote: str(r.work_note) || undefined,
    source: str(r.source) || undefined,
    payrollMinutes: r.payroll_minutes == null ? undefined : Number(r.payroll_minutes),
    exceptionReason: (r.exception_reason as DayLog["exceptionReason"]) || undefined,
    exceptionNote: str(r.exception_note) || undefined,
    doubleBooked: r.double_booked == null ? undefined : bool(r.double_booked),
    payrollNo: str(r.payroll_no) || undefined,
  };
}

export function needToRow(n: MaterialNeed) {
  return {
    id: n.id,
    chat_id: n.chatId ?? null,
    project_id: n.projectId,
    from_id: n.fromId,
    keywords: n.keywords ?? [],
    text: n.text,
    at: n.at,
    status: n.status,
  };
}
export function needFromRow(r: Record<string, unknown>): MaterialNeed {
  return {
    id: str(r.id),
    chatId: str(r.chat_id) || undefined,
    projectId: str(r.project_id),
    fromId: str(r.from_id),
    keywords: arr<string>(r.keywords),
    text: str(r.text),
    at: iso(r.at) || "",
    status: (r.status as MaterialNeed["status"]) || "need",
  };
}

export function orderToRow(o: MaterialOrder) {
  return {
    id: o.id,
    number: o.number,
    project_id: o.projectId,
    need_id: o.needId ?? null,
    chat_id: o.chatId ?? null,
    from_id: o.fromId,
    product: o.product,
    spec: o.spec,
    qty: o.qty,
    unit: o.unit,
    in_udbud: o.inUdbud,
    cite: o.cite,
    file: o.file ?? null,
    delivery_address: o.deliveryAddress,
    expected_date: o.expectedDate,
    supplier_email: o.supplierEmail,
    supplier_name: o.supplierName,
    nab: o.nab,
    customer: o.customer,
    cvr: o.cvr,
    ordered_by: o.orderedBy,
    ordered_at: o.orderedAt,
    status: o.status,
    mail_mode: o.mailMode ?? null,
    drive_file_id: o.driveFileId ?? null,
    todo_id: o.todoId ?? null,
    ks_report_id: o.ksReportId ?? null,
    warning: o.warning ?? null,
    lines: o.lines ?? [],
    phone: o.phone ?? null,
    driver_note: o.driverNote ?? null,
    thread: o.thread ?? [],
    share_status: o.shareStatus ?? null,
    public_path: o.publicPath ?? null,
    contact_employee_id: o.contactEmployeeId ?? null,
  };
}
export function orderFromRow(r: Record<string, unknown>): MaterialOrder {
  return {
    id: str(r.id),
    number: str(r.number),
    projectId: str(r.project_id),
    needId: str(r.need_id) || undefined,
    chatId: str(r.chat_id) || undefined,
    fromId: str(r.from_id),
    product: str(r.product),
    spec: str(r.spec),
    qty: Number(r.qty) || 0,
    unit: str(r.unit),
    inUdbud: bool(r.in_udbud),
    cite: str(r.cite),
    file: str(r.file) || undefined,
    deliveryAddress: str(r.delivery_address),
    expectedDate: str(r.expected_date),
    supplierEmail: str(r.supplier_email),
    supplierName: str(r.supplier_name),
    nab: str(r.nab),
    customer: str(r.customer),
    cvr: str(r.cvr),
    orderedBy: str(r.ordered_by),
    orderedAt: iso(r.ordered_at) || "",
    status: (r.status as MaterialOrder["status"]) || "draft",
    mailMode: (r.mail_mode as MaterialOrder["mailMode"]) || undefined,
    driveFileId: str(r.drive_file_id) || undefined,
    todoId: str(r.todo_id) || undefined,
    ksReportId: str(r.ks_report_id) || undefined,
    warning: str(r.warning) || undefined,
    lines: arr(r.lines),
    phone: str(r.phone) || undefined,
    driverNote: str(r.driver_note) || undefined,
    thread: arr(r.thread),
    shareStatus: (r.share_status as MaterialOrder["shareStatus"]) || undefined,
    publicPath: str(r.public_path) || undefined,
    contactEmployeeId: str(r.contact_employee_id) || undefined,
  };
}

export function tfToRow(t: Tf) {
  return {
    id: t.id,
    number: t.number,
    project_id: t.projectId,
    title: t.title ?? null,
    question: t.question,
    created_at: t.createdAt,
    status: t.status,
    answered: t.answered,
    answer: t.answer ?? null,
    answered_at: t.answeredAt ?? null,
    answered_by: t.answeredBy ?? null,
    photo_ids: t.photoIds ?? [],
    from_chat_id: t.fromChatId ?? null,
    ledelse_status: t.ledelseStatus ?? null,
    ledelse_replies: t.ledelseReplies ?? [],
    kunde_status: t.kundeStatus ?? null,
    trashed_at: t.trashedAt ?? null,
    share_token: t.shareToken ?? null,
    source: t.source ?? null,
    updated_at: t.updatedAt || new Date().toISOString(),
  };
}
export function tfFromRow(r: Record<string, unknown>): Tf {
  return {
    id: str(r.id),
    number: str(r.number),
    projectId: str(r.project_id),
    title: str(r.title) || undefined,
    question: str(r.question),
    createdAt: iso(r.created_at) || "",
    status: (r.status as Tf["status"]) || "draft",
    answered: bool(r.answered),
    answer: str(r.answer) || undefined,
    answeredAt: iso(r.answered_at) || undefined,
    answeredBy: str(r.answered_by) || undefined,
    photoIds: arr<string>(r.photo_ids),
    fromChatId: str(r.from_chat_id) || undefined,
    ...ledelseOf(r.ledelse_status),
    ledelseReplies: arr(r.ledelse_replies),
    kundeStatus: (r.kunde_status as Tf["kundeStatus"]) || undefined,
    trashedAt: iso(r.trashed_at) || undefined,
    shareToken: str(r.share_token) || undefined,
    source: str(r.source) || undefined,
    updatedAt: iso(r.updated_at) || undefined,
  };
}

export function slipToRow(s: Slip) {
  return {
    id: s.id,
    number: s.number,
    project_id: s.projectId,
    title: s.title,
    location: s.location,
    body: s.body,
    master_solution: s.masterSolution,
    customer_price: s.customerPrice,
    hours_est: s.hoursEst,
    materials_est: s.materialsEst,
    photo_ids: s.photoIds ?? [],
    created_at: s.createdAt,
    status: s.status,
    forwarded: s.forwarded,
    paid: s.paid,
    from_chat_id: s.fromChatId ?? null,
    ledelse_status: s.ledelseStatus ?? null,
    ledelse_replies: s.ledelseReplies ?? [],
    kunde_status: s.kundeStatus ?? null,
    trashed_at: s.trashedAt ?? null,
    source: s.source ?? null,
    updated_at: s.updatedAt || new Date().toISOString(),
  };
}
export function slipFromRow(r: Record<string, unknown>): Slip {
  return {
    id: str(r.id),
    number: str(r.number),
    projectId: str(r.project_id),
    title: str(r.title),
    location: str(r.location),
    body: str(r.body),
    masterSolution: str(r.master_solution),
    customerPrice: str(r.customer_price),
    hoursEst: Number(r.hours_est) || 0,
    materialsEst: str(r.materials_est),
    photoIds: arr<string>(r.photo_ids),
    createdAt: iso(r.created_at) || "",
    status: (r.status as Slip["status"]) || "draft",
    forwarded: bool(r.forwarded),
    paid: bool(r.paid),
    fromChatId: str(r.from_chat_id) || undefined,
    ...ledelseOf(r.ledelse_status),
    ledelseReplies: arr(r.ledelse_replies),
    kundeStatus: (r.kunde_status as Slip["kundeStatus"]) || undefined,
    trashedAt: iso(r.trashed_at) || undefined,
    source: str(r.source) || undefined,
    updatedAt: iso(r.updated_at) || undefined,
  };
}

export function entToRow(e: Entrepreneur) {
  return {
    id: e.id,
    number: e.number,
    project_id: e.projectId,
    title: e.title,
    body: e.body,
    location: e.location ?? null,
    note_he: e.noteHe ?? null,
    created_at: e.createdAt,
    status: e.status,
    photo_ids: e.photoIds ?? [],
    from_chat_id: e.fromChatId ?? null,
    ledelse_status: e.ledelseStatus ?? null,
    ledelse_replies: e.ledelseReplies ?? [],
    materials_est: e.materialsEst ?? null,
    hours_est: e.hoursEst ?? null,
    trashed_at: e.trashedAt ?? null,
    source: e.source ?? null,
    updated_at: e.updatedAt || new Date().toISOString(),
  };
}
export function entFromRow(r: Record<string, unknown>): Entrepreneur {
  return {
    id: str(r.id),
    number: str(r.number),
    projectId: str(r.project_id),
    title: str(r.title),
    body: str(r.body),
    location: str(r.location) || undefined,
    noteHe: str(r.note_he) || undefined,
    createdAt: iso(r.created_at) || "",
    status: (r.status as Entrepreneur["status"]) || "draft",
    photoIds: arr<string>(r.photo_ids),
    fromChatId: str(r.from_chat_id) || undefined,
    ...ledelseOf(r.ledelse_status),
    ledelseReplies: arr(r.ledelse_replies),
    materialsEst: str(r.materials_est) || undefined,
    hoursEst: r.hours_est == null ? undefined : Number(r.hours_est),
    trashedAt: iso(r.trashed_at) || undefined,
    source: str(r.source) || undefined,
    updatedAt: iso(r.updated_at) || undefined,
  };
}

export function issueToRow(i: Issue) {
  return {
    id: i.id,
    employee_id: i.employeeId,
    project_id: i.projectId,
    kind: i.kind,
    body: i.body,
    urgent: i.urgent ?? null,
    order_draft: i.orderDraft ?? null,
    created_at: i.createdAt,
    status: i.status ?? null,
  };
}
export function issueFromRow(r: Record<string, unknown>): Issue {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    projectId: str(r.project_id),
    kind: r.kind as Issue["kind"],
    body: str(r.body),
    urgent: r.urgent == null ? undefined : bool(r.urgent),
    orderDraft: str(r.order_draft) || undefined,
    createdAt: iso(r.created_at) || "",
    status: (r.status as Issue["status"]) || undefined,
  };
}

export function planToRow(p: PlanBlock) {
  const days = p.days?.length ? p.days : undefined;
  return {
    id: p.id,
    employee_id: p.employeeId,
    employee_ids: p.employeeIds ?? [],
    project_id: p.projectId,
    title: p.title,
    start_at: p.start,
    end_at: p.end,
    created_at: p.createdAt,
    created_by: p.createdBy,
    source: p.source ?? null,
    place: p.place ?? null,
    comment: p.comment ?? null,
    days: days ?? [],
    todo_id: p.todoId ?? null,
    updated_at: p.updatedAt ?? new Date().toISOString(),
  };
}
export function planFromRow(r: Record<string, unknown>): PlanBlock {
  const days = arr<string>(r.days).filter(Boolean);
  const todoId = str(r.todo_id);
  const comment = str(r.comment);
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    employeeIds: arr<string>(r.employee_ids),
    projectId: str(r.project_id),
    title: str(r.title),
    start: (iso(r.start_at) || "").slice(0, 10),
    end: (iso(r.end_at) || "").slice(0, 10),
    createdAt: iso(r.created_at) || "",
    createdBy: str(r.created_by),
    source: str(r.source) || undefined,
    place: str(r.place) || undefined,
    ...(comment ? { comment } : {}),
    ...(days.length ? { days } : {}),
    ...(todoId ? { todoId } : {}),
    updatedAt: iso(r.updated_at) || undefined,
  };
}

export function noticeToRow(n: Notice) {
  return {
    id: n.id,
    at: n.at,
    kind: n.kind,
    title: n.title,
    body: n.body,
    to_ids: n.toIds ?? [],
    from_id: n.fromId,
    ref_id: n.refId,
    project_id: n.projectId ?? null,
    read_by: n.readBy ?? [],
  };
}
export function noticeFromRow(r: Record<string, unknown>): Notice {
  return {
    id: str(r.id),
    at: iso(r.at) || "",
    kind: r.kind as Notice["kind"],
    title: str(r.title),
    body: str(r.body),
    toIds: arr<string>(r.to_ids),
    fromId: str(r.from_id),
    refId: str(r.ref_id),
    projectId: str(r.project_id) || undefined,
    readBy: arr<string>(r.read_by),
  };
}

export function fieldToRow(f: FieldItem) {
  return {
    id: f.id,
    project_id: f.projectId,
    project_name: f.projectName,
    employee_id: f.employeeId,
    employee_name: f.employeeName,
    kind: f.kind,
    name: f.name,
    mime_type: f.mimeType,
    note: f.note ?? null,
    taken_at: f.takenAt,
    status: f.status,
    classified_as: f.classifiedAs ?? null,
    classified_at: f.classifiedAt ?? null,
    classified_by: f.classifiedBy ?? null,
    report_id: f.reportId ?? null,
    drive_file_id: f.driveFileId ?? null,
    drive_url: f.driveUrl ?? null,
    drive_folder_id: f.driveFolderId ?? null,
    gps_label: f.gpsLabel ?? null,
    lat: f.lat ?? null,
    lng: f.lng ?? null,
    bytes: f.bytes ?? null,
  };
}
export function fieldFromRow(r: Record<string, unknown>): FieldItem {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    projectName: str(r.project_name),
    employeeId: str(r.employee_id),
    employeeName: str(r.employee_name),
    kind: r.kind as FieldItem["kind"],
    name: str(r.name),
    mimeType: str(r.mime_type),
    note: str(r.note) || undefined,
    takenAt: iso(r.taken_at) || "",
    status: (r.status as FieldItem["status"]) || "inbox",
    classifiedAs: (r.classified_as as FieldItem["classifiedAs"]) || undefined,
    classifiedAt: iso(r.classified_at) || undefined,
    classifiedBy: str(r.classified_by) || undefined,
    reportId: str(r.report_id) || undefined,
    driveFileId: str(r.drive_file_id) || undefined,
    driveUrl: str(r.drive_url) || undefined,
    driveFolderId: str(r.drive_folder_id) || undefined,
    gpsLabel: str(r.gps_label) || undefined,
    lat: num(r.lat),
    lng: num(r.lng),
    bytes: r.bytes == null ? undefined : Number(r.bytes),
  };
}

export function receiptToRow(x: MaterialReceipt) {
  return {
    id: x.id,
    order_id: x.orderId,
    project_id: x.projectId,
    employee_id: x.employeeId,
    source: x.source,
    photo_file_ids: x.photoFileIds ?? [],
    at: x.at,
    gps_label: x.gpsLabel ?? null,
    lat: x.lat ?? null,
    lng: x.lng ?? null,
    note: x.note ?? null,
    guessed_product: x.guessedProduct ?? null,
    guessed_qty: x.guessedQty ?? null,
    match: x.match,
    warning: x.warning ?? null,
    drive_file_id: x.driveFileId ?? null,
  };
}
export function receiptFromRow(r: Record<string, unknown>): MaterialReceipt {
  return {
    id: str(r.id),
    orderId: str(r.order_id),
    projectId: str(r.project_id),
    employeeId: str(r.employee_id),
    source: r.source as MaterialReceipt["source"],
    photoFileIds: arr<string>(r.photo_file_ids),
    at: iso(r.at) || "",
    gpsLabel: str(r.gps_label) || undefined,
    lat: num(r.lat),
    lng: num(r.lng),
    note: str(r.note) || undefined,
    guessedProduct: str(r.guessed_product) || undefined,
    guessedQty: num(r.guessed_qty),
    match: (r.match as MaterialReceipt["match"]) || "unknown",
    warning: str(r.warning) || undefined,
    driveFileId: str(r.drive_file_id) || undefined,
  };
}

export const offerToRow = slipToRow;
export const offerFromRow = slipFromRow;

