import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { sagHead } from "@/components/sag-shell";

const Inner = lazy(() => import("@/components/sag-desk").then((m) => ({ default: m.SagTodoListRoute })));

export const Route = createFileRoute("/sag/$slug/todo/")({
  head: ({ params }) => sagHead(`To-do · ${params.slug} · Zenko`, "To-do fra Zenko Danmark."),
  component: () => (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  ),
});
