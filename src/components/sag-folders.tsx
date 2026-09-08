import { useEffect, useState } from "react";
import { Card, SectionLabel } from "@/components/zenko";
import { CloseX } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { MASTER_SLOTS } from "@/lib/drive";
import { listPladsPrefix } from "@/lib/plads-file";
import type { Lang } from "@/lib/types";

export function FolderWindow({ projectId, lang, onClose }: { projectId: string; lang: Lang; onClose: () => void }) {
  const [slot, setSlot] = useState(MASTER_SLOTS[0]?.slot ?? "ks");
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setBusy(true);
    void listPladsPrefix(`${projectId}/${slot}`).then((rows) => {
      if (!live) return;
      setFiles(rows);
      setBusy(false);
    });
    return () => {
      live = false;
    };
  }, [projectId, slot]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50" role="dialog">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-title text-sand">{t(lang, "sagFolders")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">
        <Card className="rounded-[20px]">
          <SectionLabel>{t(lang, "sagFolderHint")}</SectionLabel>
          <ul className="space-y-1.5">
            {MASTER_SLOTS.map((s) => (
              <li key={s.slot}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm ${slot === s.slot ? "bg-navy text-sand" : "bg-sand"}`}
                  onClick={() => setSlot(s.slot)}
                >
                  <span>{s.slot === "inbox" ? t(lang, "fieldInboxFolder") : s.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1">
            {busy ? <li className="text-sm text-muted">…</li> : null}
            {!busy && !files.length ? <li className="text-sm text-muted">{t(lang, "driveEmpty")}</li> : null}
            {files.map((f) => (
              <li key={f.url}>
                <a
                  className="flex min-h-11 items-center justify-between rounded-lg bg-sand-deep px-3 text-sm"
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted">{t(lang, "driveOpen")}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
