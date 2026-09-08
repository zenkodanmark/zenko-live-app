import { createFileRoute } from "@tanstack/react-router";
import { TfSharePage } from "@/components/tf-share-page";

export const Route = createFileRoute("/tf/$token")({
  component: TfShareRoute,
  head: () => ({
    meta: [
      { title: `Teknisk forespørgsel · Zenko` },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Teknisk forespørgsel fra Zenko Danmark." },
    ],
  }),
});

function TfShareRoute() {
  const { token } = Route.useParams();
  return <TfSharePage token={token} />;
}
