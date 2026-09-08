import { createFileRoute } from "@tanstack/react-router";
import { SagTfPage } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/tf/$number")({
  head: ({ params }) => sagHead(`TF ${params.number} · Byggeledelse · Zenko`, "Teknisk forespørgsel fra Zenko Danmark."),
  component: SagTfRoute,
});

function SagTfRoute() {
  const { slug, number } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagTfPage site={site} number={number} />;
}
