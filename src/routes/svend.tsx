import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { LoginSplash } from "@/components/pin-login";
import { optQuery } from "@/lib/route-guards";

const SvendDesk = lazy(() => import("@/components/svend-desk").then((m) => ({ default: m.SvendDesk })));

export const Route = createFileRoute("/svend")({
  validateSearch: (raw: Record<string, unknown>) => {
    const p = optQuery(raw.p)?.replace(/\D/g, "");
    return {
      e: optQuery(raw.e),
      p: p || undefined,
    };
  },
  pendingComponent: LoginSplash,
  component: function SvendPage() {
    return (
      <Suspense fallback={<LoginSplash />}>
        <SvendDesk />
      </Suspense>
    );
  },
});