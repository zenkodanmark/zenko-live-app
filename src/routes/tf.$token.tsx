import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { publicHead } from "@/lib/route-guards";

const TfSharePage = lazy(() => import("@/components/tf-share-page").then((m) => ({ default: m.TfSharePage })));

export const Route = createFileRoute("/tf/$token")({
  component: function TfShareRoute() {
    const { token } = Route.useParams();
    return (
      <Suspense fallback={null}>
        <TfSharePage token={token} />
      </Suspense>
    );
  },
  head: () => publicHead("Teknisk forespørgsel · Zenko", "Teknisk forespørgsel fra Zenko Danmark."),
});
