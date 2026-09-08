export type YardEvent =
  | { kind: "todo"; id: string; payload: unknown; isNew: boolean; actorId: string }
  | { kind: "chat"; id: string; payload: unknown; isNew: boolean; actorId: string }
  | { kind: "ks"; id: string; payload: unknown; isNew: boolean; actorId: string }
  | { kind: "day"; id: string; payload: unknown; event: "checkin" | "checkout" | null; actorId: string; name?: string }
  | { kind: "need"; id: string; payload: unknown; isNew: boolean; actorId: string }
  | { kind: "order"; id: string; payload: unknown; isNew: boolean; actorId: string };

type Hook = (ev: YardEvent) => void;
const hooks = new Set<Hook>();
const pending: YardEvent[] = [];

export function onYardEvent(fn: Hook) {
  hooks.add(fn);
  const queued = pending.splice(0, pending.length);
  for (const ev of queued) {
    try {
      fn(ev);
    } catch {
      /* */
    }
  }
  return () => {
    hooks.delete(fn);
  };
}

export function emitYard(ev: YardEvent) {
  if (!hooks.size) {
    pending.push(ev);
    if (pending.length > 80) pending.shift();
    return;
  }
  for (const fn of hooks) {
    try {
      fn(ev);
    } catch {
      /* */
    }
  }
}
