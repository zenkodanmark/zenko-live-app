import { createFileRoute, notFound } from "@tanstack/react-router";
import { KundeRapport } from "@/components/kunde-pages";
import { KundeMissing, kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/ks-customer";
import { useKundeSite } from "@/lib/use-kunde-site";

export const Route = createFileRoute("/kunde/$slug/$punkt/$rapport")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`Rapport ${params.rapport} · ${params.slug} · Zenko`, "Proceskontrol fra Zenko Danmark."),
  component: KundeRapportRoute,
});

function KundeRapportRoute() {
  const { slug, punkt, rapport } = Route.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing) return <KundeMissing />;
  return <KundeRapport site={site} code={punkt} pad={rapport} />;
}
