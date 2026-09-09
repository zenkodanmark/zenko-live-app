import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagKsRoute })));

export const Route = createFileRoute("/sag/$slug/ks/$number")({
  head: ({ params }) => sagHead(`KS ${params.number} · Byggeledelse · Zenko`, "Kvalitetssikring fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
