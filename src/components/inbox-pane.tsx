import { FileUp, Film } from "lucide-react";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { CLASS_TO_SLOT, driveFolderUrl, driveFileUrl, slotFolderId } from "@/lib/drive";
import { placeFieldInSlot } from "@/lib/drive.functions";
import { t } from "@/lib/i18n";
import { copenhagenTime } from "@/lib/seed";
import { useSessionEmployee, useYard } from "@/lib/store";
import type { FieldItem, InboxClass, Lang } from "@/lib/types";

const CLASSES: InboxClass[] = ["materials", "extra", "tf", "ent"];

function classLabel(lang: Lang, k: InboxClass) {
  if (k === "materials") return t(lang, "fieldAsMaterials");
  if (k === "extra") return t(lang, "fieldAsExtra");
  if (k === "tf") return t(lang, "fieldAsTf");
  return t(lang, "fieldAsEnt");
}

export function InboxPane({ lang, projectId, compact }: { lang: Lang; projectId?: string; compact?: boolean }) {
  const emp = useSessionEmployee();
  const fieldItems = useYard((s) => s.fieldItems);
  const inboxFolders = useYard((s) => s.inboxFolders);
  const classifyFieldItem = useYard((s) => s.classifyFieldItem);
  const patchFieldItem = useYard((s) => s.patchFieldItem);
  const rows = fieldItems.filter((f) => (!projectId || f.projectId === projectId));
  const pending = rows.filter((f) => f.status === "inbox");
  const done = rows.filter((f) => f.status === "classified").slice(0, compact ? 3 : 12);
  const folderId = projectId ? inboxFolders[projectId] || slotFolderId(projectId, "inbox") : "";

  function classify(item: FieldItem, kind: InboxClass) {
    if (!emp) return;
    const res = classifyFieldItem(item.id, kind, emp.id);
    const slot = CLASS_TO_SLOT[kind];
    void placeFieldInSlot({
      data: {
        projectId: item.projectId,
        classifiedAs: kind,
        name: item.name,
        note: item.note,
        employeeName: item.employeeName,
        reportNumber: res.reportNumber,
      },
    }).then((r) => {
      if (r.ok) {
        patchFieldItem(item.id, {
          driveFolderId: r.folderId || slotFolderId(item.projectId, slot),
          driveFileId: r.fileId || item.driveFileId,
          driveUrl: r.fileId ? driveFileUrl(r.fileId) : item.driveUrl,
        });
      }
    });
  }

  return (
    <Card className="rounded-[20px]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <SectionLabel>{t(lang, "fieldInbox")}</SectionLabel>
          <p className="text-sm leading-relaxed text-muted">{t(lang, "fieldInboxHint")}</p>
        </div>
        {pending.length ? <Chip tone="brick">{t(lang, "fieldCount", { n: pending.length })}</Chip> : null}
      </div>
      {folderId ? (
        <a className="mb-3 inline-flex min-h-10 items-center text-xs text-navy" href={driveFolderUrl(folderId)} target="_blank" rel="noreferrer">
          {t(lang, "fieldOpenDrive")} · {t(lang, "fieldInboxFolder")}
        </a>
      ) : null}
      {pending.length === 0 ? <p className="text-sm text-muted">{t(lang, "fieldNoPending")}</p> : null}
      <ul className="space-y-3">
        {pending.map((it) => (
          <InboxRow key={it.id} item={it} lang={lang} onClass={classify} />
        ))}
      </ul>
      {done.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <SectionLabel>{t(lang, "fieldClassified")}</SectionLabel>
          <ul className="space-y-1.5">
            {done.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-xl bg-sand px-3 py-2">
                {it.dataUrl ? <img src={it.dataUrl} alt="" className="size-10 rounded-lg object-cover" /> : <FileUp className="size-4 text-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{it.name}</p>
                  <p className="text-xs text-muted">
                    {it.employeeName} · {it.projectName}
                  </p>
                </div>
                <Chip tone="ok">{it.classifiedAs ? classLabel(lang, it.classifiedAs) : t(lang, "fieldClassified")}</Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function InboxRow({ item, lang, onClass }: { item: FieldItem; lang: Lang; onClass: (item: FieldItem, kind: InboxClass) => void }) {
  return (
    <li className="rounded-xl bg-sand px-3 py-3">
      <div className="flex gap-3">
        {item.dataUrl ? (
          <img src={item.dataUrl} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-paper text-muted">
            {item.kind === "video" ? <Film className="size-6" /> : <FileUp className="size-6" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-navy">{item.kind === "photo" ? t(lang, "fieldPhoto") : item.kind === "video" ? t(lang, "fieldVideo") : t(lang, "fieldFile")}</p>
          <p className="truncate text-sm">{item.name}</p>
          <p className="text-xs text-muted">
            {t(lang, "fieldFrom", { name: item.employeeName })} · {item.projectName} · {copenhagenTime(item.takenAt)}
          </p>
          {item.note ? <p className="mt-1 text-sm leading-relaxed">{item.note}</p> : null}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">{t(lang, "fieldDecide")}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {CLASSES.map((k) => (
          <GhostButton key={k} className="bg-paper text-xs" onClick={() => onClass(item, k)}>
            {classLabel(lang, k)}
          </GhostButton>
        ))}
      </div>
    </li>
  );
}

export function FieldAttach({
  lang,
  projectId,
  kind,
  reportId,
  attachedIds,
}: {
  lang: Lang;
  projectId: string;
  kind: "slip" | "tf" | "ent";
  reportId: string;
  attachedIds: string[];
}) {
  const fieldItems = useYard((s) => s.fieldItems);
  const attachFieldToReport = useYard((s) => s.attachFieldToReport);
  const match: InboxClass = kind === "slip" ? "extra" : kind === "tf" ? "tf" : "ent";
  const pool = fieldItems.filter((f) => f.projectId === projectId && f.status === "classified" && f.classifiedAs === match);
  const attached = new Set(attachedIds);
  if (pool.length === 0) return <p className="mt-3 text-xs text-muted">{t(lang, "fieldNoneClass")}</p>;
  return (
    <div className="mt-3 rounded-xl bg-sand px-3 py-3">
      <SectionLabel>{t(lang, "fieldPull")}</SectionLabel>
      <ul className="space-y-1.5">
        {pool.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            {it.dataUrl ? <img src={it.dataUrl} alt="" className="size-9 rounded object-cover" /> : <FileUp className="size-4 text-muted" />}
            <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
            {attached.has(it.id) ? (
              <Chip tone="ok">{t(lang, "fieldAttached")}</Chip>
            ) : (
              <PrimaryButton className="w-auto px-3" onClick={() => attachFieldToReport(kind, reportId, [it.id])}>
                {t(lang, "fieldAttach")}
              </PrimaryButton>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
