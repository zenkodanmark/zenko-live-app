import type { BotAction } from "./bot-actions.ts";
import type { TalkTool } from "./bot-talk.ts";

export type AssistMsg = {
  who: "me" | "bot";
  text: string;
  used?: string[];
  live?: boolean;
};

export type TalkSave = {
  log: AssistMsg[];
  drafts: BotAction[];
  offered: TalkTool[];
  notes: string[];
};

const mem = new Map<string, AssistMsg[]>();
const talkMem = new Map<string, TalkSave>();

function thinLog(rows: AssistMsg[]): AssistMsg[] {
  return rows.slice(-40).map((m) => ({
    who: m.who,
    text: m.text,
    used: m.used,
    live: m.live,
  }));
}

export function loadAssist(key: string): AssistMsg[] {
  const hit = mem.get(key);
  if (hit) return hit;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`zenko-talk-${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TalkSave;
    if (Array.isArray(parsed.log)) {
      talkMem.set(key, parsed);
      mem.set(key, parsed.log);
      return parsed.log;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveAssist(key: string, rows: AssistMsg[]) {
  mem.set(key, rows.slice(-40));
}

export function loadTalk(key: string): TalkSave {
  const hit = talkMem.get(key);
  if (hit) return hit;
  const log = loadAssist(key);
  if (talkMem.has(key)) return talkMem.get(key)!;
  return { log, drafts: [], offered: [], notes: [] };
}

export function saveTalk(key: string, state: TalkSave) {
  const next: TalkSave = {
    log: thinLog(state.log),
    drafts: state.drafts,
    offered: state.offered,
    notes: state.notes.slice(-12),
  };
  talkMem.set(key, next);
  mem.set(key, next.log);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`zenko-talk-${key}`, JSON.stringify(next));
  } catch {
    /* quota */
  }
}
