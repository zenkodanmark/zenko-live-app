import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { publicHead } from "@/lib/route-guards";

const Inner = lazy(() => import("@/components/ma-desk").then((m) => ({ default: m.MaPdfRoute })));

export const Route = createFileRoute("/ma/$sag/$ordre/pdf")({
  head: ({ params }) => publicHead(`MA-${params.ordre} PDF · Zenko`, "Materialebestilling fra Zenko Danmark.", "#fffaf6"),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
