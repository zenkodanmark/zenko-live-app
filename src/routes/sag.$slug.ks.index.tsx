import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagKsListRoute })));

export const Route = createFileRoute("/sag/$slug/ks/")({
  head: ({ params }) => sagHead(`KS · ${params.slug} · Zenko`, "Kvalitetssikring fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
