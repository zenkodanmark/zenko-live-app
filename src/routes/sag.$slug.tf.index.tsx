import { createFileRoute } from "@tanstack/react-router";
import { SagTfList } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/tf/")({
  head: ({ params }) => sagHead(`Tekniske forespørgsler · ${params.slug} · Zenko`, "Tekniske forespørgsler fra Zenko Danmark."),
  component: SagTfListRoute,
});

function SagTfListRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagTfList site={site} />;
}
