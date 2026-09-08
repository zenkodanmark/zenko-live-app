import type { ChatMessage, Entrepreneur, InboxClass, KsReport, MaterialNeed, Slip, Tf, Todo } from "./types";

export type BoardPile = "todo" | "ent" | "tf" | "extra" | "ks" | "materials";

export const BOARD_PILES: BoardPile[] = ["todo", "ent", "tf", "extra", "ks", "materials"];

export const CLASSIFY_ORDER: InboxClass[] = ["todo", "ent", "tf", "extra", "ks", "materials"];

export function pileLabelKey(
  p: BoardPile | InboxClass,
): "boardPileTodo" | "boardPileEr" | "boardPileTf" | "boardPileAs" | "boardPileKs" | "boardPileMa" {
  if (p === "todo") return "boardPileTodo";
  if (p === "ent") return "boardPileEr";
  if (p === "tf") return "boardPileTf";
  if (p === "extra") return "boardPileAs";
  if (p === "ks") return "boardPileKs";
  return "boardPileMa";
}

export function inboxToPile(k: InboxClass): BoardPile {
  if (k === "todo") return "todo";
  if (k === "ent") return "ent";
  if (k === "tf") return "tf";
  if (k === "extra") return "extra";
  if (k === "ks") return "ks";
  return "materials";
}

export function pileSeenKey(employeeId: string, pile: BoardPile) {
  return `${employeeId}::${pile}`;
}

export function isNewFromChat(at: string | undefined, fromChat: boolean, seenAt: string) {
  if (!fromChat || !at) return false;
  return !seenAt || at > seenAt;
}

export function pileHasNewFromChat(opts: {
  pile: BoardPile;
  employeeId: string;
  seenAt: Record<string, string>;
  todos: Todo[];
  ents: Entrepreneur[];
  tfs: Tf[];
  slips: Slip[];
  ks: KsReport[];
  needs: MaterialNeed[];
  chats: ChatMessage[];
}) {
  const seen = opts.seenAt[pileSeenKey(opts.employeeId, opts.pile)] ?? "";
  if (opts.pile === "todo") {
    return opts.todos.some((r) => isNewFromChat(r.createdAt, Boolean(r.fromChatId), seen));
  }
  if (opts.pile === "ent") {
    return opts.ents.some((r) => isNewFromChat(r.createdAt, Boolean(r.fromChatId), seen) && !r.trashedAt);
  }
  if (opts.pile === "tf") {
    return opts.tfs.some((r) => isNewFromChat(r.createdAt, Boolean(r.fromChatId), seen) && !r.trashedAt);
  }
  if (opts.pile === "extra") {
    return opts.slips.some((r) => isNewFromChat(r.createdAt, Boolean(r.fromChatId), seen) && !r.trashedAt);
  }
  if (opts.pile === "ks") {
    return opts.ks.some((r) => isNewFromChat(r.createdAt, Boolean(r.fromChatId), seen) && !r.trashedAt);
  }
  return (
    opts.needs.some((r) => isNewFromChat(r.at, Boolean(r.chatId), seen)) ||
    opts.chats.some((m) => m.classifiedAs === "materials" && isNewFromChat(m.classifiedAt ?? m.at, true, seen))
  );
}
