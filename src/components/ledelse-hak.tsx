import { type MouseEvent } from "react";
import { lookupProject, useYard } from "@/lib/store";
import { slugForProject } from "@/lib/ks-customer";
import { defaultLedelseStatus } from "@/lib/sag-ledelse-defaults";
import { setSagLedelseItem } from "@/lib/sag-ledelse.functions";
import { t } from "@/lib/i18n";
import type { Entrepreneur, Lang, Offer, Slip, Tf } from "@/lib/types";

export function LedelseHak({
  kind,
  report,
  lang,
}: {
  kind: "tf" | "as" | "tb" | "er";
  report: Tf | Slip | Offer | Entrepreneur;
  lang: Lang;
}) {
  const patchReport = useYard((s) => s.patchReport);
  const resolved = report.ledelseStatus ?? defaultLedelseStatus(kind, report.number);
  const on = resolved === "med_til_ledelse";
  const storeKind = kind === "as" ? "slip" : kind === "tb" ? "offer" : kind === "er" ? "ent" : "tf";

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const next = on ? "skjult" : "med_til_ledelse";
    patchReport(storeKind, report.id, { ledelseStatus: next });
    const job = lookupProject(report.projectId);
    void setSagLedelseItem({
      data: {
        slug: slugForProject(job),
        projectId: job.id,
        kind,
        reportId: report.id,
        status: next,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`shrink-0 rounded-full px-3 py-1.5 text-action font-medium ${on ? "bg-moss text-sand" : "bg-paper text-ink"}`}
      title={t(lang, on ? "ledelseHakOn" : "ledelseHakOff")}
      data-ledelse={on ? "on" : "off"}
    >
      {t(lang, "ledelseHak")}
    </button>
  );
}
