import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sag/$slug/tf")({
  component: () => <Outlet />,
});
