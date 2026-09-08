import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagErListRoute })));

export const Route = createFileRoute("/sag/$slug/er/")({
  head: ({ params }) => sagHead(`Entreprenørrapporter · ${params.slug} · Zenko`, "Entreprenørrapporter fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
