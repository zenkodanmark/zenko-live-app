import { createFileRoute } from "@tanstack/react-router";
import { PinLogin } from "@/components/pin-login";
import { optQuery } from "@/lib/route-guards";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    e: optQuery(raw.e),
    pin: optQuery(raw.pin),
  }),
  component: function Home() {
    const { e, pin } = Route.useSearch();
    return <PinLogin empId={e} pin={pin} />;
  },
});