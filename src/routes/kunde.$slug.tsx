import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { isKundeSlug } from "@/lib/route-guards";

export const Route = createFileRoute("/kunde/$slug")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  component: () => <Outlet />,
});
