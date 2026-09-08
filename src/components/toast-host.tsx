import { useEffect } from "react";
import { NotifyBridge } from "@/components/notice-bell";
import { registerPushWorker } from "@/components/push-setup";
import { YardSyncHost } from "@/components/yard-sync";
import { useYard } from "@/lib/store";

export function ToastHost() {
  const toast = useYard((s) => s.toast);
  const clear = useYard((s) => s.clearToast);
  useEffect(() => {
    void registerPushWorker();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(clear, 3200);
    return () => window.clearTimeout(id);
  }, [toast, clear]);
  return (
    <>
      <NotifyBridge />
      <YardSyncHost />
      {toast ? (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl bg-navy px-4 py-3 text-center text-sm font-medium text-sand shadow-card">
          {toast}
        </div>
      ) : null}
    </>
  );
}
