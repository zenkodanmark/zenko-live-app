import { createFileRoute } from "@tanstack/react-router";
import { PinLogin } from "@/components/pin-login";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => ({
    e: raw.e == null ? "" : String(raw.e),
    pin: raw.pin == null ? "" : String(raw.pin),
  }),
  component: function Home() {
    const { e, pin } = Route.useSearch();
    return <PinLogin empId={e} pin={pin} />;
  },
});
