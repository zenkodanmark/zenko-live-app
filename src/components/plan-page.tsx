import { PlanGrid } from "@/components/plan-grid";
import { ToastHost } from "@/components/toast-host";
import { isMasterRole } from "@/lib/crew";
import { useYard } from "@/lib/store";

export function SagPlanPage({
  projectId,
  jobName,
}: {
  projectId: string;
  jobName: string;
}) {
  const emp = useYard((s) => s.employees.find((e) => e.id === s.employeeId));
  const mode = emp && isMasterRole(emp.role) ? "mester" : "ledelse";
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-paper" data-testid="plan-page">
      <header className="no-print shrink-0 bg-navy px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-sand">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase">Zenko Danmark</p>
        <p className="mt-1 text-xs tracking-wide text-sand/70">Byggeledelse · Plan</p>
      </header>
      <PlanGrid projectId={projectId} mode={mode} jobName={jobName} />
      <ToastHost />
    </main>
  );
}
