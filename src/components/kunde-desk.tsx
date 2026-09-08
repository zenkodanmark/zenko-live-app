import { getRouteApi } from "@tanstack/react-router";
import { KundeHandbook, KundeHome, KundeKomplet, KundePunkt, KundeRapport } from "@/components/kunde-pages";
import { KundeMissing } from "@/components/kunde-shell";
import { useKundeSite } from "@/lib/use-kunde-site";

const kundeIndex = getRouteApi("/kunde/$slug/");
const kundeParent = getRouteApi("/kunde/$slug");
const kundePunkt = getRouteApi("/kunde/$slug/$punkt/");
const kundeRapport = getRouteApi("/kunde/$slug/$punkt/$rapport");

export function KundeHomeRoute() {
  const { slug } = kundeIndex.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing || !site) return <KundeMissing />;
  return <KundeHome site={site} />;
}
export function KundePunktRoute() {
  const { slug, punkt } = kundePunkt.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing || !site) return <KundeMissing />;
  return <KundePunkt site={site} code={punkt} />;
}
export function KundeRapportRoute() {
  const { slug, punkt, rapport } = kundeRapport.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing || !site) return <KundeMissing />;
  return <KundeRapport site={site} code={punkt} pad={rapport} />;
}
export function KundeHandbookRoute() {
  const { slug } = kundeParent.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing || !site) return <KundeMissing />;
  return <KundeHandbook site={site} />;
}
export function KundeKompletRoute() {
  const { slug } = kundeParent.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing || !site) return <KundeMissing />;
  return <KundeKomplet site={site} />;
}
