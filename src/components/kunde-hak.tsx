import { type MouseEvent, useState } from "react";
import { HakBtn } from "@/components/hak-btn";
import { lookupProject, useYard } from "@/lib/store";
import { slugForProject, snapshotKundeReport } from "@/lib/ks-customer";
import { setKundeReportStatus } from "@/lib/ks-customer.functions";
import { softrKsPhotos } from "@/lib/softr-ks";
import { t } from "@/lib/i18n";
import type { Entrepreneur, KsReport, Lang, Tf } from "@/lib/types";

type KundeHakKind = "ks" | "tf" | "er";

function storeKindOf(kind: KundeHakKind) {
  if (kind === "tf") return "tf" as const;
  if (kind === "er") return "ent" as const;
  return "ks" as const;
}

export function KundeHak({
  kind = "ks",
  report,
  lang,
}: {
  kind?: KundeHakKind;
  report: KsReport | Tf | Entrepreneur;
  lang: Lang;
}) {
  const setReportKunde = useYard((s) => s.setReportKunde);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const storeKind = storeKindOf(kind);
  const live = useYard((s) => {
    if (storeKind === "tf") return s.tfs.find((x) => x.id === report.id);
    if (storeKind === "ent") return s.ents.find((x) => x.id === report.id);
    return s.ksReports.find((x) => x.id === report.id);
  }) ?? report;
  const on = live.kundeStatus === "med_til_kunden";
  const [busy, setBusy] = useState(false);

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const ok = await setReportKunde(storeKind, live.id);
    if (ok && kind === "ks") {
      const ks = live as KsReport;
      const next = ks.kundeStatus === "med_til_kunden" ? "skjult" : "med_til_kunden";
      const job = lookupProject(ks.projectId);
      const photos = [...softrKsPhotos(), ...drivePhotos];
      const payload = snapshotKundeReport({ ...ks, kundeStatus: next }, job, photos);
      void setKundeReportStatus({
        data: {
          slug: slugForProject(job),
          projectId: job.id,
          reportId: ks.id,
          status: next,
          payload,
        },
      });
    }
    setBusy(false);
  }

  return (
    <HakBtn
      on={on}
      busy={busy}
      label={t(lang, "hakKunde")}
      onClick={toggle}
      title={t(lang, on ? "kundeHakOn" : "kundeHakOff")}
      data-kunde={on ? "on" : "off"}
      data-testid={`kunde-hak-${report.number}`}
    />
  );
}
