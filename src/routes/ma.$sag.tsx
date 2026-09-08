import { Outlet, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { isValidMaSlug, publicHead } from "@/lib/route-guards";

const MaMissing = lazy(() => import("@/components/ma-desk").then((m) => ({ default: m.MaMissing })));

export const Route = createFileRoute("/ma/$sag")({
  head: () => publicHead("Materialebestilling · Zenko", "Materialebestilling fra Zenko Danmark.", "#fffaf6"),
  component: function MaSagLayout() {
    const { sag } = Route.useParams();
    if (!isValidMaSlug(sag)) {
      return (
        <Suspense fallback={null}>
          <MaMissing />
        </Suspense>
      );
    }
    return <Outlet />;
  },
});
