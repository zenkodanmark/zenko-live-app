/** Softr Issues marked TF (teknisk forespørgsel). */
export const SOFTR_TF_NUMBERS = new Set<number>([4, 12, 22, 24, 33, 168, 172, 181, 185, 217, 238, 239, 244, 321]);

export function isSoftrTfNumber(n: number | string) {
  const num = typeof n === "number" ? n : Number(String(n).replace(/\D/g, ""));
  return Number.isFinite(num) && SOFTR_TF_NUMBERS.has(num);
}
