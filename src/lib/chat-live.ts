import { chatFromRow, chatToRow } from "./sb-rows";
import { supabase } from "./supabase";
import type { ChatMessage } from "./types";

export async function pullChats(): Promise<ChatMessage[] | null> {
  try {
    const { data, error } = await supabase().from("messages").select("*").order("at", { ascending: false }).limit(200);
    if (error) return null;
    return (data ?? []).map((r) => chatFromRow(r as Record<string, unknown>)).filter((c) => c.id);
  } catch {
    return null;
  }
}

export async function publishChat(chat: ChatMessage): Promise<boolean> {
  try {
    const { error } = await supabase().from("messages").upsert(chatToRow(chat));
    return !error;
  } catch {
    return false;
  }
}
