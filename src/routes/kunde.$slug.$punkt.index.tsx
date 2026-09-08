import { createFileRoute } from "@tanstack/react-router";
import { KundePunkt } from "@/components/kunde-pages";
import { KundeMissing, kundeHead } from "@/components/kunde-shell";
import { useKundeSite } from "@/lib/use-kunde-site";

export const Route = createFileRoute("/kunde/$slug/$punkt/")({
  head: ({ params }) => kundeHead(`${params.punkt} · ${params.slug} · Zenko`, "Bygningsdel i kvalitetssikringen fra Zenko Danmark."),
  component: KundePunktRoute,
});

function KundePunktRoute() {
  const { slug, punkt } = Route.useParams();
  const { site, missing } = useKundeSite(slug);
  if (missing) return <KundeMissing />;
  return <KundePunkt site={site} code={punkt} />;
}
