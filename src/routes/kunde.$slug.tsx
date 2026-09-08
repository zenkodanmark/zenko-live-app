import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { isKundeSlug } from "@/lib/ks-customer";

export const Route = createFileRoute("/kunde/$slug")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug)) throw notFound();
  },
  component: () => <Outlet />,
});
