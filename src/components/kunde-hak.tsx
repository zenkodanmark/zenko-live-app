import { type MouseEvent } from "react";
import { lookupProject, useYard } from "@/lib/store";
import { slugForProject, snapshotKundeReport } from "@/lib/ks-customer";
import { setKundeReportStatus } from "@/lib/ks-customer.functions";
import { softrKsPhotos } from "@/lib/softr-ks";
import { t } from "@/lib/i18n";
import type { KsReport, Lang } from "@/lib/types";

export function KundeHak({ report, lang }: { report: KsReport; lang: Lang }) {
  const patchReport = useYard((s) => s.patchReport);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const on = report.kundeStatus === "med_til_kunden";

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const next = on ? "skjult" : "med_til_kunden";
    patchReport("ks", report.id, { kundeStatus: next });
    const job = lookupProject(report.projectId);
    const photos = [...softrKsPhotos(), ...drivePhotos];
    const payload = snapshotKundeReport({ ...report, kundeStatus: next }, job, photos);
    void setKundeReportStatus({
      data: {
        slug: slugForProject(job),
        projectId: job.id,
        reportId: report.id,
        status: next,
        payload,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`shrink-0 rounded-full px-3 py-1.5 text-action font-medium ${on ? "bg-moss text-sand" : "bg-paper text-ink"}`}
      title={t(lang, on ? "kundeHakOn" : "kundeHakOff")}
      data-kunde={on ? "on" : "off"}
    >
      {t(lang, "kundeHak")}
    </button>
  );
}
