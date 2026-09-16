import { translateTodoCopy } from "@/lib/ai.functions";
import { isJobPlaceTitle, seedTodoTranslations, todoTargetLangs } from "@/lib/crew-todo";
import { pladsPath, uploadPladsBytes } from "@/lib/plads-file";
import { useYard } from "@/lib/store";
import { splitDataUrl } from "@/lib/voice-agent";
import type { Lang } from "./types";

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
    let next = fallback;
    try {
      const res = await translateTodoCopy({ data: { title, body, from, langs, keepTitle } });
      if (res.translations) next = { ...fallback, ...res.translations };
    } catch {
      /* original */
    }
    if (!useYard.getState().todos.some((x) => x.id === id)) return;
    useYard.getState().patchTodo(id, { translations: next, sourceLang: from, original: body || title });
  } catch {
    /* to-do must still exist */
  }
}
