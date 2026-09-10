export type Lang = "da" | "ro" | "pl" | "uk" | "de" | "en" | "es";
export type Role = "mester" | "svend" | "laerling";
export type IssueKind = "problem" | "materials" | "extra";
export type DayStatus = "open" | "awaiting" | "ready" | "exported";
export type ExceptionReason = "driving" | "materials" | "sick" | "office" | "other";
export type ProjectStatus = "active" | "archived";
export type ReopenReason = "mangler" | "1aar" | "5aar";
export type DocFolder = "meetings" | "invoice" | "comms" | "drawings" | "udbud";
export type ReportKind = "ks" | "tf" | "aftaleseddel" | "entrepreneur" | "fakturabilag" | "dagsrapport";
export type ReportStatus = "draft" | "issued";
export type KundeStatus = "skjult" | "med_til_kunden";
export type LedelseStatus = "skjult" | "med_til_ledelse";
export type LedelseReply = { id: string; text: string; at: string };
export type KsType = "alm" | "ds1140";
export type GpsSource = "device" | "site-fallback" | "exif" | "unknown";
export type LogKind = "chat" | "ks" | "checkin" | "checkout" | "issue" | "todo" | "field";
export type QueueKind = "checkin" | "checkout" | "photo" | "issue" | "field";
export type FieldKind = "photo" | "video" | "file";
export type InboxClass = "todo" | "materials" | "extra" | "tf" | "ent" | "ks";
export type InboxStatus = "inbox" | "classified";
export type PhotoRec = "plan" | "div" | "pending";
export type ChatTarget =
  | { kind: "employee"; id: string }
  | { kind: "employees"; ids: string[] }
  | { kind: "masters" }
  | { kind: "crew"; projectId: string };
export type TodoKind = "task" | "material" | "ks" | "other";
export type NoticeKind = "ks" | "chat" | "todo" | "todo-done" | "ma";

export type Employee = {
  id: string;
  name: string;
  role: Role;
  language: Lang;
  pin: string;
  initials: string;
  payrollNo?: string;
  phone?: string;
  profileFileId?: string;
};

export type Assignment = { employeeId: string; projectId: string };

export type Project = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  brief: string;
  huddle: string;
  nextTask: string;
  udbudFolderId: string;
  driveRootId?: string;
  status: ProjectStatus;
  createdBy: string;
  source?: string;
  customer?: string;
  ksType?: KsType;
  trade?: string;
  period?: string;
  qualityManager?: string;
  handedOverAt?: string;
  archivedAt?: string;
  reopenReason?: ReopenReason;
  reopenAt?: string;
  ledelsePin?: string;
};

export type GpsFix = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  altitudeM?: number | null;
  heading?: number | null;
  speedMps?: number | null;
  at: string;
  source: GpsSource;
};

export type GpsPing = {
  id: string;
  employeeId: string;
  projectId: string;
  at: string;
  lat: number;
  lng: number;
  inside: boolean;
};

export type DayLog = {
  employeeId: string;
  date: string;
  projectId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  pauseStartedAt: string | null;
  pauseMinutes: number;
  photos: KsPhoto[];
  gpsInside: boolean;
  checkInGps: GpsFix | null;
  checkOutGps: GpsFix | null;
  demoGps: boolean;
  status: DayStatus;
  workNote?: string;
  source?: string;
  payrollMinutes?: number;
  exceptionReason?: ExceptionReason;
  exceptionNote?: string;
  doubleBooked?: boolean;
  payrollNo?: string;
};

export type ControlPoint = {
  code: string;
  title: string;
  hint: string;
  qcScope: string;
  method: string;
  criteria: string;
  controlType?: string;
  extent?: string;
  process?: string;
};

export type KsPhoto = {
  id: string;
  dataUrl: string;
  takenAt: string;
  floor: string;
  room: string;
  point: string;
  gpsLabel?: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  gpsSource?: GpsSource;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  originalName?: string;
  mimeType?: string;
  bytes?: number;
  deviceLabel?: string;
  driveFileId?: string;
  driveUrl?: string;
  recognized?: PhotoRec;
  recognitionLabel?: string;
  recognitionNote?: string;
  guessPoint?: string;
  guessLabel?: string;
  masterAssigned?: boolean;
  overrideNote?: string;
  workerNote?: string;
  width?: number;
  height?: number;
};

