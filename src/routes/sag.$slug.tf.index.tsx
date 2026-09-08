import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagTfListRoute })));

export const Route = createFileRoute("/sag/$slug/tf/")({
  head: ({ params }) => sagHead(`Tekniske forespørgsler · ${params.slug} · Zenko`, "Tekniske forespørgsler fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
