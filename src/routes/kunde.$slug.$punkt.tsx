import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { isKundeSlug } from "@/lib/route-guards";

export const Route = createFileRoute("/kunde/$slug/$punkt")({
  beforeLoad: ({ params }) => {
    if (!isKundeSlug(params.slug) || params.punkt === "haandbog" || params.punkt === "komplet") throw notFound();
  },
  component: () => <Outlet />,
});
