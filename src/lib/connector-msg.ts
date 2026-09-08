import { t, type CopyKey } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function isConnectorAuthError(error?: string, loginRequired?: boolean) {
  if (loginRequired) return true;
  const s = String(error || "");
  return /missing_connector_token|x-connector-access-token|edge gate|open this app through|login required/i.test(s);
}

export function connectorUserText(lang: Lang, error?: string, loginRequired?: boolean): string {
  if (isConnectorAuthError(error, loginRequired)) return t(lang, "googleNotConnected");
  const s = String(error || "").trim();
  if (!s) return t(lang, "googleNotConnected");
  if (/[æøåÆØÅăîșțńłü]/i.test(s)) return s;
  if (/token|connector|gate|HTTP |timeout|login/i.test(s)) return t(lang, "googleNotConnected");
  return s;
}

export function driveActionText(lang: Lang, error?: string, loginRequired?: boolean) {
  return connectorUserText(lang, error, loginRequired);
}

export function mailLoginKey(): CopyKey {
  return "mailLogin";
}

export function calLoginKey(): CopyKey {
  return "calLogin";
}
