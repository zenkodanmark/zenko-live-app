import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagHomeRoute })));

export const Route = createFileRoute("/sag/$slug/")({
  head: ({ params }) => sagHead(`${params.slug} · Byggeledelse · Zenko`, "Byggeledelse fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
