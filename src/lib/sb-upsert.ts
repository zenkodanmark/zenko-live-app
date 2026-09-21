/** Strip columns PostgREST says are missing, then retry. Never send a field the table does not have. */

export function isUnknownColumnError(err: { message?: string; code?: string } | null | undefined) {
  const msg = `${err?.code ?? ""} ${err?.message ?? ""}`;
  return /PGRST204|42703|schema cache|could not find .* column|column .* does not exist/i.test(msg);
}

export function isMissingTableError(err: { message?: string; code?: string } | null | undefined) {
  const msg = `${err?.code ?? ""} ${err?.message ?? ""}`;
  return /PGRST205|42P01|could not find the table|relation .* does not exist/i.test(msg);
}

export function unknownColumnName(err: { message?: string } | null | undefined): string {
  const msg = err?.message ?? "";
  const quoted = msg.match(/['"]([a-z_][a-z0-9_]*)['"]/i);
  if (quoted?.[1] && /column/i.test(msg)) return quoted[1];
  const bare = msg.match(/column\s+([a-z_][a-z0-9_]*)/i);
  return bare?.[1] ?? "";
}

export function dropColumn<T extends Record<string, unknown>>(row: T, col: string): T {
  if (!col || !(col in row)) return row;
  const { [col]: _drop, ...rest } = row;
  return rest as T;
}

export async function upsertKnown(
  run: (row: Record<string, unknown>) => Promise<{ error: { message?: string; code?: string } | null }>,
  row: Record<string, unknown>,
  max = 8,
): Promise<boolean> {
  let current = { ...row };
  for (let i = 0; i < max; i++) {
    const { error } = await run(current);
    if (!error) return true;
    if (!isUnknownColumnError(error)) return false;
    const col = unknownColumnName(error);
    if (!col || !(col in current)) return false;
    current = dropColumn(current, col);
  }
  return false;
}

export async function updateKnown(
  run: (row: Record<string, unknown>) => Promise<{ error: { message?: string; code?: string } | null; data?: unknown }>,
  row: Record<string, unknown>,
  max = 8,
): Promise<{ ok: boolean; data: Record<string, unknown> | null; missingTable?: boolean }> {
  let current = { ...row };
  for (let i = 0; i < max; i++) {
    const res = await run(current);
    if (!res.error) return { ok: true, data: (res.data as Record<string, unknown>) ?? null };
    if (isMissingTableError(res.error)) return { ok: false, data: null, missingTable: true };
    if (!isUnknownColumnError(res.error)) return { ok: false, data: null };
    const col = unknownColumnName(res.error);
    if (!col || !(col in current)) return { ok: false, data: null };
    current = dropColumn(current, col);
  }
  return { ok: false, data: null };
}
