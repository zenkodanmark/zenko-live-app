import { createFileRoute } from "@tanstack/react-router";
import { MaMissing, maHead } from "@/components/ma-public";

export const Route = createFileRoute("/ma/$sag/")({
  head: () => maHead("Siden findes ikke · Zenko", "Materialebestilling fra Zenko Danmark."),
  component: MaMissing,
});
