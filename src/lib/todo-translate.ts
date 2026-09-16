import { asTodoLangCopy, seedTodoTranslations } from "./crew-todo.ts";
import type { Lang, TodoLangCopy, TodoTranslations } from "./types.ts";

const MYMEMORY = "https://api.mymemory.translated.net/get";

export function serverFnsLive() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  if (/github\.io$/i.test(host)) return false;
  return true;
}

export function copyDiffersFromOriginal(copy: TodoLangCopy, original: { title: string; body: string }) {
  const title = (copy.title || "").trim();
  const body = (copy.body || "").trim();
  const ot = original.title.trim();
  const ob = original.body.trim();
  const same = (a: string, b: string) => !a || a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
  return Boolean((title && !same(title, ot)) || (body && !same(body, ob) && !same(body, ot)));
}

function cleanMt(raw: string) {
  return raw.replace(/^MYMEMORY WARNING:[^\n]*\n?/i, "").trim();
}

async function translateText(text: string, from: Lang, to: Lang): Promise<string> {
  const src = text.trim();
  if (!src || from === to) return src;
  const url = `${MYMEMORY}?q=${encodeURIComponent(src.slice(0, 480))}&langpair=${encodeURIComponent(`${from}|${to}`)}`;
  const res = await fetch(url);
  if (!res.ok) return src;
  const json = (await res.json()) as { responseData?: { translatedText?: string } };
  const got = cleanMt(typeof json.responseData?.translatedText === "string" ? json.responseData.translatedText : "");
  return got || src;
}

export async function translateTodoCopyLocal(opts: {
  title: string;
  body: string;
  from: Lang;
  langs: Lang[];
  keepTitle?: boolean;
}): Promise<TodoTranslations> {
  const title = opts.title.trim();
  const body = opts.body.trim() || title;
  const langs = [...new Set((opts.langs.length ? opts.langs : (["da"] as Lang[])).filter(Boolean))];
  const out = seedTodoTranslations({ title, body, from: opts.from, langs, keepTitle: opts.keepTitle });
  const original = { title, body };
  await Promise.all(
    langs.map(async (lang) => {
      if (lang === opts.from) {
        out[lang] = { title, body };
        return;
      }
      try {
        const nextTitle = opts.keepTitle ? title : await translateText(title, opts.from, lang);
        const nextBody = body && body !== title ? await translateText(body, opts.from, lang) : nextTitle;
        const copy = { title: nextTitle || title, body: nextBody || body };
        if (copyDiffersFromOriginal(copy, original) || lang === "da") out[lang] = copy;
        else out[lang] = { title, body };
      } catch {
        out[lang] = { title, body };
      }
    }),
  );
  if (!out.da) out.da = { title, body };
  if (!out[opts.from]) out[opts.from] = { title, body };
  return out;
}

export function mergeTodoTranslations(base: TodoTranslations, extra: TodoTranslations, original: { title: string; body: string }): TodoTranslations {
  const out: TodoTranslations = { ...base };
  for (const [lang, raw] of Object.entries(extra)) {
    const copy = asTodoLangCopy(raw);
    if (!copy.title && !copy.body) continue;
    const prev = asTodoLangCopy(out[lang as Lang]);
    const prefer = copyDiffersFromOriginal(copy, original) ? copy : copyDiffersFromOriginal(prev, original) ? prev : copy;
    out[lang as Lang] = { title: prefer.title || original.title, body: prefer.body || original.body };
  }
  return out;
}
