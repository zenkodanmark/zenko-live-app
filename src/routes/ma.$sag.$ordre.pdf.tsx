import { createFileRoute } from "@tanstack/react-router";
import { MaPdfPage, maHead } from "@/components/ma-public";

export const Route = createFileRoute("/ma/$sag/$ordre/pdf")({
  head: ({ params }) => maHead(`MA-${params.ordre} PDF · Zenko`, "Materialebestilling fra Zenko Danmark."),
  component: function MaPdfRoute() {
    const { sag, ordre } = Route.useParams();
    return <MaPdfPage slug={sag} nr={ordre} />;
  },
});
