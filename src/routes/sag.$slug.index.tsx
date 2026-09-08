import { createFileRoute } from "@tanstack/react-router";
import { SagHome } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/")({
  head: ({ params }) => sagHead(`${params.slug} · Byggeledelse · Zenko`, "Byggeledelse fra Zenko Danmark."),
  component: SagHomeRoute,
});

function SagHomeRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagHome site={site} />;
}
