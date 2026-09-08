import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { LoginSplash } from "@/components/pin-login";
import { optQuery } from "@/lib/route-guards";

const MesterDesk = lazy(() => import("@/components/mester-desk").then((m) => ({ default: m.MesterDesk })));

export const Route = createFileRoute("/mester")({
  validateSearch: (raw: Record<string, unknown>) => {
    const p = optQuery(raw.p)?.replace(/\D/g, "");
    return {
      e: optQuery(raw.e),
      p: p || undefined,
    };
  },
  pendingComponent: LoginSplash,
  component: function MesterPage() {
    return (
      <Suspense fallback={<LoginSplash />}>
        <MesterDesk />
      </Suspense>
    );
  },
});