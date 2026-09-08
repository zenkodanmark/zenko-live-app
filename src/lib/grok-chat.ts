export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function grokChat(opts: {
  system: string;
  user: string;
  history?: ChatTurn[];
  maxTokens?: number;
  timeoutMs?: number;
  temperature?: number;
  historyLimit?: number;
}): Promise<string | null> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;
  const limit = opts.historyLimit ?? 6;
  const history = (opts.history ?? [])
    .filter((t) => t.content.trim())
    .slice(-limit)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1600) }));
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.1,
        messages: [{ role: "system", content: opts.system }, ...history, { role: "user", content: opts.user.slice(0, 16000) }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (body.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch {
    return null;
  }
}

export async function grokChatWeb(opts: {
  system: string;
  user: string;
  history?: ChatTurn[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; citations: string[] } | null> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;
  const history = (opts.history ?? [])
    .filter((t) => t.content.trim())
    .slice(-6)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1200) }));
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 28000),
      body: JSON.stringify({
        model: "grok-4.5",
        tools: [{ type: "web_search" }],
        max_output_tokens: opts.maxTokens ?? 700,
        input: [{ role: "system", content: opts.system }, ...history, { role: "user", content: opts.user.slice(0, 14000) }],
      }),
    });
    if (res.ok) {
      const body: unknown = await res.json();
      const text = textFromResponse(body);
      if (text) return { text, citations: citationsFrom(body) };
    }
  } catch {
    /* fall through */
  }
  const plain = await grokChat({
    system: opts.system,
    user: opts.user,
    history: opts.history,
    maxTokens: opts.maxTokens,
    timeoutMs: Math.min(opts.timeoutMs ?? 20000, 20000),
  });
  return plain ? { text: plain, citations: [] } : null;
}

function textFromResponse(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const o = body as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();
  const output = o.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const row of output) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.text === "string") parts.push(r.text);
      const content = r.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c === "string") parts.push(c);
          else if (c && typeof c === "object") {
            const cc = c as Record<string, unknown>;
            const t = cc.text ?? cc.output_text ?? cc.value;
            if (typeof t === "string") parts.push(t);
          }
        }
      }
    }
    const joined = parts.join("\n").trim();
    if (joined) return joined;
  }
  const choices = o.choices as { message?: { content?: string } }[] | undefined;
  return (choices?.[0]?.message?.content ?? "").trim();
}

function citationsFrom(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const o = body as Record<string, unknown>;
  const raw = o.citations ?? o.sources;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (typeof row === "string" && row.trim()) out.push(row.trim());
    else if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      const u = r.url ?? r.uri ?? r.title;
      if (typeof u === "string" && u.trim()) out.push(u.trim());
    }
  }
  return [...new Set(out)].slice(0, 6);
}

export function extractJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const v = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
