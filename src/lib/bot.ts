import { controlPlanFor, copenhagenTime, hoursWorked, isCrewRole, projectById } from "./seed";
import type { CalEvent, DayLog, Employee, Entrepreneur, Issue, MemoryNote, Project, Slip, Tf, Todo } from "./types";

export type BotKind = "todo" | "extra" | "ks" | "problem" | "note";
export type BotDraft = { kind: BotKind; title: string; body: string; point?: string; assigneeId?: string; projectId?: string };

const KS_RE = /\b(?:ks\s*)?(\d+\.\d+)\b/i;

export function classifyUtterance(text: string, employees: Employee[], projectId?: string): BotDraft {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const who = employees.find((e) => lower.includes(e.name.toLowerCase().split(" ")[0]!.toLowerCase()));
  const plan = controlPlanFor(projectId);
  const ks = raw.match(KS_RE);
  const point = ks?.[1] ?? plan.find((p) => lower.includes(p.title.toLowerCase()))?.code;
  if (/todo|opgave|tarea/.test(lower)) return { kind: "todo", title: raw.replace(/^todo( til)?/i, "").trim() || raw, body: raw, assigneeId: who?.id, projectId };
  if (/ekstra|extra|aftaleseddel/.test(lower)) return { kind: "extra", title: raw.slice(0, 48), body: raw, projectId };
  if (point || /\bks\b/.test(lower)) {
    const code = point ?? plan[0]?.code ?? "2.1";
    return { kind: "ks", title: `KS ${code}`, body: raw, point: code, projectId };
  }
  if (/problem|problema|fejl|issue/.test(lower)) return { kind: "problem", title: raw.slice(0, 48), body: raw, projectId };
  return { kind: "note", title: raw.slice(0, 48), body: raw, projectId };
}

export function deskAnswer(
  q: string,
  ctx: { employees: Employee[]; days: Record<string, DayLog>; issues: Issue[]; projects: Project[]; slips: Slip[]; tfs: Tf[]; ents: Entrepreneur[]; todos: Todo[]; notes: MemoryNote[]; cal: CalEvent[] },
) {
  const lower = q.toLowerCase();
  if (/mangler ks|falta ks|who.*ks/.test(lower)) {
    const missing = ctx.employees.filter((e) => isCrewRole(e.role)).filter((e) => {
      const d = Object.values(ctx.days).find((x) => x.employeeId === e.id && x.checkInAt && !x.checkOutAt);
      return Boolean(d);
    });
    return missing.length ? missing.map((e) => `${e.name} er på plads`).join(". ") : "Ingen på plads nu.";
  }
  if (/i går|ayer|hillerød/.test(lower)) {
    const job = ctx.projects.find((p) => p.id === "job-hillerodsholm") ?? projectById("job-hillerodsholm");
    return `${job.name}: ${job.huddle}`;
  }
  const open = ctx.issues.filter((i) => i.status === "open");
  if (open.length) return `${open.length} åbne beskeder. Seneste: ${open[0]!.body}`;
  return "Jeg kigger i tavlen. Sig KS, ekstra, todo eller problem.";
}

export { copenhagenTime, hoursWorked };