export type KsReport = {
  id: string;
  number: string;
  projectId: string;
  point: string;
  createdAt: string;
  status: ReportStatus;
  deviations?: string;
  approved?: boolean;
  employeeName?: string;
  employeeId?: string;
  crew?: string;
  process?: string;
  trade?: string;
  company?: string;
  photoIds: string[];
  location?: string;
  task?: string;
  fromChatId?: string;
  kundeStatus?: KundeStatus;
  ledelseStatus?: LedelseStatus;
  trashedAt?: string;
  qcScope?: string;
  qcMethod?: string;
  source?: string;
  ledelseReplies?: LedelseReply[];
};

export type Slip = {
  id: string;
  number: string;
  projectId: string;
  title: string;
  location: string;
  body: string;
  masterSolution: string;
  customerPrice: string;
  hoursEst: number;
  materialsEst: string;
  photoIds: string[];
  createdAt: string;
  status: ReportStatus;
  forwarded: boolean;
  paid: boolean;
  fromChatId?: string;
  ledelseStatus?: LedelseStatus;
  ledelseReplies?: LedelseReply[];
  kundeStatus?: KundeStatus;
  trashedAt?: string;
  source?: string;
  updatedAt?: string;
};

export type Offer = Slip;

export type Tf = {
  id: string;
  number: string;
  projectId: string;
  title?: string;
  question: string;
  createdAt: string;
  status: ReportStatus;
  answered: boolean;
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
  photoIds: string[];
  fromChatId?: string;
  ledelseStatus?: LedelseStatus;
  ledelseReplies?: LedelseReply[];
  kundeStatus?: KundeStatus;
  trashedAt?: string;
  shareToken?: string;
  source?: string;
  updatedAt?: string;
};

export type Entrepreneur = {
  id: string;
  number: string;
  projectId: string;
  title: string;
  body: string;
  location?: string;
  noteHe?: string;
  createdAt: string;
  status: ReportStatus;
  photoIds: string[];
  fromChatId?: string;
  ledelseStatus?: LedelseStatus;
  ledelseReplies?: LedelseReply[];
  materialsEst?: string;
  hoursEst?: number;
  trashedAt?: string;
  source?: string;
  updatedAt?: string;
};

export type InvoicePack = {
  id: string;
  number: string;
  projectId: string;
  title?: string;
  createdAt: string;
  status: ReportStatus;
  slipIds?: string[];
};

export type Issue = {
  id: string;
  employeeId: string;
  projectId: string;
  kind: IssueKind;
  body: string;
  urgent?: boolean;
  orderDraft?: string;
  createdAt: string;
  status?: "open" | "resolved" | "closed";
};

export type DocHit = {
  id: string;
  title: string;
  page: string;
  excerpt: string;
  keywords: string[];
};

export type SiteDoc = {
  id: string;
  projectId: string;
  folder: DocFolder;
  title: string;
  body: string;
  excerpt: string;
  receivedAt: string;
  page: string;
  from?: string;
};

export type MemoryNote = {
  id: string;
  projectId: string;
  body: string;
  createdAt: string;
};

export type CalEvent = {
  id: string;
  title: string;
  at: string;
  kind?: string;
  where?: string;
  source?: string;
  projectId?: string;
};

export type PlanBlock = {
  id: string;
  employeeId: string;
  employeeIds?: string[];
  projectId: string;
  title: string;
  start: string;
  end: string;
  createdAt: string;
  createdBy: string;
  source?: string;
  place?: string;
  comment?: string;
  days?: string[];
  todoId?: string;
  updatedAt?: string;
};

export type FieldItem = {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  kind: FieldKind;
  name: string;
  mimeType: string;
  dataUrl?: string;
  note?: string;
  takenAt: string;
  status: InboxStatus;
  classifiedAs?: InboxClass;
  classifiedAt?: string;
  classifiedBy?: string;
  reportId?: string;
  driveFileId?: string;
  driveUrl?: string;
  driveFolderId?: string;
  gpsLabel?: string;
  lat?: number | null;
  lng?: number | null;
  bytes?: number;
};

export type ChatFile = {
  id: string;
  kind: FieldKind;
  name: string;
  mimeType: string;
  dataUrl?: string;
  driveFileId?: string;
};

export type ChatPhoto = {
  id: string;
  dataUrl?: string;
  name?: string;
  at?: string;
  lat?: number | null;
  lng?: number | null;
  gpsLabel?: string;
  driveFileId?: string;
};

