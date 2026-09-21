import { ledelseFromTodoRow, todoFromRow, todoToRow, translationsForTodo } from "./sb-rows";
import { supabase } from "./supabase";
import { updateKnown, upsertKnown } from "./sb-upsert";
import type { KundeStatus, LedelseStatus, Todo } from "./types";

export async function pullTodos(): Promise<Todo[] | null> {
  try {
    const { data, error } = await supabase().from("todos").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return null;
    return (data ?? []).map((r) => todoFromRow(r as Record<string, unknown>)).filter((t) => t.id);
  } catch {
    return null;
  }
}

export async function publishTodo(todo: Todo): Promise<boolean> {
  try {
    const row = todoToRow(todo);
    return upsertKnown(async (r) => {
      const { error } = await supabase().from("todos").upsert(r);
      return { error };
    }, row as Record<string, unknown>);
  } catch {
    return false;
  }
}

function writtenLedelse(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  const got = ledelseFromTodoRow(row);
  return "ledelseStatus" in got ? got.ledelseStatus : "";
}

export async function publishTodoLedelse(todo: Todo, status: LedelseStatus): Promise<boolean> {
  const updatedAt = todo.updatedAt ?? new Date().toISOString();
  const translations = translationsForTodo({ ...todo, ledelseStatus: status });
  const withCol = { translations, updated_at: updatedAt, ledelse_status: status };
  try {
    const sb = supabase();
    const upd = await updateKnown(
      async (r) => {
        const res = await sb.from("todos").update(r).eq("id", todo.id);
        return { error: res.error };
      },
      withCol,
    );
    if (!upd.ok) {
      const row = todoToRow({ ...todo, ledelseStatus: status, updatedAt });
      const ok = await upsertKnown(async (r) => {
        const res = await sb.from("todos").upsert(r);
        return { error: res.error };
      }, row as Record<string, unknown>);
      if (!ok) return false;
    }
    const read = await sb.from("todos").select("translations,ledelse_status").eq("id", todo.id).maybeSingle();
    if (read.error || !read.data) return false;
    return writtenLedelse(read.data as Record<string, unknown>) === status;
  } catch {
    return false;
  }
}

export async function publishTodoKunde(todo: Todo, status: KundeStatus): Promise<boolean> {
  const updatedAt = todo.updatedAt ?? new Date().toISOString();
  const withCol = { updated_at: updatedAt, kunde_status: status };
  try {
    const sb = supabase();
    const upd = await updateKnown(
      async (r) => {
        const res = await sb.from("todos").update(r).eq("id", todo.id).select("kunde_status").maybeSingle();
        return { error: res.error, data: res.data };
      },
      withCol,
    );
    if (upd.ok && (upd.data as { kunde_status?: string } | null)?.kunde_status === status) return true;
    const row = todoToRow({ ...todo, kundeStatus: status, updatedAt });
    const ok = await upsertKnown(async (r) => {
      const res = await sb.from("todos").upsert(r);
      return { error: res.error };
    }, row as Record<string, unknown>);
    if (!ok) return false;
    const read = await sb.from("todos").select("kunde_status").eq("id", todo.id).maybeSingle();
    return (read.data as { kunde_status?: string } | null)?.kunde_status === status;
  } catch {
    return false;
  }
}
