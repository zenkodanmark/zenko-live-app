import { getRouteApi } from "@tanstack/react-router";
import { MaHome, MaLinePage, MaMissing, MaPdfPage, MaReceiptPage } from "@/components/ma-public";
import { isValidMaLineParam } from "@/lib/route-guards";

const maOrdre = getRouteApi("/ma/$sag/$ordre");
const maLinje = getRouteApi("/ma/$sag/$ordre/$linje");

export { MaMissing };

export function MaHomeRoute() {
  const { sag, ordre } = maOrdre.useParams();
  return <MaHome slug={sag} nr={ordre} />;
}
export function MaPdfRoute() {
  const { sag, ordre } = maOrdre.useParams();
  return <MaPdfPage slug={sag} nr={ordre} />;
}
export function MaLinjeRoute() {
  const { sag, ordre, linje } = maLinje.useParams();
  if (!isValidMaLineParam(linje)) return <MaMissing />;
  return <MaLinePage slug={sag} nr={ordre} linje={linje} />;
}
export function MaModtagetRoute() {
  const { sag, ordre } = maOrdre.useParams();
  return <MaReceiptPage slug={sag} nr={ordre} />;
}
