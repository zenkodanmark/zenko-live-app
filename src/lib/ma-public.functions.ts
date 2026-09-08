import { createServerFn } from "@tanstack/react-start";
import { ConnectorType, GoogleDriveTools } from "@/lib/app-data";
import { driveFor, ORDERS_FOLDER_NAME, RECEIPTS_FOLDER_NAME } from "./drive";
import { ensureDriveFolderPath, listDriveContents, resolveJobFolder } from "./drive.functions";
import { projectIdFromSlug } from "./ks-customer";
import {
  dummyMaOrder,
  emptyMaOrder,
  formatChatLine,
  formatOrdreTxt,
  isMaPreview,
  maFolderName,
  maLabel,
  maLineN,
  maNrFromNumber,
  parseOrdreTxt,
  type MaPublicOrder,
} from "./ma-public";
import { masterEmployeeIds, sendPush } from "./push-send.ts";
import { sendSlack } from "./slack-send.ts";
import type { MaShareStatus, MaThreadMsg } from "./types";

const JYDERUP_ROOT = "1w1U7CBsWBZySdmicGpk6k9HU7MH2u2Rk";
const JYDERUP_ORDERS = "1ROAeoXXMm-iNXmIk7blvXpQs6ydZmikq";
const JYDERUP_RECEIPTS = "1gyVbOHAkHIkS0LUzkQMVEkwuFLuvG9pq";
const DA_TOKEN = "Google er ikke forbundet. Åbn appen fra Grok (preview), eller log ind.";

async function tokenMissing() {
  const { getConnectorAccessToken } = await import("@/lib/app-data/client.server");
  return !getConnectorAccessToken();
}

function tokenFail<T extends object>(extra: T) {
  return { ok: false as const, error: DA_TOKEN, loginRequired: true as const, ...extra };
}

function isJyderup(slug: string, projectId: string) {
  return slug === "jyderup" || /jyderup/i.test(projectId);
}

async function readDriveText(fileId: string) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const read = await callTool(GoogleDriveTools.readFile, { file_id: fileId, max_chars: 40000 }, { connectorType: ConnectorType.GoogleDrive });
  if (!read.ok || !read.data) return "";
  const d = read.data as Record<string, unknown>;
  return String(d.text ?? d.content ?? d.body ?? "");
}

function parseOrderJson(raw: string): MaPublicOrder | null {
  const fromTxt = parseOrdreTxt(raw);
  if (fromTxt) {
    if (!fromTxt.nr && fromTxt.number) fromTxt.nr = maNrFromNumber(fromTxt.number);
    if (!fromTxt.label) fromTxt.label = maLabel(fromTxt.number || fromTxt.nr);
    fromTxt.lines = Array.isArray(fromTxt.lines)
      ? fromTxt.lines.map((l) => ({
          ...l,
          photoFileIds: l.photoFileIds ?? [],
          videoFileIds: l.videoFileIds ?? [],
          checked: Boolean(l.checked),
          checkedAt: l.checkedAt || "",
          checkedBy: l.checkedBy || "",
        }))
      : [];
    fromTxt.thread = Array.isArray(fromTxt.thread) ? fromTxt.thread : [];
    fromTxt.receiptPhotos = Array.isArray(fromTxt.receiptPhotos) ? fromTxt.receiptPhotos : [];
    return fromTxt;
  }
  return null;
}

