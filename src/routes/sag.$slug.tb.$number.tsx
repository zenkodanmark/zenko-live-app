import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagTbRoute })));

export const Route = createFileRoute("/sag/$slug/tb/$number")({
  head: ({ params }) => sagHead(`TB ${params.number} · Byggeledelse · Zenko`, "Tilbud fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
