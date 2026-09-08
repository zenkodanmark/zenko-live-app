export type UdKey = "plads" | "erfaring" | "dagsrapport";

export const UD_FOLDERS: { key: UdKey; name: string }[] = [
  { key: "plads", name: "11 Pladsfiler" },
  { key: "erfaring", name: "12 Erfaring" },
  { key: "dagsrapport", name: "13 Dagsrapport" },
];

export const UD_ERFARING_TYPES = ["Pladsregel", "Genvej", "Godkendt metode"] as const;
export const UD_DAGS_TYPES = ["Klargøring", "Vejr", "Levering", "Andet fag", "Stop"] as const;

export function udNoteSlug(text: string, at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "note";
  return `${day}-${slug}.txt`;
}

export function udFolderName(key: UdKey) {
  return UD_FOLDERS.find((f) => f.name && f.key === key)?.name ?? "11 Pladsfiler";
}

export function isUdNote(name: string) {
  return /\.note\.json$/i.test(name);
}

export function isUdDraftNote(name: string) {
  return /\.draft\.note\.json$/i.test(name);
}

/** 11 / 12 / 13 only — never 01 Udbud. */
export function resolveUdFolder(asked: string): string | null {
  const q = (asked || "").toLowerCase();
  if (!q.trim()) return null;
  if (q.includes("erfaring") || q.includes("pladsregel") || q.includes("genvej") || q.includes("godkendt") || q.includes("12")) {
    return "12 Erfaring";
  }
  if (q.includes("dagsrapport") || q.includes("dagbog") || q.includes("klarg") || q.includes("vejr") || q.includes("levering") || q.includes("13")) {
    return "13 Dagsrapport";
  }
  if (q.includes("pladsfil") || q.includes("datablad") || q.includes("rettelses") || q.includes("11")) {
    return "11 Pladsfiler";
  }
  return null;
}
