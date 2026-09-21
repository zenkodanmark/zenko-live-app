export type SerialKind = "as" | "tb" | "tf" | "er" | "ks" | "fb" | "mo";

const PREFIX: Record<SerialKind, string> = {
  as: "Z-AS",
  tb: "Z-TB",
  tf: "Z-TF",
  er: "Z-ER",
  ks: "Z-KS",
  fb: "Z-FB",
  mo: "Z-MO",
};

/** Live Kærhuset-dummy. Aldrig genbrug nummeret. */
export const RESERVED_ER_NUMBERS = ["Z-ER-2026-001", "ER-1", "ER-001"];

export function pad3(n: number) {
  return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(3, "0");
}

export function zNumber(kind: SerialKind, n: number, year = 2026) {
  return `${PREFIX[kind]}-${year}-${pad3(n)}`;
}

export function aliasesFor(kind: SerialKind, n: number, year = 2026) {
  const letter = kind.toUpperCase();
  return [
    zNumber(kind, n, year),
    `${letter}-${n}`,
    `${letter}-${pad3(n)}`,
    `Z-${letter}-${year}-${n}`,
    `Z-${letter}-${n}`,
  ].map((s) => s.toUpperCase());
}

export function numberTaken(number: string, used: Iterable<string>) {
  const needle = String(number || "").trim().toUpperCase();
  if (!needle) return false;
  for (const u of used) {
    if (String(u || "").trim().toUpperCase() === needle) return true;
  }
  return false;
}

export function usedForKind(kind: SerialKind, local: Iterable<string>) {
  const extra = kind === "er" ? RESERVED_ER_NUMBERS : [];
  return [...local, ...extra];
}

/** Highest 00n from Z-ER-2026-00n (ignores softr ER-22). */
export function highestZSerial(kind: SerialKind, numbers: Iterable<string>, year = 2026) {
  const re = new RegExp(`^Z-${kind.toUpperCase()}-${year}-(\\d{3})$`, "i");
  let max = 0;
  for (const raw of numbers) {
    const m = String(raw || "").trim().match(re);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return max;
}

/** Next unused Z-ER-2026-00n (skips dummy 001 and ER-n / ER-00n). */
export function nextZNumber(kind: SerialKind, usedNumbers: Iterable<string>, start = 1, year = 2026) {
  const taken = new Set(
    [...usedNumbers].map((u) => String(u || "").trim().toUpperCase()).filter(Boolean),
  );
  if (kind === "er") for (const n of RESERVED_ER_NUMBERS) taken.add(n.toUpperCase());
  let n = Math.max(1, Math.floor(Number(start) || 1));
  for (let i = 0; i < 999; i++) {
    if (!aliasesFor(kind, n, year).some((a) => taken.has(a))) {
      return { n, number: zNumber(kind, n, year) };
    }
    n += 1;
  }
  return { n, number: zNumber(kind, n, year) };
}

export function allocateZNumber(
  kind: SerialKind,
  usedNumbers: Iterable<string>,
  start: number,
  preferred?: string,
  year = 2026,
) {
  const used = usedForKind(kind, usedNumbers);
  const want = String(preferred || "").trim();
  if (want && !numberTaken(want, used) && !(kind === "er" && RESERVED_ER_NUMBERS.some((n) => n.toUpperCase() === want.toUpperCase()))) {
    return { n: Math.max(1, Math.floor(Number(start) || 1)), number: want };
  }
  const floor = Math.max(start, highestZSerial(kind, used, year) + 1);
  return nextZNumber(kind, used, floor, year);
}

export function movedSource(newId: string) {
  return `moved:${newId}`;
}

export function movedIdFromSource(source?: string | null) {
  const s = String(source || "");
  return s.startsWith("moved:") ? s.slice("moved:".length) : "";
}
