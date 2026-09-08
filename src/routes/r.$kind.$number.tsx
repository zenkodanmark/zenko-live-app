import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { isShareKind, isShareSlug, publicHead, shareKindLabel } from "@/lib/route-guards";

const ReportSharePage = lazy(() => import("@/components/report-share-page").then((m) => ({ default: m.ReportSharePage })));

export const Route = createFileRoute("/r/$kind/$number")({
  beforeLoad: ({ params }) => {
    if (!isShareKind(params.kind) || !isShareSlug(params.number)) throw notFound();
  },
  head: ({ params }) =>
    publicHead(
      `${isShareKind(params.kind) ? shareKindLabel(params.kind) : "Rapport"} ${params.number} · Zenko`,
      "Rapport fra Zenko Danmark. Kun rapporten — ingen login.",
    ),
  component: function ReportShareRoute() {
    const { kind, number } = Route.useParams();
    if (!isShareKind(kind) || !isShareSlug(number)) return null;
    return (
      <Suspense fallback={null}>
        <ReportSharePage kind={kind} number={number} />
      </Suspense>
    );
  },
});
