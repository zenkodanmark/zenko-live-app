export const LEDELSE_ORIGIN = "https://zenkodanmark.github.io";

export function generateLedelsePin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function normalizePin(v: string | undefined | null): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 4);
}

export function isFourPin(v: string | undefined | null): boolean {
  return /^\d{4}$/.test(normalizePin(v));
}

export function ledelsePublicUrl(slug: string): string {
  return `${LEDELSE_ORIGIN}/sag/${slug}`;
}

export function ledelseClipboard(name: string, slug: string, pin: string): string {
  return `${name}\n${ledelsePublicUrl(slug)}\nKode: ${normalizePin(pin)}`;
}

export function sessionPinKey(slug: string) {
  return `zenko-ledelse-pin:${slug}`;
}

export function readSessionPin(slug: string): string {
  try {
    return normalizePin(sessionStorage.getItem(sessionPinKey(slug)));
  } catch {
    return "";
  }
}

export function writeSessionPin(slug: string, pin: string) {
  try {
    sessionStorage.setItem(sessionPinKey(slug), normalizePin(pin));
  } catch {
    /* private mode */
  }
}

export function clearSessionPin(slug: string) {
  try {
    sessionStorage.removeItem(sessionPinKey(slug));
  } catch {
    /* private mode */
  }
}

export function isLedelseUnlocked(slug: string, pin: string | undefined | null): boolean {
  const want = normalizePin(pin);
  if (!isFourPin(want)) return false;
  return readSessionPin(slug) === want;
}
