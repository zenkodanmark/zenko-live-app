import { useState, type MouseEvent } from "react";
import { PrimaryButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { savePdfKindFromReport, saveReportPdf, type SavePdfKind } from "@/lib/save-pdf";
import type { Lang } from "@/lib/types";
import { useYard } from "@/lib/store";

export function SavePdfButton({
  kind,
  id,
  lang = "da",
  chip,
}: {
  kind: SavePdfKind;
  id: string;
  lang?: Lang;
  chip?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function run(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const res = await saveReportPdf(kind, id);
    setBusy(false);
    useYard.setState({ toast: res.ok ? "PDF gemt." : res.error || "Kunne ikke lave PDF" });
  }

  if (chip) {
    return (
      <button
        type="button"
        className="shrink-0 rounded-full bg-brick px-3 py-1.5 text-action font-medium text-sand disabled:opacity-60"
        data-testid={`save-pdf-chip-${kind}-${id}`}
        disabled={busy}
        onClick={(e) => void run(e)}
      >
        {busy ? "…" : "PDF"}
      </button>
    );
  }

  return (
    <PrimaryButton
      className="w-auto px-5"
      data-testid={`save-pdf-${kind}-${id}`}
      disabled={busy}
      onClick={(e) => void run(e)}
    >
      {busy ? "…" : t(lang, "kundePdf")}
    </PrimaryButton>
  );
}

export function SavePdfForReport({
  kind,
  id,
  lang,
  chip,
}: {
  kind: "slip" | "offer" | "tf" | "ent" | "todo";
  id: string;
  lang?: Lang;
  chip?: boolean;
}) {
  return <SavePdfButton kind={savePdfKindFromReport(kind)} id={id} lang={lang} chip={chip} />;
}
