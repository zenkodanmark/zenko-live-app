import { createFileRoute } from "@tanstack/react-router";
import { KundeHome } from "@/components/kunde-pages";
import { KundeMissing, kundeHead } from "@/components/kunde-shell";
import { useKundeSite } from "@/lib/use-kunde-site";

export const Route = createFileRoute("/kunde/$slug/")({
  head: ({ params }) => kundeHead(`${params.slug} · KS · Zenko`, "Kvalitetssikring fra Zenko Danmark."),
  component: KundeHomeRoute,
});

function KundeHomeRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing) return <KundeMissing />;
  return <KundeHome site={site} />;
}
