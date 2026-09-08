import { createFileRoute, notFound } from "@tanstack/react-router";
import { KundeHandbook } from "@/components/kunde-pages";
import { KundeMissing, kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/ks-customer";
import { useKundeSite } from "@/lib/use-kunde-site";

export const Route = createFileRoute("/kunde/$slug/haandbog")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`Håndbog · ${params.slug} · Zenko`, "Kvalitetssikringshåndbog fra Zenko Danmark."),
  component: KundeHandbookRoute,
});

function KundeHandbookRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing) return <KundeMissing />;
  return <KundeHandbook site={site} />;
}
