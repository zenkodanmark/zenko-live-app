import { snapshotYardToAdmin } from "./drive.functions";
import { yardSnapshotJson } from "./snapshot";
import { useYard } from "./store";

let timer: ReturnType<typeof setTimeout> | null = null;
let last = "";
let inflight = false;

export function queueAdminSnapshot() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flushAdminSnapshot();
  }, 10000);
}

export async function flushAdminSnapshot() {
  if (typeof window === "undefined" || inflight) return;
  const snap = useYard.getState();
  const json = yardSnapshotJson(snap);
  if (json === last) return;
  inflight = true;
  try {
    const res = await snapshotYardToAdmin({ data: { at: new Date().toISOString(), json } });
    if (res.ok) last = json;
  } catch {
    /* Drive kan vente */
  } finally {
    inflight = false;
  }
}
