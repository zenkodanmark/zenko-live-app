import { ledelseFromTodoRow, todoFromRow, todoToRow, translationsForTodo } from "./sb-rows";
import { supabase } from "./supabase";
import type { LedelseStatus, Todo } from "./types";

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
    const { error } = await supabase().from("todos").upsert(row);
    if (!error) return true;
    const { ledelse_status: _drop, ...rest } = row as typeof row & { ledelse_status?: unknown };
    const retry = await supabase().from("todos").upsert(rest);
    return !retry.error;
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
  const noCol = { translations, updated_at: updatedAt };
  try {
    const sb = supabase();
    let error = (await sb.from("todos").update(withCol).eq("id", todo.id)).error;
    if (error) error = (await sb.from("todos").update(noCol).eq("id", todo.id)).error;
    if (error) {
      const row = todoToRow({ ...todo, ledelseStatus: status, updatedAt });
      let up = await sb.from("todos").upsert(row);
      if (up.error) {
        const { ledelse_status: _drop, ...rest } = row as typeof row & { ledelse_status?: unknown };
        up = await sb.from("todos").upsert(rest);
      }
      if (up.error) return false;
    }
    const read = await sb.from("todos").select("translations").eq("id", todo.id).maybeSingle();
    if (read.error || !read.data) return false;
    return writtenLedelse(read.data as Record<string, unknown>) === status;
  } catch {
    return false;
  }
}
