import { createServerFn } from "@tanstack/react-start";
import { ConnectorType, GmailTools } from "@/lib/app-data";
import { grokChat } from "./grok-chat";
import {
  boardHeadline,
  boardMailQuery,
  briefMailItems,
  mailQueryFor,
  mailSnapshot,
  mailWithinDays,
  packMailItems,
  parseMailDate,
  recentBoardFallback,
  scoreMail,
  type MailItem,
  type MailSnap,
} from "./mail.snapshot";
import { SEED_DOCS, docTokens } from "./seed";

export type MailLive = MailSnap & { loginRequired?: boolean; loginUrl?: string; error?: string; brief?: string };

function fromName(raw: string) {
  const m = raw.match(/^"?([^"<]+)"?\s*</);
  return (m?.[1] ?? raw.replace(/<[^>]+>/g, "")).trim() || raw;
}

function fmtDate(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pushItem(out: MailItem[], o: Record<string, unknown>) {
  const id = String(o.message_id ?? o.messageId ?? o.id ?? o.thread_id ?? o.threadId ?? "");
  const subject = String(o.subject ?? o.title ?? "").trim();
  if (!id || !subject) return;
  if (out.some((x) => x.id === id || x.subject === subject)) return;
  out.push({
    id,
    from: fromName(String(o.from ?? o.sender ?? o.from_name ?? "")),
    subject,
    date: fmtDate(String(o.date ?? o.internalDate ?? o.internal_date ?? o.sent ?? "")),
    snippet: String(o.body_preview ?? o.snippet ?? o.preview ?? o.body ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
  });
}

function itemsFrom(data: unknown): MailItem[] {
  const out: MailItem[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || out.length >= 50) return;
    if (Array.isArray(node)) {
      for (const row of node) visit(row, depth + 1);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.subject || o.message_id || o.snippet || o.body_preview) pushItem(out, o);
    for (const key of ["threads", "messages", "emails", "results", "items", "data"]) {
      if (key in o) visit(o[key], depth + 1);
    }
  };
  visit(data, 0);
  return out;
}

function bodyFromMail(data: unknown): string {
  if (typeof data === "string") return stripHtml(data);
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  for (const k of ["body_text", "bodyText", "plain", "text", "content", "body", "snippet"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 30) return stripHtml(v);
  }
  if (o.payload && typeof o.payload === "object") return bodyFromMail(o.payload);
  if (o.message && typeof o.message === "object") return bodyFromMail(o.message);
  if (o.data && typeof o.data === "object") return bodyFromMail(o.data);
  return "";
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

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

const cache = new Map<string, { at: number; value: MailLive }>();
const bodyCache = new Map<string, { at: number; text: string }>();

export const listSagMail = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; projectName: string }) => input)
  .handler(async ({ data }): Promise<MailLive> => {
    const fallback = mailSnapshot(data.projectId, data.projectName);
    const hit = cache.get(data.projectId);
    if (hit && hit.value.live && Date.now() - hit.at < 60_000) return { ...hit.value, brief: briefMailItems(hit.value.items, data.projectName) };

    const { callTool } = await import("@/lib/app-data/client.server");
    let listed: Awaited<ReturnType<typeof callTool>>;
    try {
      listed = await callTool(
        GmailTools.search,
        { query: mailQueryFor(data.projectId, data.projectName), max_results: 50 },
        { connectorType: ConnectorType.Gmail },
      );
    } catch (e) {
      const items = fallback.items;
      return { ...fallback, live: false, error: e instanceof Error ? e.message : "mail-fejl", brief: briefMailItems(items, data.projectName) };
    }

    if (!listed.ok) {
      return {
        ...fallback,
        live: false,
        loginRequired: listed.loginRequired,
        loginUrl: listed.loginUrl,
        error: listed.errorMessage,
        brief: briefMailItems(fallback.items, data.projectName),
      };
    }
    const items = itemsFrom(listed.data);
    if (!items.length) {
      return { ...fallback, live: false, error: listed.errorMessage, brief: briefMailItems(fallback.items, data.projectName) };
    }
    const value: MailLive = {
      count: items.length,
      headline: items[0]?.subject ?? fallback.headline,
      live: true,
      items,
      brief: briefMailItems(items, data.projectName),
    };
    cache.set(data.projectId, { at: Date.now(), value });
    return value;
  });

