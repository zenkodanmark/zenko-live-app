import { AS_FOLDER_NAME, ER_FOLDER_NAME, KS_REPORTS_FOLDER_NAME, LIN_TF_FOLDER_NAME, TODO_FOLDER_NAME } from "./drive";

export function padSerial(n: number) {
  return String(n).padStart(3, "0");
}

export function peekReportNumber(kind: "as" | "tb" | "tf" | "er" | "ks" | "mo", serial: { as?: number; tb?: number; tf?: number; er?: number; ks?: number; mo?: number }) {
  if (kind === "as") return `Z-AS-2026-${padSerial(serial.as ?? 1)}`;
  if (kind === "tb") return `TB-2026-${padSerial(serial.tb ?? 1)}`;
  if (kind === "tf") return `Z-TF-2026-${padSerial(serial.tf ?? 1)}`;
  if (kind === "er") return `Z-ER-2026-${padSerial(serial.er ?? 1)}`;
  if (kind === "ks") return `Z-KS-2026-${padSerial(serial.ks ?? 1)}`;
  return `MA-2026-${padSerial(serial.mo ?? 1)}`;
}

export function reportDriveFolder(kind: "as" | "tf" | "er" | "ks" | "todo", numberOrId: string, point = "div") {
  if (kind === "as") return `${AS_FOLDER_NAME}/${numberOrId}`;
  if (kind === "tf") return `${LIN_TF_FOLDER_NAME}/${numberOrId}`;
  if (kind === "er") return `${ER_FOLDER_NAME}/${numberOrId}`;
  if (kind === "ks") return `${KS_REPORTS_FOLDER_NAME}/${point || "div"}/${numberOrId}`;
  return `${TODO_FOLDER_NAME}/${numberOrId}`;
}
