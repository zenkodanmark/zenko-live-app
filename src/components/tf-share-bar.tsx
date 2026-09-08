import { ReportShareBar, TfShareChip } from "@/components/report-share-bar";
import type { Lang, Tf } from "@/lib/types";

export { TfShareChip };

export function TfShareBar({ tf, lang }: { tf: Tf; lang: Lang }) {
  return <ReportShareBar kind="tf" id={tf.id} lang={lang} />;
}
