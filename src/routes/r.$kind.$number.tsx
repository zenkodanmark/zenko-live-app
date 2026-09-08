import { createFileRoute, notFound } from "@tanstack/react-router";
import { ReportSharePage } from "@/components/report-share-page";
import { isShareKind, isShareSlug, shareKindLabel } from "@/lib/report-share";

export const Route = createFileRoute("/r/$kind/$number")({
  component: ReportShareRoute,
  beforeLoad: ({ params }) => {
    if (!isShareKind(params.kind) || !isShareSlug(params.number)) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${isShareKind(params.kind) ? shareKindLabel(params.kind) : "Rapport"} ${params.number} · Zenko` },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Rapport fra Zenko Danmark. Kun rapporten — ingen login." },
    ],
  }),
});

function ReportShareRoute() {
  const { kind, number } = Route.useParams();
  if (!isShareKind(kind) || !isShareSlug(number)) return null;
  return <ReportSharePage kind={kind} number={number} />;
}
