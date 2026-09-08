import { createFileRoute } from "@tanstack/react-router";
import { MaHome, maHead } from "@/components/ma-public";

export const Route = createFileRoute("/ma/$sag/$ordre/")({
  head: ({ params }) => maHead(`MA-${params.ordre} · Zenko`, "Materialebestilling fra Zenko Danmark."),
  component: function MaHomeRoute() {
    const { sag, ordre } = Route.useParams();
    return <MaHome slug={sag} nr={ordre} />;
  },
});
