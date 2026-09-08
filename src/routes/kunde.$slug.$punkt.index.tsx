import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { kundeHead } from "@/components/kunde-shell";

const Inner = lazy(() => import("@/components/kunde-desk").then((m) => ({ default: m.KundePunktRoute })));

export const Route = createFileRoute("/kunde/$slug/$punkt/")({
  head: ({ params }) => kundeHead(`${params.punkt} · ${params.slug} · Zenko`, "Bygningsdel i kvalitetssikringen fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
