import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagTfRoute })));

export const Route = createFileRoute("/sag/$slug/tf/$number")({
  head: ({ params }) => sagHead(`TF ${params.number} · Byggeledelse · Zenko`, "Teknisk forespørgsel fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
