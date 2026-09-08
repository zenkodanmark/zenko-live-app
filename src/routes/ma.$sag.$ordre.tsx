import { Outlet, createFileRoute } from "@tanstack/react-router";
import { MaMissing, maHead } from "@/components/ma-public";
import { isValidMaNr } from "@/lib/ma-public";

export const Route = createFileRoute("/ma/$sag/$ordre")({
  head: ({ params }) => maHead(`MA ${params.ordre} · Zenko`, "Materialebestilling fra Zenko Danmark."),
  component: MaOrdreLayout,
});

function MaOrdreLayout() {
  const { ordre } = Route.useParams();
  if (!isValidMaNr(ordre)) return <MaMissing />;
  return <Outlet />;
}
