import { createFileRoute } from "@tanstack/react-router";
import { SagErList } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/er/")({
  head: ({ params }) => sagHead(`Entreprenørrapporter · ${params.slug} · Zenko`, "Entreprenørrapporter fra Zenko Danmark."),
  component: SagErListRoute,
});

function SagErListRoute() {
  const { slug } = Route.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  return <SagErList site={site} />;
}
