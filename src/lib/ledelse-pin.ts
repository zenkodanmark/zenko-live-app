export const LEDELSE_ORIGIN = "https://zenkodanmark.github.io";

export function generateLedelsePin(): string {
  for (let i = 0; i < 24; i++) {
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    if (pin !== "1234") return pin;
  }
  return "4821";
}

export function normalizePin(v: string | undefined | null): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 4);
}

export function isFourPin(v: string | undefined | null): boolean {
  return /^\d{4}$/.test(normalizePin(v));
}

export function ensureLedelsePin(current: string | undefined | null): string {
  return isFourPin(current) ? normalizePin(current) : generateLedelsePin();
}

export function pinMatches(typed: string, stored: string | undefined | null): boolean {
  if (!isFourPin(stored)) return false;
  return normalizePin(typed) === normalizePin(stored);
}

export function ledelsePublicUrl(slug: string): string {
  return `${LEDELSE_ORIGIN}/sag/${slug}`;
}

export function ledelseClipboard(name: string, slug: string, pin: string): string {
  return `${name}\n${ledelsePublicUrl(slug)}\nKode: ${normalizePin(pin)}`;
}