async function readMailBodies(items: MailItem[], words: string[]): Promise<Record<string, string>> {
  const ranked = [...items].sort((a, b) => scoreMail(b, words) - scoreMail(a, words)).slice(0, 5);
  const { callTool } = await import("@/lib/app-data/client.server");
  const out: Record<string, string> = {};
  await Promise.all(
    ranked.map(async (m) => {
      const hit = bodyCache.get(m.id);
      if (hit && Date.now() - hit.at < 30 * 60_000) {
        out[m.id] = hit.text;
        return;
      }
      const read = await race(
        callTool(GmailTools.getMessage, { message_id: m.id, id: m.id }, { connectorType: ConnectorType.Gmail }),
        6000,
        { ok: false as const, data: null, errorMessage: "timeout" },
      );
      if (!read.ok) return;
      const text = bodyFromMail(read.data);
      if (text.length > 40) {
        bodyCache.set(m.id, { at: Date.now(), text });
        out[m.id] = text;
      }
    }),
  );
  return out;
}

function meetingsFor(projectId: string) {
  return SEED_DOCS.filter((d) => d.projectId === projectId && (d.folder === "meetings" || d.folder === "comms"))
    .map((d) => `MØDE ${d.title} (${d.from}): ${d.body}`)
    .join("\n");
}

export const askSagMail = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; projectName: string; query: string; history?: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim();
    if (!query) return { ok: true as const, line: null as string | null, used: [] as string[], loginRequired: false as boolean | undefined, loginUrl: undefined as string | undefined };
    const listed = await listSagMail({ data: { projectId: data.projectId, projectName: data.projectName } });
    const words = docTokens(query);
    let bodies: Record<string, string> = {};
    if (listed.live && !listed.loginRequired) {
      try {
        bodies = await readMailBodies(listed.items, words);
      } catch {
        bodies = {};
      }
    }
    const packed = `${packMailItems(listed.items, bodies)}\n${meetingsFor(data.projectId)}`.slice(0, 14000);
    const grok = packed.length > 40
      ? await grokChat({
          system:
            "Du er Zenko Danmarks mail-bot for murermester Ole. Du læser sagens Gmail og byggemøder. Svar på dansk, konkret. Citér afsender og dato. Prioritér LIN (Lars Ingtrup), byggemøder, sikkerhedsmøder, aftalesedler, tilkøb og åbne krav. Hvis mester følger op, husk samtalen. Hvis det ikke står i mailen, sig det ærligt. Ingen indledning.",
          user: `Sag: ${data.projectName}\nSpørgsmål: ${query.slice(0, 600)}\n\nMail og møder:\n${packed}`,
          history: data.history,
          maxTokens: 700,
          timeoutMs: 20000,
        })
      : null;
    if (grok) {
      const used = listed.items
        .filter((m) => scoreMail(m, words) > 0 || grok.toLowerCase().includes(m.subject.slice(0, 18).toLowerCase()))
        .slice(0, 5)
        .map((m) => `${m.date} ${m.from}`);
      return { ok: true as const, line: grok, used, loginRequired: listed.loginRequired, loginUrl: listed.loginUrl };
    }
    const hit = listed.items.find((m) => `${m.subject} ${m.snippet}`.toLowerCase().includes(query.toLowerCase())) ?? listed.items.sort((a, b) => scoreMail(b, words) - scoreMail(a, words))[0];
    return {
      ok: true as const,
      line: hit ? `${hit.date} ${hit.from}: ${hit.subject}. ${hit.snippet}` : briefMailItems(listed.items, data.projectName),
      used: hit ? [`${hit.date} ${hit.from}`] : [],
      loginRequired: listed.loginRequired,
      loginUrl: listed.loginUrl,
    };
  });

export const briefSagMail = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; projectName: string }) => input)
  .handler(async ({ data }) => {
    const listed = await listSagMail({ data: { projectId: data.projectId, projectName: data.projectName } });
    const heuristic = briefMailItems(listed.items, data.projectName);
    const packed = packMailItems(listed.items).slice(0, 10000);
    const grok = packed.length > 80
      ? await grokChat({
          system:
            "Du er Zenko Danmarks mail-bot. Lav et kort dags-overblik til mester på dansk: møder (næste dato), LIN-aftaler, tilkøb/aftalesedler, åbne krav/faktura. Max 8 sætninger. Citér dato og afsender. Ingen indledning.",
          user: `Sag: ${data.projectName}\n\nMail:\n${packed}`,
          maxTokens: 450,
          timeoutMs: 16000,
        })
      : null;
    return {
      ok: true as const,
      line: grok || heuristic,
      live: listed.live,
      loginRequired: listed.loginRequired,
      loginUrl: listed.loginUrl,
      count: listed.items.length,
    };
  });