async function folderIdFor(projectId: string, folderName: string, slug = "") {
  if (await tokenMissing()) return { id: "", loginRequired: true as boolean | undefined, error: DA_TOKEN };
  const jy = isJyderup(slug, projectId);
  if (jy && (folderName === ORDERS_FOLDER_NAME || folderName.startsWith(`${ORDERS_FOLDER_NAME}/`))) {
    const rest = folderName.slice(ORDERS_FOLDER_NAME.length).replace(/^\//, "");
    if (!rest) return { id: JYDERUP_ORDERS, loginRequired: false as boolean | undefined };
    return ensureDriveFolderPath(JYDERUP_ORDERS, rest);
  }
  if (jy && (folderName === RECEIPTS_FOLDER_NAME || folderName.startsWith(`${RECEIPTS_FOLDER_NAME}/`))) {
    const rest = folderName.slice(RECEIPTS_FOLDER_NAME.length).replace(/^\//, "");
    if (!rest) return { id: JYDERUP_RECEIPTS, loginRequired: false as boolean | undefined };
    return ensureDriveFolderPath(JYDERUP_RECEIPTS, rest);
  }
  const root = driveFor(projectId)?.root ?? (jy ? JYDERUP_ROOT : "");
  if (root) return ensureDriveFolderPath(root, folderName);
  return resolveJobFolder(projectId, slug, folderName);
}

async function latestNamedIn(folderId: string, names: string[]) {
  const listed = await listDriveContents({ data: { folderId } });
  if (!listed.ok) return { text: "", loginRequired: listed.loginRequired, id: "" };
  const files = (listed.items ?? []) as { name?: string; id?: string }[];
  const want = names.map((n) => n.toLowerCase());
  const pick = [...files].reverse().find((f) => want.includes(String(f.name || "").toLowerCase()))
    ?? files.find((f) => /\.txt$/i.test(String(f.name || "")) || /\.json$/i.test(String(f.name || "")));
  if (!pick?.id) return { text: "", loginRequired: listed.loginRequired, id: "" };
  return { text: await readDriveText(String(pick.id)), loginRequired: listed.loginRequired, id: String(pick.id) };
}

async function listImageIds(folderId: string) {
  const listed = await listDriveContents({ data: { folderId } });
  if (!listed.ok) return [] as { fileId: string; n: string }[];
  const imgs = (listed.items ?? []).filter((f: { name?: string; mime?: string; mimeType?: string }) => {
    const n = String(f.name || "").toLowerCase();
    const mime = String(f.mime || f.mimeType || "");
    return mime.includes("image") || /\.(jpe?g|png|webp|heic)$/.test(n);
  });
  return imgs.map((f: { id?: string }, i: number) => ({ fileId: String(f.id || ""), n: String(i + 1).padStart(2, "0") })).filter((x) => x.fileId);
}

async function upsertText(folderId: string, name: string, text: string) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const listed = await listDriveContents({ data: { folderId } });
  const hits = ((listed.items ?? []) as { name?: string; id?: string }[]).filter((f) => String(f.name || "").toLowerCase() === name.toLowerCase());
  for (const h of hits) {
    if (h.id) {
      await callTool(GoogleDriveTools.trashFile, { file_id: h.id }, { connectorType: ConnectorType.GoogleDrive });
    }
  }
  const wrote = await callTool("google_drive_create_file", {
    name,
    parent_id: folderId,
    mimeType: "text/plain",
    content: text.slice(0, 40000),
  }, { connectorType: ConnectorType.GoogleDrive });
  const d = wrote.data as Record<string, unknown> | null;
  const fileId = String(d?.id ?? d?.file_id ?? d?.fileId ?? "");
  return { ok: Boolean(wrote.ok && fileId), fileId, loginRequired: wrote.loginRequired, error: wrote.ok ? undefined : wrote.errorMessage };
}

async function appendText(folderId: string, name: string, line: string) {
  const cur = await latestNamedIn(folderId, [name]);
  const next = [cur.text.trim(), line].filter(Boolean).join("\n");
  return upsertText(folderId, name, next.endsWith("\n") ? next : `${next}\n`);
}

export const getMaPublic = createServerFn({ method: "POST" })
  .validator((input: { slug: string; nr: string }) => input)
  .handler(async ({ data }) => {
    const nr = maNrFromNumber(data.nr) || data.nr.padStart(3, "0");
    const projectId = projectIdFromSlug(data.slug);
    const preview = isMaPreview();
    if (await tokenMissing()) {
      if (preview && data.slug === "islevvaenge" && nr === "017") return { ok: true as const, order: dummyMaOrder(), loginRequired: true };
      return { ok: true as const, order: emptyMaOrder(data.slug, nr), loginRequired: true, error: DA_TOKEN };
    }
    if (!projectId && !isJyderup(data.slug, "")) {
      if (preview && data.slug === "islevvaenge" && nr === "017") return { ok: true as const, order: dummyMaOrder(), loginRequired: false };
      return { ok: false as const, order: emptyMaOrder(data.slug, nr), missing: true };
    }
    const pid = projectId || (isJyderup(data.slug, "") ? "jyderup" : "");
    const label = maLabel(nr);
    const folder = await folderIdFor(pid, `${ORDERS_FOLDER_NAME}/${label}`, data.slug);
    if (!folder.id) {
      if (preview && data.slug === "islevvaenge" && nr === "017") return { ok: true as const, order: dummyMaOrder(), loginRequired: folder.loginRequired };
      return { ok: true as const, order: emptyMaOrder(data.slug, nr), loginRequired: folder.loginRequired, error: folder.error };
    }
    const json = await latestNamedIn(folder.id, ["ordre.txt", "ordre.json"]);
    const parsed = json.text ? parseOrderJson(json.text) : null;
    const recFolder = await folderIdFor(pid, `${RECEIPTS_FOLDER_NAME}/${label}`, data.slug);
    const photos = recFolder.id ? await listImageIds(recFolder.id) : [];
    if (parsed) {
      const extra = parsed.lines.flatMap((l) => l.photoFileIds.map((fileId, i) => ({ fileId, n: l.n + "-" + String(i + 1) })));
      const receiptPhotos = [...photos, ...extra, ...parsed.receiptPhotos].filter((p, i, a) => p.fileId && a.findIndex((x) => x.fileId === p.fileId) === i);
      return { ok: true as const, order: { ...parsed, receiptPhotos, dummy: false, missingData: false }, loginRequired: json.loginRequired };
    }
    if (preview && data.slug === "islevvaenge" && nr === "017") return { ok: true as const, order: dummyMaOrder(), loginRequired: json.loginRequired };
    return { ok: true as const, order: emptyMaOrder(data.slug, nr), loginRequired: json.loginRequired };
  });

export const saveMaPublic = createServerFn({ method: "POST" })
  .validator((input: { order: MaPublicOrder; action: MaShareStatus }) => input)
  .handler(async ({ data }) => {
    if (await tokenMissing()) return tokenFail({ fileId: "" });
    const order = { ...data.order, shareStatus: data.action, dummy: false, missingData: false };
    const label = order.label || maFolderName(order.number);
    const folderName = `${ORDERS_FOLDER_NAME}/${label}`;
    const folder = await folderIdFor(order.projectId, folderName, order.slug);
    if (!folder.id) return { ok: false as const, fileId: "", error: folder.error || "Ingen Drive-mappe", loginRequired: folder.loginRequired };
    const wrote = await upsertText(folder.id, "ordre.txt", formatOrdreTxt(order));
    return { ok: wrote.ok, fileId: wrote.fileId, loginRequired: wrote.loginRequired, error: wrote.error };
  });

export const postMaThread = createServerFn({ method: "POST" })
  .validator((input: { slug: string; nr: string; msg: MaThreadMsg }) => input)
  .handler(async ({ data }) => {
    if (await tokenMissing()) return tokenFail({ order: emptyMaOrder(data.slug, data.nr) });
    const got = await getMaPublic({ data: { slug: data.slug, nr: data.nr } });
    if (!got.ok || !got.order || got.order.dummy || got.order.missingData) {
      return { ok: false as const, order: got.order ?? emptyMaOrder(data.slug, data.nr), error: "Ingen ordre" };
    }
    const order = { ...got.order, thread: [...(got.order.thread ?? []), data.msg] };
    const saved = await saveMaPublic({ data: { order, action: order.shareStatus } });
    const folder = await folderIdFor(order.projectId, `${ORDERS_FOLDER_NAME}/${order.label || maFolderName(order.number)}`, order.slug);
    if (folder.id) await appendText(folder.id, "chat.txt", formatChatLine(data.msg));
    if (saved.ok && data.msg.from === "leverandor") {
      const title = "Mester: Svar fra leverandør";
      const body = [order.label || maLabel(order.number), data.msg.text.slice(0, 80)].filter(Boolean).join(" · ");
      await sendPush({
        kind: "ma",
        title: "Svar fra leverandør",
        body,
        url: `/mester?open=ma&id=${encodeURIComponent(order.id)}`,
        toIds: masterEmployeeIds(),
        actorId: "leverandor",
      });
      await sendSlack({ title, body });
    }
    return { ok: saved.ok, order, error: saved.error, loginRequired: saved.loginRequired };
  });

export const toggleMaLine = createServerFn({ method: "POST" })
  .validator((input: { slug: string; nr: string; n: string; who: string }) => input)
  .handler(async ({ data }) => {
    if (await tokenMissing()) return tokenFail({ order: emptyMaOrder(data.slug, data.nr) });
    const got = await getMaPublic({ data: { slug: data.slug, nr: data.nr } });
    if (!got.ok || !got.order || got.order.dummy || got.order.missingData) {
      return { ok: false as const, order: got.order ?? emptyMaOrder(data.slug, data.nr), error: "Ingen ordre" };
    }
    const now = new Date().toISOString();
    const who = data.who.trim() || "Trælast";
    const lines = got.order.lines.map((l) => {
      if (l.n !== data.n.padStart(2, "0") && Number(l.n) !== Number(data.n)) return l;
      const on = !l.checked;
      return { ...l, checked: on, checkedAt: on ? now : "", checkedBy: on ? who : "" };
    });
    const order = { ...got.order, lines };
    const saved = await saveMaPublic({ data: { order, action: order.shareStatus } });
    return { ok: saved.ok, order, error: saved.error, loginRequired: saved.loginRequired };
  });

export const postMaPhoto = createServerFn({ method: "POST" })
  .validator((input: { slug: string; nr: string; name: string; mimeType: string; contentBase64: string; kind: "receipt" | "line"; lineN?: string }) => input)
  .handler(async ({ data }) => {
    if (await tokenMissing()) return tokenFail({ fileId: "" });
    const got = await getMaPublic({ data: { slug: data.slug, nr: data.nr } });
    const order = got.order;
    if (!order || order.dummy || order.missingData) return { ok: false as const, fileId: "", error: "Ingen ordre" };
    const label = order.label || maFolderName(order.number);
    const folderName = data.kind === "receipt" ? `${RECEIPTS_FOLDER_NAME}/${label}` : `${ORDERS_FOLDER_NAME}/${label}`;
    const folder = await folderIdFor(order.projectId, folderName, order.slug);
    if (!folder.id) return { ok: false as const, fileId: "", error: folder.error || "Ingen Drive-mappe", loginRequired: folder.loginRequired };
    const { callTool } = await import("@/lib/app-data/client.server");
    const wrote = await callTool("google_drive_create_file", {
      name: data.name || `foto-${Date.now()}.jpg`,
      parent_id: folder.id,
      mimeType: data.mimeType || "image/jpeg",
      content: data.contentBase64,
      content_base64: data.contentBase64,
    }, { connectorType: ConnectorType.GoogleDrive });
    const d = wrote.data as Record<string, unknown> | null;
    const fileId = String(d?.id ?? d?.file_id ?? d?.fileId ?? "");
    if (!fileId) return { ok: false as const, fileId: "", error: wrote.errorMessage || "Drive tog ikke imod billedet", loginRequired: wrote.loginRequired };
    let next = order;
    if (data.kind === "receipt") {
      next = { ...order, receiptPhotos: [...order.receiptPhotos, { fileId, n: maLineN(order.receiptPhotos.length) }] };
    } else if (data.lineN) {
      next = {
        ...order,
        lines: order.lines.map((l) => (l.n === data.lineN ? { ...l, photoFileIds: [...l.photoFileIds, fileId] } : l)),
      };
    }
    await saveMaPublic({ data: { order: next, action: next.shareStatus } });
    return { ok: true as const, fileId, order: next };
  });
