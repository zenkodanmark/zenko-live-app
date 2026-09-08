import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { kundeHead } from "@/components/kunde-shell";

const Inner = lazy(() => import("@/components/kunde-desk").then((m) => ({ default: m.KundeHomeRoute })));

export const Route = createFileRoute("/kunde/$slug/")({
  head: ({ params }) => kundeHead(`${params.slug} · KS · Zenko`, "Kvalitetssikring fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
