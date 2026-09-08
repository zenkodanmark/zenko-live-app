import { createFileRoute } from "@tanstack/react-router";
import { SagErPage } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/er/$number")({
  head: ({ params }) => sagHead(`ER ${params.number} · Byggeledelse · Zenko`, "Entreprenørrapport fra Zenko Danmark."),
  component: SagErRoute,
});

function SagErRoute() {
  const { slug, number } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagErPage site={site} number={number} />;
}
