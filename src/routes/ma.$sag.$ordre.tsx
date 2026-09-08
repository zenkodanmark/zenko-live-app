import { Outlet, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { isValidMaNr, publicHead } from "@/lib/route-guards";

const MaMissing = lazy(() => import("@/components/ma-desk").then((m) => ({ default: m.MaMissing })));

export const Route = createFileRoute("/ma/$sag/$ordre")({
  head: ({ params }) => publicHead(`MA ${params.ordre} · Zenko`, "Materialebestilling fra Zenko Danmark.", "#fffaf6"),
  component: function MaOrdreLayout() {
    const { ordre } = Route.useParams();
    if (!isValidMaNr(ordre)) {
      return (
        <Suspense fallback={null}>
          <MaMissing />
        </Suspense>
      );
    }
    return <Outlet />;
  },
});
