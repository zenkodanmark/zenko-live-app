import { type MouseEvent } from "react";
import { useYard } from "@/lib/store";
import { defaultLedelseStatus } from "@/lib/sag-ledelse-defaults";
import { t } from "@/lib/i18n";
import type { Entrepreneur, Lang, Offer, Slip, Tf } from "@/lib/types";

type HakKind = "tf" | "as" | "tb" | "er";

function storeKindOf(kind: HakKind) {
  if (kind === "as") return "slip" as const;
  if (kind === "tb") return "offer" as const;
  if (kind === "er") return "ent" as const;
  return "tf" as const;
}

export function LedelseHak({
  kind,
  report,
  lang,
}: {
  kind: HakKind;
  report: Tf | Slip | Offer | Entrepreneur;
  lang: Lang;
}) {
  const patchReport = useYard((s) => s.patchReport);
  const storeKind = storeKindOf(kind);
  const live = useYard((s) => {
    if (storeKind === "tf") return s.tfs.find((x) => x.id === report.id);
    if (storeKind === "slip") return s.slips.find((x) => x.id === report.id);
    if (storeKind === "offer") return (s.offers ?? []).find((x) => x.id === report.id);
    return s.ents.find((x) => x.id === report.id);
  });
  const resolved = live?.ledelseStatus ?? report.ledelseStatus ?? defaultLedelseStatus(kind, report.number);
  const on = resolved === "med_til_ledelse";

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const next = on ? "skjult" : "med_til_ledelse";
    patchReport(storeKind, report.id, { ledelseStatus: next, updatedAt: new Date().toISOString() });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`shrink-0 rounded-full px-3 py-1.5 text-action font-medium ${on ? "bg-moss text-sand" : "bg-paper text-ink"}`}
      title={t(lang, on ? "ledelseHakOn" : "ledelseHakOff")}
      data-ledelse={on ? "on" : "off"}
      data-testid={`ledelse-hak-${report.number}`}
    >
      {t(lang, "ledelseHak")}
    </button>
  );
}