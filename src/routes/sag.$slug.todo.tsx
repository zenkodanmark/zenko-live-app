import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sag/$slug/todo")({
  component: () => <Outlet />,
});
