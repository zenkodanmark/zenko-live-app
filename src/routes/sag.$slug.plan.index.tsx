import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagPlanRoute })));

export const Route = createFileRoute("/sag/$slug/plan/")({
  head: ({ params }) => sagHead(`Plan · ${params.slug} · Zenko`, "Plan fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