export const listBoardMail = createServerFn({ method: "POST" })
  .validator((input?: { days?: number; names?: string[] }) => input ?? {})
  .handler(async ({ data }): Promise<MailLive> => {
    const days = Math.max(1, Number(data?.days) || 10);
    const names = [...new Set((data?.names ?? []).map((n) => n.trim()).filter((n) => n.length >= 4))];
    const fallbackItems = recentBoardFallback();
    const fallback: MailLive = {
      count: fallbackItems.length,
      headline: boardHeadline(fallbackItems),
      live: false,
      items: fallbackItems,
      brief: boardHeadline(fallbackItems),
    };
    const hitKey = `board-${days}d-${names.slice().sort().join("|")}`;
    const hit = cache.get(hitKey);
    if (hit && hit.value.live && Date.now() - hit.at < 60_000) {
      return { ...hit.value, brief: hit.value.brief ?? boardHeadline(hit.value.items) };
    }

    const { callTool } = await import("@/lib/app-data/client.server");
    const queries = names.length ? names.map((n) => mailQueryFor("", n)) : [boardMailQuery(names)];
    const uniqueQueries = [...new Set(queries)];
    const batches = await Promise.all(
      uniqueQueries.map(async (query) => {
        try {
          return await callTool(GmailTools.search, { query, max_results: 20 }, { connectorType: ConnectorType.Gmail });
        } catch (e) {
          return { ok: false as const, data: null, errorMessage: e instanceof Error ? e.message : "mail-fejl", loginRequired: false };
        }
      }),
    );

    const login = batches.find((b) => b.loginRequired);
    if (login && batches.every((b) => !b.ok)) {
      return { ...fallback, loginRequired: true, loginUrl: login.loginUrl, error: login.errorMessage };
    }

    const live = batches
      .filter((b) => b.ok)
      .flatMap((b) => itemsFrom(b.data))
      .filter((m) => mailWithinDays(m, days));
    const seen = new Set<string>();
    const items = live
      .filter((m) => {
        const key = m.id || m.subject;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => parseMailDate(b.date).getTime() - parseMailDate(a.date).getTime());
    if (!items.length) {
      return { ...fallback, loginRequired: login?.loginRequired, loginUrl: login?.loginUrl, error: batches.find((b) => !b.ok)?.errorMessage };
    }
    const value: MailLive = {
      count: items.length,
      headline: boardHeadline(items),
      live: true,
      items,
      brief: boardHeadline(items),
    };
    cache.set(hitKey, { at: Date.now(), value });
    return value;
  });

export const sendOrderMail = createServerFn({ method: "POST" })
  .validator((input: { to: string; subject: string; body: string; mode: "send" | "draft" }) => input)
  .handler(async ({ data }) => {
    const { callTool } = await import("@/lib/app-data/client.server");
    const args = {
      to: [data.to],
      recipient: data.to,
      subject: data.subject,
      body: data.body,
      body_text: data.body,
      text: data.body,
    };
    const names =
      data.mode === "send"
        ? ["gmail_send_message", GmailTools.send, "gmail_send"]
        : [GmailTools.draft, "gmail_create_draft", "gmail_save_draft", "gmail_draft"];
    let loginRequired = false;
    let loginUrl: string | undefined;
    let lastError = "";
    for (const name of names) {
      try {
        const res = await callTool(name, args, { connectorType: ConnectorType.Gmail });
        if (res.ok) return { ok: true as const, mode: data.mode, loginRequired: false as boolean | undefined };
        if (res.loginRequired) {
          loginRequired = true;
          loginUrl = res.loginUrl ?? loginUrl;
        }
        lastError = res.errorMessage ?? lastError;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "mail-fejl";
      }
    }
    return {
      ok: false as const,
      mode: data.mode,
      loginRequired,
      loginUrl,
      error: lastError || "Gmail send/kladde ikke tilgængelig — kvittering ligger i Drive.",
    };
  });
