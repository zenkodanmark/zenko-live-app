import { createFileRoute } from "@tanstack/react-router";
import { MaReceiptPage, maHead } from "@/components/ma-public";

export const Route = createFileRoute("/ma/$sag/$ordre/modtaget")({
  head: ({ params }) => maHead(`Modtagekontrol MA-${params.ordre} · Zenko`, "Modtagekontrol fra Zenko Danmark."),
  component: function MaModtagetRoute() {
    const { sag, ordre } = Route.useParams();
    return <MaReceiptPage slug={sag} nr={ordre} />;
  },
});
