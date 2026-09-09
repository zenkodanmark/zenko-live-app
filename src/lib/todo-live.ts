import { todoFromRow, todoToRow } from "./sb-rows";
import { supabase } from "./supabase";
import type { Todo } from "./types";

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
    const { ledelse_status, ...rest } = row as typeof row & { ledelse_status?: unknown };
    const retry = await supabase().from("todos").upsert(rest);
    return !retry.error;
  } catch {
    return false;
  }
}
