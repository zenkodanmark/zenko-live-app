import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagSamlingRoute })));

export const Route = createFileRoute("/sag/$slug/samling")({
  validateSearch: (search: Record<string, unknown>) => ({
    n: typeof search.n === "string" ? search.n : "",
  }),
  head: ({ params }) => sagHead(`Aftalesedler · ${params.slug} · Zenko`, "Samling af aftalesedler fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
