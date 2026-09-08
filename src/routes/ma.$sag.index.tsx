import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { publicHead } from "@/lib/route-guards";

const MaMissing = lazy(() => import("@/components/ma-desk").then((m) => ({ default: m.MaMissing })));

export const Route = createFileRoute("/ma/$sag/")({
  head: () => publicHead("Siden findes ikke · Zenko", "Materialebestilling fra Zenko Danmark.", "#fffaf6"),
  component: () => (
    <Suspense fallback={null}>
      <MaMissing />
    </Suspense>
  ),
});
