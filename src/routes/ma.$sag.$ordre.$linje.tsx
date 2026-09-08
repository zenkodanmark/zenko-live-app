import { createFileRoute } from "@tanstack/react-router";
import { MaLinePage, MaMissing, maHead } from "@/components/ma-public";
import { isValidMaLineParam } from "@/lib/ma-public";

export const Route = createFileRoute("/ma/$sag/$ordre/$linje")({
  head: ({ params }) => maHead(`MA-${params.ordre} linje ${params.linje} · Zenko`, "Materialebestilling fra Zenko Danmark."),
  component: function MaLinjeRoute() {
    const { sag, ordre, linje } = Route.useParams();
    if (!isValidMaLineParam(linje)) return <MaMissing />;
    return <MaLinePage slug={sag} nr={ordre} linje={linje} />;
  },
});
