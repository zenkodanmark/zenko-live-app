import { translateTodoCopy } from "@/lib/ai.functions";
import { asTodoLangCopy, isJobPlaceTitle, seedTodoTranslations, todoTargetLangs } from "@/lib/crew-todo";
import { pladsPath, uploadPladsBytes } from "@/lib/plads-file";
import { useYard } from "@/lib/store";
import { publishTodo } from "@/lib/todo-live";
import { copyDiffersFromOriginal, mergeTodoTranslations, serverFnsLive, translateTodoCopyLocal } from "@/lib/todo-translate";
import { splitDataUrl } from "@/lib/voice-agent";
import type { Lang, TodoTranslations } from "./types";

export async function uploadDraftsToFolder(opts: {
  projectId: string;
  folderName: string;
  drafts: { dataUrl: string; name: string }[];
}): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, d] of opts.drafts.entries()) {
    const split = splitDataUrl(d.dataUrl);
    if (!split.base64) continue;
    const mime = split.mime || "application/octet-stream";
    const video = mime.startsWith("video/");
    const image = mime.startsWith("image/");
    const name = /\.[a-z0-9]{2,8}$/i.test(d.name)
      ? d.name
      : video
        ? `video-${i + 1}.mp4`
        : image
          ? `foto-${i + 1}.jpg`
          : `fil-${i + 1}`;
    const kind = (opts.folderName || "todo").split("/")[0] || "todo";
    const path = pladsPath(opts.projectId || "plads", kind, name);
    const up = await uploadPladsBytes({
      path,
      contentBase64: split.base64,
      mimeType: mime,
      projectId: opts.projectId,
      kind,
      name,
    });
    if (up.ok && up.fileId) ids.push(up.fileId);
  }
  return ids;
}

export async function uploadTodoPhotos(projectId: string, todoId: string, drafts: { dataUrl: string; name: string }[]) {
  return uploadDraftsToFolder({ projectId: projectId || "personlig", folderName: `todo/${todoId}`, drafts });
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function grokTodoCopy(opts: { title: string; body: string; from: Lang; langs: Lang[]; keepTitle: boolean }): Promise<TodoTranslations | null> {
  if (!serverFnsLive()) return null;
  try {
    const res = await withTimeout(translateTodoCopy({ data: opts }), 8000);
    if (!res.translations) return null;
    return res.translations as TodoTranslations;
  } catch {
    return null;
  }
}

export async function fillTodoTranslations(id: string, _text?: string, _from?: Lang) {
  try {
    const s = useYard.getState();
    const todo = s.todos.find((x) => x.id === id);
    if (!todo) return;
    const title = (todo.title || "").trim();
    const body = (todo.body || todo.original || "").trim();
    if (!title && !body) return;
    const from = todo.sourceLang ?? "da";
    const langs = todoTargetLangs({ ...todo, sourceLang: from }, s.employees);
    const keepTitle = isJobPlaceTitle(title, todo.projectId);
    const fallback = seedTodoTranslations({ title, body, from, langs, keepTitle });
    const original = { title, body };
    let next = fallback;
    const grok = await grokTodoCopy({ title, body, from, langs, keepTitle });
    if (grok) next = mergeTodoTranslations(next, grok, original);
    const needsLocal = langs.some((lang) => {
      if (lang === from) return false;
      return !copyDiffersFromOriginal(asTodoLangCopy(next[lang]), original);
    });
    if (needsLocal) {
      try {
        const local = await translateTodoCopyLocal({ title, body, from, langs, keepTitle });
        next = mergeTodoTranslations(next, local, original);
      } catch {
        /* original */
      }
    }
    if (!useYard.getState().todos.some((x) => x.id === id)) return;
    useYard.getState().patchTodo(id, { translations: next, sourceLang: from, original: body || title });
    const live = useYard.getState().todos.find((x) => x.id === id);
    if (live) void publishTodo(live);
  } catch {
    /* to-do must still exist */
  }
}
