import { createFileRoute, notFound } from "@tanstack/react-router";
import { KundeKomplet } from "@/components/kunde-pages";
import { KundeMissing, kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/ks-customer";
import { useKundeSite } from "@/lib/use-kunde-site";

export const Route = createFileRoute("/kunde/$slug/komplet")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`KS-rapport · ${params.slug} · Zenko`, "Komplet KS-rapport fra Zenko Danmark."),
  component: KundeKompletRoute,
});

function KundeKompletRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing) return <KundeMissing />;
  return <KundeKomplet site={site} />;
}
