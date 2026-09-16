import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { SagPinGate } from "@/components/sag-pin";
import { SagMissing } from "@/components/sag-shell";
import { isKundeSlug } from "@/lib/route-guards";
import { useSagSite } from "@/lib/use-sag-site";

export const Route = createFileRoute("/sag/$slug")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  component: function SagLayout() {
    const { slug } = Route.useParams();
    const { site, missing } = useSagSite(slug);
    if (missing || !site) return <SagMissing />;
    return (
      <SagPinGate slug={slug} projectId={site.job.projectId}>
        <Outlet />
      </SagPinGate>
    );
  },
});