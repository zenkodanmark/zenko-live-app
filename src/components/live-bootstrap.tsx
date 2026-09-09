import { useEffect, useRef } from "react";
import { flushAdminSnapshot, queueAdminSnapshot } from "@/lib/admin-backup";
import { flushLocalKsPhotos } from "@/lib/sag-drive";
import { useYard } from "@/lib/store";

export function LiveDriveBootstrap() {
  const projects = useYard((s) => s.projects);
  const projectKey = projects.map((p) => p.id).join(",");
  const softrRan = useRef(false);

  useEffect(() => {
    let stop = false;
    const begin = window.setTimeout(() => {
      void (async () => {
        try {
          await flushLocalKsPhotos();
        } catch {
          /* */
        }
        if (softrRan.current || stop) return;
        softrRan.current = true;
        await flushAdminSnapshot();
      })();
    }, 2500);
    return () => {
      stop = true;
      window.clearTimeout(begin);
    };
  }, [projectKey, projects]);

  useEffect(() => {
    const unsub = useYard.subscribe(() => queueAdminSnapshot());
    const tick = window.setInterval(() => void flushAdminSnapshot(), 5 * 60_000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
  }, []);
  return null;
}