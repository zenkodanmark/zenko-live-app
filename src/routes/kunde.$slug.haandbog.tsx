import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { kundeHead } from "@/components/kunde-shell";
import { isKundeSlug } from "@/lib/route-guards";

const Inner = lazy(() => import("@/components/kunde-desk").then((m) => ({ default: m.KundeHandbookRoute })));

export const Route = createFileRoute("/kunde/$slug/haandbog")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  head: ({ params }) => kundeHead(`Håndbog · ${params.slug} · Zenko`, "Kvalitetssikringshåndbog fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
