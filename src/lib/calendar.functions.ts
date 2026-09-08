import { createServerFn } from "@tanstack/react-start";
import { ConnectorType, GoogleCalendarTools } from "@/lib/app-data";
import type { CalEvent } from "./types";

export type CalLive = {
  ok: true;
  events: CalEvent[];
  live: boolean;
  loginRequired?: boolean;
  loginUrl?: string;
  error?: string;
};

function race<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function isoFrom(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return raw;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return isoFrom(o.dateTime ?? o.date_time ?? o.date ?? o.start ?? o.dateTimeUTC);
  }
  return "";
}

function kindOf(title: string): CalEvent["kind"] {
  const s = title.toLowerCase();
  if (/levering|delivery|material/.test(s)) return "delivery";
  if (/frist|deadline|aflever/.test(s)) return "deadline";
  return "meeting";
}

function pushEvent(out: CalEvent[], o: Record<string, unknown>) {
  const title = String(o.summary ?? o.title ?? o.name ?? "").trim();
  const at = isoFrom(o.start ?? o.start_time ?? o.startTime ?? o.dateTime ?? o.begin ?? o.at);
  if (!title || !at) return;
  const id = String(o.id ?? o.event_id ?? o.iCalUID ?? `${title}-${at}`).slice(0, 80);
  if (out.some((e) => e.id === id || (e.title === title && e.at.slice(0, 16) === at.slice(0, 16)))) return;
  const where = String(o.location ?? o.where ?? o.place ?? "").trim();
  out.push({
    id: `gcal-${id}`,
    projectId: "",
    title,
    at,
    kind: kindOf(title),
    where: where || undefined,
    source: "google",
  });
}

function eventsFrom(data: unknown): CalEvent[] {
  const out: CalEvent[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 7 || out.length >= 120) return;
    if (Array.isArray(node)) {
      for (const row of node) visit(row, depth + 1);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.summary || o.title || o.start || o.start_time || o.startTime) pushEvent(out, o);
    for (const key of ["events", "items", "results", "data", "value"]) {
      if (key in o) visit(o[key], depth + 1);
    }
  };
  visit(data, 0);
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

const cache = new Map<string, { at: number; value: CalLive }>();

export const listYardCalendar = createServerFn({ method: "POST" })
  .validator((input: { from: string; to: string; query?: string }) => input)
  .handler(async ({ data }): Promise<CalLive> => {
    const key = `${data.from}:${data.to}:all`;
    const hit = cache.get(key);
    if (hit && hit.value.live && Date.now() - hit.at < 60_000) return hit.value;

    const empty: CalLive = { ok: true, events: [], live: false };

    const { callTool } = await import("@/lib/app-data/client.server");
    const opts = { connectorType: ConnectorType.GoogleCalendar };
    const args = {
      time_min: data.from,
      time_max: data.to,
      timeMin: data.from,
      timeMax: data.to,
      max_results: 100,
      maxResults: 100,
      calendar_id: "primary",
      calendarId: "primary",
      single_events: true,
      singleEvents: true,
      order_by: "startTime",
      orderBy: "startTime",
    };

    let listed = await race(
      callTool(GoogleCalendarTools.search, args, opts),
      8000,
      { ok: false as const, data: null, errorMessage: "timeout", loginRequired: false },
    );
    if (!listed.ok && !listed.loginRequired) {
      listed = await race(callTool(GoogleCalendarTools.listEvents, args, opts), 8000, {
        ok: false as const,
        data: null,
        errorMessage: listed.errorMessage ?? "timeout",
        loginRequired: listed.loginRequired,
      });
    }

    if (listed.loginRequired) {
      return { ...empty, loginRequired: true, loginUrl: listed.loginUrl, error: listed.errorMessage };
    }
    if (!listed.ok) {
      return { ...empty, error: listed.errorMessage };
    }
    const live = eventsFrom(listed.data);
    const value: CalLive = { ok: true, events: live, live: true };
    cache.set(key, { at: Date.now(), value });
    return value;
  });
