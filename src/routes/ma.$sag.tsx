import { Outlet, createFileRoute } from "@tanstack/react-router";
import { MaMissing, maHead } from "@/components/ma-public";
import { isValidMaSlug } from "@/lib/ma-public";

export const Route = createFileRoute("/ma/$sag")({
  head: () => maHead("Materialebestilling · Zenko", "Materialebestilling fra Zenko Danmark."),
  component: MaSagLayout,
});

function MaSagLayout() {
  const { sag } = Route.useParams();
  if (!isValidMaSlug(sag)) return <MaMissing />;
  return <Outlet />;
}
