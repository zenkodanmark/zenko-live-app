import { translateMessage } from "@/lib/ai.functions";
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
    const mime = split.mime || "image/jpeg";
    const video = mime.startsWith("video/");
    const name = video
      ? (/\.(mp4|mov|webm|m4v)$/i.test(d.name) ? d.name : `video-${i + 1}.mp4`)
      : (/\.(jpe?g|png|webp)$/i.test(d.name) ? d.name : `foto-${i + 1}.jpg`);
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

export async function fillTodoTranslations(id: string, text: string, from: Lang) {
  const original = text.trim();
  if (!original) return;
  try {
    const res = await translateMessage({ data: { text: original, from } });
    if (res.ok) {
      useYard.getState().patchTodo(id, { translations: res.translations, sourceLang: from, original });
      return;
    }
  } catch {
    /* keep original */
  }
  useYard.getState().patchTodo(id, { translations: { [from]: original, da: original }, sourceLang: from, original });
}
