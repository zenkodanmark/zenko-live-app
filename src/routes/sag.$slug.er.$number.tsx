import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagErRoute })));

export const Route = createFileRoute("/sag/$slug/er/$number")({
  head: ({ params }) => sagHead(`ER ${params.number} · Byggeledelse · Zenko`, "Entreprenørrapport fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
