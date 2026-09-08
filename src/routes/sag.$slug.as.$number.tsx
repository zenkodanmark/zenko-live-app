import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagAsRoute })));

export const Route = createFileRoute("/sag/$slug/as/$number")({
  head: ({ params }) => sagHead(`AS ${params.number} · Byggeledelse · Zenko`, "Aftaleseddel fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
