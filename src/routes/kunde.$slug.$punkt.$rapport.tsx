import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/route-guards";

const Inner = lazy(() => import("@/components/kunde-desk").then((m) => ({ default: m.KundeRapportRoute })));

export const Route = createFileRoute("/kunde/$slug/$punkt/$rapport")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`Rapport ${params.rapport} · ${params.slug} · Zenko`, "Proceskontrol fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
