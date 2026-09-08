/** Demo-hak til Hillerødsholm — resten er slået fra, indtil mester hakker. */
const AS_ON = new Set(["292", "368", "383", "385", "387", "388"]);
const ER_ON = new Set(["366"]);

function bareNumber(number: string) {
  return String(number)
    .trim()
    .replace(/^(AS|TF|ER|KS)[-.\s]*/i, "")
    .replace(/\s+/g, "");
}

export function defaultLedelseOn(kind: "as" | "tf" | "er", number: string) {
  const n = String(number).trim();
  if (kind === "tf") return /Z-TF-2026-006/i.test(n);
  const key = bareNumber(n);
  if (kind === "as") return AS_ON.has(key);
  return ER_ON.has(key);
}

export function defaultLedelseStatus(kind: "as" | "tf" | "er", number: string) {
  return defaultLedelseOn(kind, number) ? ("med_til_ledelse" as const) : ("skjult" as const);
}
