import { pladsPath, uploadPladsBytes } from "@/lib/plads-file";
import { driveFor, type DriveMap } from "@/lib/drive";
import { connectorUserText, isConnectorAuthError } from "@/lib/connector-msg";
import { t } from "@/lib/i18n";
import { useYard } from "@/lib/store";
import { splitDataUrl } from "@/lib/voice-agent";
import type { Lang } from "@/lib/types";

let skipConnectors = false;
let authToastShown = false;

function sessionLang(fallback: Lang = "da"): Lang {
  const s = useYard.getState();
  return s.langOverride ?? s.employees.find((e) => e.id === s.employeeId)?.language ?? fallback;
}

function toastConnector(lang: Lang, error?: string, loginRequired?: boolean) {
  const text = connectorUserText(lang, error, loginRequired);
  if (isConnectorAuthError(error, loginRequired)) {
    if (authToastShown) return;
    authToastShown = true;
  }
  useYard.setState({ toast: text });
}

export function connectorsOffline() {
  return skipConnectors;
}

export async function attachSagDrive(projectId: string, name: string, lang: Lang = "da") {
  const uiLang = sessionLang(lang);
  if (skipConnectors) {
    return { ok: false as const, error: "missing_connector_token", loginRequired: true, map: undefined, rootId: undefined };
  }
  const res = await ensureSagFolders({
    data: { projectId, name, known: driveFor(projectId) ?? undefined },
  });
  if (res.ok && res.map?.root) {
    useYard.getState().setDriveMap(projectId, res.map);
    return res;
  }
  if (isConnectorAuthError(res.error, res.loginRequired)) {
    skipConnectors = true;
    toastConnector(uiLang, res.error, res.loginRequired);
    return res;
  }
  toastConnector(uiLang, res.error || t(uiLang, "sagFoldersFail"), res.loginRequired);
  return res;
}

const EMPTY_MAP: DriveMap = {
  root: "", udbud: "", ks: "", kunde: "", extra: "", ue: "", reports: "", meetings: "", tf: "", ent: "", inbox: "", chat: "",
};

/** Create the job in the app. Files go to Supabase — Drive is not required. */
export async function createSagOnDrive(input: {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdBy: string;
  customer?: string;
  trade?: string;
  period?: string;
  qualityManager?: string;
  lang?: Lang;
}): Promise<{ ok: true; id: string; map: DriveMap } | { ok: false; error: string; loginRequired?: boolean }> {
  const name = input.name.trim();
  const lang = input.lang ?? "da";
  if (!name) return { ok: false, error: t(lang, "sagFoldersFail") };
  const snap = useYard.getState();
  const existing = snap.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const id = existing?.id ?? input.id ?? `job-${crypto.randomUUID().slice(0, 6)}`;
  if (!existing) {
    snap.addProject({
      id,
      name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdBy: input.createdBy,
      customer: input.customer,
      trade: input.trade,
      period: input.period,
      qualityManager: input.qualityManager,
    });
  }
  return { ok: true, id, map: driveFor(id) ?? EMPTY_MAP };
}

export async function flushLocalKsPhotos() {
  const snap = useYard.getState();
  const leftover = (snap.drivePhotos ?? []).filter((p) => p.dataUrl && p.dataUrl.startsWith("data:") && !p.driveFileId);
  if (!leftover.length) return;
  for (const p of leftover) {
    const split = splitDataUrl(p.dataUrl);
    if (!split.base64) {
      snap.patchPhoto(p.id, { dataUrl: "" });
      continue;
    }
    const res = await uploadPladsBytes({
      path: pladsPath(p.projectId, "ks", p.originalName || `${p.id}.jpg`),
      contentBase64: split.base64,
      mimeType: split.mime || "image/jpeg",
      projectId: p.projectId,
      kind: "ks",
      name: p.originalName || `${p.id}.jpg`,
    });
    if (res.fileId) {
      snap.upsertDrivePhotos([{
        ...p,
        driveFileId: res.fileId,
        driveUrl: res.url,
        dataUrl: res.url,
      }]);
      const ks = snap.ksReports.find((r) => r.photoIds?.includes(p.id) || r.photoIds?.includes(p.driveFileId ?? ""));
      if (ks) {
        snap.patchReport("ks", ks.id, {
          photoIds: (ks.photoIds ?? []).map((id) => (id === p.id ? res.fileId : id)),
        });
      }
    }
  }
}