/** Tiny validators for route files so login does not load Softr/store. */

export type ShareKind = "ks" | "as" | "tf" | "er";

export function isKundeSlug(value: string) {
  return /^[a-z0-9-]{2,48}$/.test(String(value || "").trim());
}

export function isShareKind(value: string): value is ShareKind {
  return /^(ks|as|tf|er)$/.test(value);
}

export function isShareSlug(value: string) {
  return /^[A-Za-z0-9._-]{1,40}$/.test(String(value || "").trim());
}

export function shareKindLabel(kind: ShareKind) {
  if (kind === "ks") return "Proceskontrol";
  if (kind === "as") return "Aftaleseddel";
  if (kind === "tf") return "Teknisk forespørgsel";
  return "Entreprenørrapport";
}

export function isValidMaSlug(value: string) {
  return /^[a-z0-9-]{2,48}$/.test(String(value || "").trim());
}

export function isValidMaNr(value: string) {
  return /^\d{1,4}$/.test(String(value || "").trim());
}

export function isValidMaLineParam(value: string) {
  return /^\d{1,3}$/.test(String(value || "").trim());
}

/** Drop empty search values so `/` and `/svend` are not 307-redirected to `?e=&p=`. */
export function optQuery(v: unknown) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export function publicHead(title: string, description: string, theme = "#F4F1EC") {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { name: "description", content: description },
      { name: "theme-color", content: theme },
    ],
  };
}
