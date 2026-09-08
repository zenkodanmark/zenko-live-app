import { createFileRoute } from "@tanstack/react-router";
import { SagAsPage } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/as/$number")({
  head: ({ params }) => sagHead(`AS ${params.number} · Byggeledelse · Zenko`, "Aftaleseddel fra Zenko Danmark."),
  component: SagAsRoute,
});

function SagAsRoute() {
  const { slug, number } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagAsPage site={site} number={number} />;
}
