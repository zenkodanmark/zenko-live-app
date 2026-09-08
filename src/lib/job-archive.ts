import type { Project, ReopenReason } from "./types";

export const REOPEN_REASONS: ReopenReason[] = ["mangler", "1aar", "5aar"];

export function addCalendarYears(isoDate: string, years: number): string {
  const day = isoDate.slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function handoverDate(p: Pick<Project, "handedOverAt" | "archivedAt">): string | null {
  const raw = p.handedOverAt || p.archivedAt;
  return raw ? raw.slice(0, 10) : null;
}

export function oneYearDate(p: Pick<Project, "handedOverAt" | "archivedAt">): string | null {
  const h = handoverDate(p);
  return h ? addCalendarYears(h, 1) : null;
}

export function fiveYearDate(p: Pick<Project, "handedOverAt" | "archivedAt">): string | null {
  const h = handoverDate(p);
  return h ? addCalendarYears(h, 5) : null;
}

export function fmtDaDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** now = overdue or within 14 days. soon = within 90 days. */
export function reviewUrgency(iso: string | null, today = new Date()): "now" | "soon" | "later" | null {
  if (!iso) return null;
  const t = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  const d = new Date(`${today.toISOString().slice(0, 10)}T12:00:00`).getTime();
  const day = 86_400_000;
  if (t <= d + 14 * day) return "now";
  if (t <= d + 90 * day) return "soon";
  return "later";
}

export function applyArchive(p: Project, now = new Date().toISOString()): Project {
  return {
    ...p,
    status: "archived",
    archivedAt: now,
    handedOverAt: p.handedOverAt ?? now.slice(0, 10),
    reopenReason: undefined,
    reopenAt: undefined,
  };
}

export function applyReopen(p: Project, reason: ReopenReason, now = new Date().toISOString()): Project {
  return {
    ...p,
    status: "active",
    reopenReason: reason,
    reopenAt: now,
  };
}

export function ensureProjectHandover(p: Project, seed?: Project): Project {
  if (p.handedOverAt) {
    return p.archivedAt || !seed?.archivedAt ? p : { ...p, archivedAt: p.archivedAt ?? seed.archivedAt };
  }
  const fromSeed = seed?.handedOverAt;
  if (p.status === "archived" || fromSeed) {
    return {
      ...p,
      handedOverAt: fromSeed ?? p.archivedAt?.slice(0, 10),
      archivedAt: p.archivedAt ?? seed?.archivedAt,
    };
  }
  return p;
}
