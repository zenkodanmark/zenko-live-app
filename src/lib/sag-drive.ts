import { ensureSagFolders, uploadKsPhotoToDrive } from "@/lib/drive.functions";
import { driveFor } from "@/lib/drive";
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

/** Drive first. Only then addProject. Existing name (Jyderup) is reused — no duplicate sag. */
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
}): Promise<{ ok: true; id: string; map: NonNullable<Awaited<ReturnType<typeof attachSagDrive>>["map"]> } | { ok: false; error: string; loginRequired?: boolean }> {
  const name = input.name.trim();
  const lang = input.lang ?? "da";
  if (!name) return { ok: false, error: t(lang, "sagFoldersFail") };
  const snap = useYard.getState();
  const existing = snap.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const id = existing?.id ?? input.id ?? `job-${crypto.randomUUID().slice(0, 6)}`;
  const res = await attachSagDrive(id, name, lang);
  if (!res.ok || !res.map?.root) {
    return { ok: false, error: res.error || t(lang, "sagFoldersFail"), loginRequired: res.loginRequired };
  }
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
      udbudFolderId: res.map.udbud,
      driveRootId: res.map.root,
    });
    snap.setDriveMap(id, res.map);
  }
  return { ok: true, id, map: res.map };
}

export async function flushLocalKsPhotos() {
  if (skipConnectors) return;
  const snap = useYard.getState();
  const leftover = (snap.drivePhotos ?? []).filter((p) => p.dataUrl && !p.driveFileId);
  if (!leftover.length) return;
  for (const p of leftover) {
    const split = splitDataUrl(p.dataUrl);
    if (!split.base64) {
      snap.patchPhoto(p.id, { dataUrl: "" });
      continue;
    }
    const job = snap.projects.find((x) => x.id === p.projectId);
    const res = await uploadKsPhotoToDrive({
      data: {
        projectId: p.projectId,
        projectName: job?.name ?? p.projectName,
        name: p.originalName || `${p.id}.jpg`,
        mimeType: split.mime || "image/jpeg",
        contentBase64: split.base64,
        point: p.point,
      },
    });
    if (res.fileId) {
      const hosted = res.fileId.startsWith("http") ? res.fileId : "";
      snap.upsertDrivePhotos([{
        ...p,
        driveFileId: res.fileId,
        driveUrl: hosted || `https://drive.google.com/file/d/${res.fileId}/view`,
        dataUrl: hosted || "",
      }]);
      const ks = snap.ksReports.find((r) => r.photoIds?.includes(p.id) || r.photoIds?.includes(p.driveFileId ?? ""));
      if (ks) {
        snap.patchReport("ks", ks.id, {
          photoIds: (ks.photoIds ?? []).map((id) => (id === p.id ? res.fileId : id)),
        });
      }
    } else {
      toastConnector(sessionLang("da"), res.error, res.loginRequired);
    }
  }
}