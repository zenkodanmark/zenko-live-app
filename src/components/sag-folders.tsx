import { Card, SectionLabel } from "@/components/zenko";
import { CloseX } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { DRIVE_FALLBACK, MASTER_SLOTS, driveFolderUrl, driveFor } from "@/lib/drive";
import { useYard } from "@/lib/store";
import type { Lang } from "@/lib/types";

export function FolderWindow({ projectId, lang, onClose }: { projectId: string; lang: Lang; onClose: () => void }) {
  const map = driveFor(projectId);
  const inboxId = useYard((s) => s.inboxFolders[projectId] ?? "");
  const slots = map
    ? MASTER_SLOTS.map((s) => ({
        ...s,
        id: s.slot === "inbox" ? inboxId || map.inbox : map[s.slot],
      })).filter((s) => s.id)
    : [];
  const udbudKids = map ? (DRIVE_FALLBACK[map.udbud] ?? []) : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50" role="dialog">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-title text-sand">{t(lang, "sagFolders")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">
        <Card className="rounded-[20px]">
          <SectionLabel>{t(lang, "sagFolderHint")}</SectionLabel>
          {map?.root ? (
            <a
              className="mb-3 flex min-h-11 items-center justify-between rounded-xl bg-navy px-3 text-sm text-sand"
              href={driveFolderUrl(map.root)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{t(lang, "sagOpenRoot")}</span>
              <span className="text-xs opacity-70">{t(lang, "driveOpen")}</span>
            </a>
          ) : (
            <p className="mb-3 text-sm text-muted">{t(lang, "driveEmpty")}</p>
          )}
          <ul className="space-y-1.5">
            {slots.map((s) => (
              <li key={s.slot}>
                <a
                  className="flex min-h-11 items-center justify-between rounded-xl bg-sand px-3 text-sm"
                  href={driveFolderUrl(s.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{s.slot === "inbox" ? t(lang, "fieldInboxFolder") : s.label}</span>
                  <span className="text-xs text-muted">{t(lang, "driveOpen")}</span>
                </a>
                {s.slot === "udbud" && udbudKids.length ? (
                  <ul className="mt-1 space-y-1 pl-3">
                    {udbudKids.map((k) => (
                      <li key={k.id}>
                        <a
                          className="flex min-h-11 items-center justify-between rounded-lg bg-sand-deep px-3 text-sm"
                          href={k.href ? k.href : k.folder ? driveFolderUrl(k.id) : `https://drive.google.com/file/d/${k.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{k.name}</span>
                          <span className="text-xs text-muted">{t(lang, "driveOpen")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
