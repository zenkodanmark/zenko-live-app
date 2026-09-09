export type SagPngName =
  | "todo"
  | "ma"
  | "ud"
  | "ks"
  | "tf"
  | "as"
  | "er"
  | "aflevering"
  | "udfoersel"
  | "plads"
  | "erfaring"
  | "dags";

export type TabPngName = "tavle" | "sager" | "folk" | "rapporter" | "chat" | "plan" | "mig" | "todo" | "ks" | "idag";

export type ActionPngName =
  | "sagerPlus"
  | "sagerPencil"
  | "chatPlus"
  | "maPlus"
  | "ksPlus"
  | "tfPlus"
  | "erPlus"
  | "todoPlus"
  | "udPlus"
  | "asPlus"
  | "close"
  | "onSite"
  | "dayEnd"
  | "camCompact"
  | "video"
  | "mic"
  | "robot"
  | "send"
  | "fileDoc"
  | "gallery"
  | "back";

const V = "?v=2";
const AV = "?v=2";

const SAG_SRC: Record<SagPngName, string> = {
  todo: `/icons/sag/todo.png?v=4`,
  ma: `/icons/sag/ma.png${V}`,
  ud: `/icons/sag/ud.png${V}`,
  ks: `/icons/sag/ks.png${V}`,
  tf: `/icons/sag/tf.png?v=4`,
  as: `/icons/sag/as.png${V}`,
  er: `/icons/sag/er.png${V}`,
  aflevering: `/icons/sag/aflevering.png?v=3`,
  udfoersel: `/icons/sag/udfoersel.png${V}`,
  plads: `/icons/sag/pladsfiler.png${V}`,
  erfaring: `/icons/sag/erfaring.png${V}`,
  dags: `/icons/sag/dagsrapport.png${V}`,
};

const TAB_SRC: Record<TabPngName, string> = {
  tavle: `/icons/nav/tavle.png${V}`,
  sager: `/icons/nav/sager.png${V}`,
  folk: `/icons/nav/folk.png${V}`,
  rapporter: `/icons/nav/rapporter.png${V}`,
  chat: `/icons/nav/chat.png${V}`,
  plan: `/icons/nav/plan.png${V}`,
  mig: `/icons/nav/mig.png${V}`,
  todo: `/icons/sag/todo.png?v=4`,
  ks: `/icons/sag/ks.png${V}`,
  idag: `/icons/nav/idag.png?v=2`,
};

const ACTION_SRC: Record<ActionPngName, string> = {
  sagerPlus: `/icons/action/sager-plus.png${AV}`,
  sagerPencil: `/icons/action/sager-pencil.png?v=1`,
  chatPlus: `/icons/action/chat-plus.png${AV}`,
  maPlus: `/icons/action/ma-plus.png${AV}`,
  ksPlus: `/icons/action/ks-plus.png${AV}`,
  tfPlus: `/icons/action/tf-plus.png${AV}`,
  erPlus: `/icons/action/er-plus.png${AV}`,
  todoPlus: `/icons/action/todo-plus.png${AV}`,
  udPlus: `/icons/action/ud-plus.png${AV}`,
  asPlus: `/icons/action/as-plus.png${AV}`,
  close: `/icons/action/close.png${AV}`,
  onSite: `/icons/action/paa-plads.png?v=3`,
  dayEnd: `/icons/action/afslut.png?v=3`,
  camCompact: `/icons/action/camera-compact.png?v=2`,
  video: `/icons/action/video.png?v=1`,
  mic: `/icons/action/mic.png?v=1`,
  robot: `/icons/action/robot.png?v=1`,
  send: `/icons/action/send.png?v=1`,
  fileDoc: `/icons/action/file-doc.png?v=1`,
  gallery: `/icons/action/gallery.png?v=1`,
  back: `/icons/action/back.png?v=1`,
};

export function SagPng({ name, px }: { name: SagPngName; px: number }) {
  return (
    <img src={SAG_SRC[name]} alt="" width={px} height={px} className="max-w-none shrink-0 object-contain" draggable={false} />
  );
}

export function TabPng({ name, px = 30 }: { name: TabPngName; px?: number }) {
  return (
    <img src={TAB_SRC[name]} alt="" width={px} height={px} className="max-w-none shrink-0 object-contain" draggable={false} style={{ filter: "none" }} />
  );
}

export function ActionPng({ name, px }: { name: ActionPngName; px: number }) {
  return (
    <img src={ACTION_SRC[name]} alt="" width={px} height={px} className="max-w-none shrink-0 object-contain" draggable={false} />
  );
}

export function sagPngForList(kind: "todo" | "material" | "ud" | "ks" | "tf" | "slip" | "offer" | "ent"): SagPngName {
  if (kind === "material") return "ma";
  if (kind === "slip" || kind === "offer") return "as";
  if (kind === "ent") return "er";
  return kind;
}

export function plusForList(kind: "todo" | "material" | "ud" | "ks" | "tf" | "slip" | "offer" | "ent"): ActionPngName {
  if (kind === "material") return "maPlus";
  if (kind === "ks") return "ksPlus";
  if (kind === "tf") return "tfPlus";
  if (kind === "ent") return "erPlus";
  if (kind === "todo") return "todoPlus";
  if (kind === "ud") return "udPlus";
  return "asPlus";
}

export function sagPngForPile(pile: "todo" | "ent" | "tf" | "extra" | "offer" | "ks" | "materials"): SagPngName {
  if (pile === "materials") return "ma";
  if (pile === "extra" || pile === "offer") return "as";
  if (pile === "ent") return "er";
  return pile;
}

export function PlusBtn({
  name,
  onClick,
  label,
  testId,
  px = 52,
}: {
  name: ActionPngName;
  onClick: () => void;
  label: string;
  testId?: string;
  px?: number;
}) {
  return (
    <button type="button" aria-label={label} data-testid={testId} onClick={onClick} className="inline-flex shrink-0 items-center justify-center">
      <ActionPng name={name} px={px} />
    </button>
  );
}

export function CloseX({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label || "Luk"}
      data-testid="close-x"
      onClick={onClick}
      className="ml-auto inline-flex size-11 shrink-0 items-center justify-center"
    >
      <ActionPng name="close" px={44} />
    </button>
  );
}

export function BackArrow({
  onClick,
  href,
  label,
}: {
  onClick?: () => void;
  href?: string;
  label?: string;
}) {
  const img = <ActionPng name="back" px={44} />;
  const cls = "inline-flex size-11 shrink-0 items-center justify-center";
  if (href) {
    return (
      <a href={href} aria-label={label || "Tilbage"} className={cls} data-testid="back-arrow">
        {img}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label || "Tilbage"} data-testid="back-arrow" onClick={onClick} className={cls}>
      {img}
    </button>
  );
}

export function PlusRound({
  onClick,
  label,
  testId,
  px = 44,
}: {
  onClick: () => void;
  label: string;
  testId?: string;
  px?: number;
}) {
  const size = Math.max(44, px);
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex shrink-0 items-center justify-center rounded-full shadow-card"
      style={{ background: "#c45c3e", width: size, height: size, minWidth: 44, minHeight: 44, color: "#fff" }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
