import { createFileRoute } from "@tanstack/react-router";
import { SagAsList } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/as/")({
  head: ({ params }) => sagHead(`Aftalesedler · ${params.slug} · Zenko`, "Aftalesedler fra Zenko Danmark."),
  component: SagAsListRoute,
});

function SagAsListRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagAsList site={site} />;
}
