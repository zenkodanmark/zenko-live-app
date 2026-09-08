import { useEffect, useRef } from "react";
import { flushAdminSnapshot, queueAdminSnapshot } from "@/lib/admin-backup";
import { pushSoftrPhotoBatch } from "@/lib/drive.functions";
import { driveFor, driveMapIncomplete } from "@/lib/drive";
import { attachSagDrive, flushLocalKsPhotos } from "@/lib/sag-drive";
import { useYard } from "@/lib/store";

export function LiveDriveBootstrap() {
  const projects = useYard((s) => s.projects);
  const projectKey = projects.map((p) => p.id).join(",");
  const triedAt = useRef(new Map<string, number>());
  const softrRan = useRef(false);

  useEffect(() => {
    let stop = false;
    const begin = window.setTimeout(() => {
      void (async () => {
        const now = Date.now();
        for (const p of projects) {
          if (stop) return;
          const known = driveFor(p.id) ?? useYard.getState().driveMaps?.[p.id];
          if (!driveMapIncomplete(known)) continue;
          const last = triedAt.current.get(p.id) ?? 0;
          if (now - last < 20_000) continue;
          triedAt.current.set(p.id, now);
          try {
            const res = await attachSagDrive(p.id, p.name);
            if (!res.ok) triedAt.current.delete(p.id);
            if (res.loginRequired) return;
          } catch {
            triedAt.current.delete(p.id);
            useYard.setState({ toast: `Drive: kunne ikke oprette ${p.name}` });
          }
        }
        if (stop) return;
        try {
          await flushLocalKsPhotos();
        } catch {
          /* toast i flush */
        }
        if (softrRan.current) return;
        softrRan.current = true;
        if (!stop) await flushAdminSnapshot();
        await new Promise((r) => window.setTimeout(r, 8000));
        if (stop) return;
        const { softrDriveJobs, softrKsDriveJobs } = await import("@/lib/softr-drive-push");
        async function drain(key: string, jobs: { folderId: string; name: string; rel: string }[]) {
          let i = Number(window.localStorage.getItem(key) || "0");
          while (!stop && i < jobs.length) {
            const slice = jobs.slice(i, i + 4);
            try {
              const res = await pushSoftrPhotoBatch({ data: { items: slice } });
              if (res.loginRequired) return true;
              i += slice.length;
              window.localStorage.setItem(key, String(i));
            } catch {
              return true;
            }
          }
          return false;
        }
        if (await drain("zenko-softr-ks-drive-i", softrKsDriveJobs())) return;
        await drain("zenko-softr-drive-i", softrDriveJobs().filter((j) => j.kind !== "KS"));
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
    const driveTick = window.setInterval(() => {
      const snap = useYard.getState();
      for (const p of snap.projects) {
        const known = driveFor(p.id) ?? snap.driveMaps?.[p.id];
        if (driveMapIncomplete(known)) {
          void attachSagDrive(p.id, p.name).then((res) => {
            if (res.loginRequired) return;
          });
          break;
        }
      }
    }, 45_000);
    return () => {
      unsub();
      window.clearInterval(tick);
      window.clearInterval(driveTick);
    };
  }, []);
  return null;
}