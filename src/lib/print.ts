import { FIRM, FIRM_CVR, FIRM_LINE, FIRM_MAIL } from "./seed";
import { useYard } from "./store";

/** @deprecated Hash-links til /mester#id. Brug ReportShareBar. */
export function copyDocLink(_id: string) {
  useYard.getState().notSent();
}

export function printDoc() {
  window.print();
  useYard.getState().notSent();
}

export const LETTERHEAD = {
  firm: FIRM,
  line: FIRM_LINE,
  mail: FIRM_MAIL,
  cvr: `CVR ${FIRM_CVR}`,
  mark: "ZENKO DANMARK",
};
