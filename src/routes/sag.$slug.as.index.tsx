import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagAsListRoute })));

export const Route = createFileRoute("/sag/$slug/as/")({
  head: ({ params }) => sagHead(`Aftalesedler · ${params.slug} · Zenko`, "Aftalesedler fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
