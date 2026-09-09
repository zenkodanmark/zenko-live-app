import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sag/$slug/ks")({
  component: () => <Outlet />,
});
