import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/route-guards";

const Inner = lazy(() => import("@/components/kunde-desk").then((m) => ({ default: m.KundeKompletRoute })));

export const Route = createFileRoute("/kunde/$slug/komplet")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`KS-rapport · ${params.slug} · Zenko`, "Komplet KS-rapport fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
