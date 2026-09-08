import { compressImageFile, kindFromFile, videoPoster } from "@/lib/field-media";
import { readGps, siteFallback } from "@/lib/geo";
import { uploadFieldToDrive } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import { useYard } from "@/lib/store";
import type { Employee, FieldItem, FieldKind, Lang, Project } from "@/lib/types";

export async function saveFieldFiles(opts: {
  files: File[];
  kind?: FieldKind;
  lang: Lang;
  emp: Employee;
  job: Project;
}): Promise<number> {
  const { files, kind, lang, emp, job } = opts;
  if (!files.length) return 0;
  const gps = (await readGps(3500)) ?? siteFallback(job);
  const items: FieldItem[] = [];
  for (const file of files) {
    const k = kind ?? kindFromFile(file);
    let dataUrl: string | undefined;
    if (k === "photo") {
      try {
        dataUrl = (await compressImageFile(file)).dataUrl;
      } catch {
        dataUrl = undefined;
      }
    } else if (k === "video") {
      dataUrl = await videoPoster(file);
    }
    items.push({
      id: `fld-${crypto.randomUUID().slice(0, 8)}`,
      projectId: job.id,
      projectName: job.name,
      employeeId: emp.id,
      employeeName: emp.name,
      kind: k,
      name: file.name || `${k}-${Date.now()}`,
      mimeType: file.type || "application/octet-stream",
      bytes: file.size,
      dataUrl,
      note: "",
      takenAt: new Date().toISOString(),
      lat: gps.lat,
      lng: gps.lng,
      gpsLabel: job.name,
      status: "inbox",
    });
  }
  useYard.getState().addFieldItems(items);
  for (const it of items) {
    const text = [
      "ZENKO PLADS — feltfil (indbakke)",
      `Sag: ${it.projectName}`,
      `Ansat: ${it.employeeName}`,
      `Tid: ${it.takenAt}`,
      `Type: ${it.kind}`,
      `Fil: ${it.name}`,
    ].join("\n");
    try {
      const res = await uploadFieldToDrive({
        data: {
          projectId: it.projectId,
          name: it.name,
          mimeType: it.mimeType,
          note: it.note,
          employeeName: it.employeeName,
          kind: it.kind,
          text,
        },
      });
      if (res.ok && res.fileId) {
        if (res.folderId) useYard.getState().setInboxFolder(it.projectId, res.folderId);
        useYard.getState().patchFieldItem(it.id, {
          driveFileId: res.fileId,
          driveFolderId: res.folderId,
          driveUrl: `https://drive.google.com/file/d/${res.fileId}/view`,
        });
      } else {
        useYard.setState({ toast: t(lang, "driveFail") });
      }
    } catch {
      useYard.setState({ toast: t(lang, "driveFail") });
    }
  }
  return items.length;
}
