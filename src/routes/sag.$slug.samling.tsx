import { createFileRoute } from "@tanstack/react-router";
import { SagSamling } from "@/components/sag-pages";
import { SagMissing, sagHead } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug/samling")({
  validateSearch: (search: Record<string, unknown>) => ({
    n: typeof search.n === "string" ? search.n : "",
  }),
  head: ({ params }) => sagHead(`Aftalesedler · ${params.slug} · Zenko`, "Samling af aftalesedler fra Zenko Danmark."),
  component: SagSamlingRoute,
});

function SagSamlingRoute() {
  const { slug } = Route.useParams();
  const { n } = Route.useSearch();
  const { site, missing } = useSagSite(slug);
  if (missing) return <SagMissing />;
  const numbers = n.split(",").map((x) => x.trim()).filter(Boolean);
  return <SagSamling site={site} numbers={numbers} />;
}