export type ChatMessage = {
  id: string;
  at: string;
  fromId: string;
  to: ChatTarget;
  projectId: string;
  sourceLang: Lang;
  original: string;
  translations: Partial<Record<Lang, string>>;
  viaVoice?: boolean;
  threadId?: string;
  photos?: ChatPhoto[];
  files?: ChatFile[];
  classifiedAs?: InboxClass;
  classifiedAt?: string;
  handledAt?: string;
  hiddenBy?: string[];
  fromAgent?: boolean;
  archivedAt?: string;
  lat?: number | null;
  lng?: number | null;
  gpsLabel?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  rootId: string;
  projectId: string;
  createdAt: string;
  savedAt?: string;
};

export type YardLog = {
  id: string;
  at: string;
  kind: LogKind;
  employeeId: string;
  projectId?: string;
  text: string;
};

export type QueueItem = {
  id: string;
  kind: QueueKind;
  at: string;
  employeeId: string;
  payload?: unknown;
};

export type Notice = {
  id: string;
  at: string;
  kind: NoticeKind;
  title: string;
  body: string;
  toIds: string[];
  fromId: string;
  refId: string;
  projectId?: string;
  readBy: string[];
};

export type Todo = {
  id: string;
  projectId: string;
  assigneeId: string;
  assigneeIds?: string[];
  fromId: string;
  title: string;
  body: string;
  kind?: TodoKind;
  due?: string;
  done: boolean;
  doneAt?: string;
  doneById?: string;
  needsPhoto?: boolean;
  translations?: Partial<Record<Lang, string>>;
  driveFileId?: string;
  photoFileIds?: string[];
  lat?: number | null;
  lng?: number | null;
  gpsLabel?: string;
  sourceLang?: Lang;
  original?: string;
  createdAt: string;
  reply?: string;
  history?: { at: string; text: string }[];
  donePhotoFileIds?: string[];
  doneGpsLabel?: string;
  doneLat?: number | null;
  doneLng?: number | null;
  orderId?: string;
  fromChatId?: string;
  ledelseStatus?: LedelseStatus;
  updatedAt?: string;
};

export type Supplier = { id: string; name: string; email: string };

export type MaterialNeed = {
  id: string;
  chatId?: string;
  projectId: string;
  fromId: string;
  keywords: string[];
  text: string;
  at: string;
  status: "need" | "ordered" | "dismissed";
};

export type MaterialLine = {
  product: string;
  spec: string;
  qty: number;
  unit: string;
  inUdbud: boolean;
  cite?: string;
  productUrl?: string;
  photoFileIds?: string[];
  videoFileIds?: string[];
  checked?: boolean;
  checkedAt?: string;
  checkedBy?: string;
};

export type MaThreadMsg = {
  from: "leverandor" | "mester" | "ansat";
  name: string;
  text: string;
  at: string;
  original?: string;
  sourceLang?: Lang;
  translations?: Partial<Record<Lang, string>>;
};

export type MaShareStatus = "kladde" | "sendt" | "kopieret";

export type MaterialOrder = {
  id: string;
  number: string;
  projectId: string;
  needId?: string;
  chatId?: string;
  fromId: string;
  product: string;
  spec: string;
  qty: number;
  unit: string;
  inUdbud: boolean;
  cite: string;
  file?: string;
  deliveryAddress: string;
  expectedDate: string;
  supplierEmail: string;
  supplierName: string;
  nab: string;
  customer: string;
  cvr: string;
  orderedBy: string;
  orderedAt: string;
  status: "draft" | "sent" | "received" | "mismatch" | "ks";
  mailMode?: "send" | "draft";
  driveFileId?: string;
  todoId?: string;
  ksReportId?: string;
  warning?: string;
  lines?: MaterialLine[];
  phone?: string;
  driverNote?: string;
  thread?: MaThreadMsg[];
  shareStatus?: MaShareStatus;
  publicPath?: string;
  contactEmployeeId?: string;
};

export type MaterialReceipt = {
  id: string;
  orderId: string;
  projectId: string;
  employeeId: string;
  source: "levering" | "afhentet";
  photoFileIds: string[];
  at: string;
  gpsLabel?: string;
  lat?: number | null;
  lng?: number | null;
  note?: string;
  guessedProduct?: string;
  guessedQty?: number | null;
  match: "ok" | "mismatch" | "unknown";
  warning?: string;
  driveFileId?: string;
};
