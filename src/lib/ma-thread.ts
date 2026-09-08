import { isMasterRole } from "./seed.ts";
import type { Lang, MaThreadMsg, Role } from "./types.ts";

/** Supplier page always gets Danish. Ansat posts are shown as Zenko. Extra fields stay for Drive. */
export function toSupplierThread(m: MaThreadMsg): MaThreadMsg {
  return {
    ...m,
    from: m.from === "leverandor" ? "leverandor" : "mester",
    text: m.translations?.da ?? m.text,
  };
}

export function shownMaThreadText(m: MaThreadMsg, lang: Lang, role?: Role) {
  if (role && isMasterRole(role)) return m.translations?.da ?? m.text;
  return m.translations?.[lang] ?? m.translations?.da ?? m.text;
}

export function maThreadOriginal(m: MaThreadMsg) {
  return (m.original ?? m.text).trim();
}
