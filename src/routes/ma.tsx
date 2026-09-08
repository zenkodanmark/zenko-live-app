import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ma")({
  component: () => <Outlet />,
});
