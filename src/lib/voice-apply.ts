import { isMasterRole } from "./seed";
import { todayLog, useYard } from "./store";
import { getCrewSag } from "./crew-sag";
import type { ChatMessage, Lang } from "./types";
import {
  voiceLangToAppLang,
  type VoiceClientAction,
  type VoiceRole,
  type VoiceYardSnap,
} from "./voice-agent";

export function applyVoiceActions(actions: VoiceClientAction[]) {
  const s = useYard.getState();
  for (const a of actions) {
    if (a.type === "add_as") {
      s.addSlip({
        projectId: a.projectId,
        title: a.title,
        location: a.location,
        body: a.body,
        masterSolution: a.body,
        customerPrice: "",
        hoursEst: 0,
        materialsEst: "",
      });
    } else if (a.type === "add_er") {
      s.addEnt({
        projectId: a.projectId,
        title: a.title,
        location: a.location,
        body: a.body,
        noteHe: a.body,
      });
    } else if (a.type === "add_ks") {
      s.addKsReport(a.projectId, a.point, { location: a.location, deviations: a.deviations });
    } else if (a.type === "add_todo") {
      s.addTodo({
        projectId: a.projectId,
        assigneeId: a.assigneeId,
        title: a.title,
        due: a.due,
        body: a.body,
        kind: "task",
        needsPhoto: a.needsPhoto,
        driveFileId: a.driveFileId,
        photoFileIds: a.photoFileIds,
      });
    } else if (a.type === "add_chat") {
      const sourceLang = voiceLangToAppLang(a.lang);
      const translations = { da: a.text, ...a.translations } as ChatMessage["translations"];
      if (!translations[sourceLang]) translations[sourceLang] = a.text;
      s.addChat({
        fromId: a.fromId,
        to: a.toMasters ? { kind: "masters" } : { kind: "employee", id: a.toEmployeeId || a.fromId },
        projectId: a.projectId,
        sourceLang: sourceLang as Lang,
        original: a.text,
        translations,
        viaVoice: true,
      });
    } else if (a.type === "add_problem") {
      s.addProblem(a.problem);
    } else if (a.type === "patch_problem") {
      s.patchProblem(a.id, a.patch);
    } else if (a.type === "patch_as") {
      const slip = s.slips.find((x) => x.id === a.numberOrId || x.number === a.numberOrId || x.number.endsWith(a.numberOrId));
      if (slip) s.patchReport("slip", slip.id, { customerPrice: a.customerPrice });
    } else if (a.type === "forward_as") {
      const slip = s.slips.find((x) => x.id === a.numberOrId || x.number === a.numberOrId || x.number.endsWith(a.numberOrId));
      if (slip && !slip.forwarded) s.toggleSlipForwarded(slip.id);
    } else if (a.type === "add_plan") {
      s.addPlan({
        employeeId: a.employeeId,
        projectId: a.projectId,
        place: a.place,
        title: a.title,
        start: a.start,
        end: a.end,
        source: "voice",
      });
    } else if (a.type === "patch_todo") {
      s.patchTodo(a.id, a.patch);
    }
  }
}

export function yardVoiceSnap(): VoiceYardSnap | null {
  const s = useYard.getState();
  const emp = s.employees.find((e) => e.id === s.employeeId);
  if (!emp) return null;
  const day = todayLog(emp.id, s.days);
  const role: VoiceRole = isMasterRole(emp.role) ? "mester" : "svend";
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    role,
    checkedInProjectId: getCrewSag() || (day.checkInAt && !day.checkOutAt ? day.projectId : undefined),
    projects: s.projects.map((p) => ({ id: p.id, name: p.name, address: p.address, status: p.status })),
    employees: s.employees.map((e) => ({ id: e.id, name: e.name, role: e.role, language: e.language })),
    slips: s.slips.filter((x) => !x.trashedAt).map((x) => ({ id: x.id, number: x.number, projectId: x.projectId, title: x.title, customerPrice: x.customerPrice })),
    tfs: s.tfs.filter((x) => !x.trashedAt).map((x) => ({ id: x.id, number: x.number, projectId: x.projectId, title: x.title || x.question })),
    ents: s.ents.filter((x) => !x.trashedAt).map((x) => ({ id: x.id, number: x.number, projectId: x.projectId, title: x.title })),
    ks: s.ksReports.filter((x) => !x.trashedAt).map((x) => ({ id: x.id, number: x.number, projectId: x.projectId, point: x.point })),
    todos: s.todos.map((x) => ({ id: x.id, projectId: x.projectId, assigneeId: x.assigneeId, title: x.title, done: x.done })),
    problems: s.problems ?? [],
    plans: (s.plans ?? []).map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      projectId: p.projectId,
      place: p.place,
      title: p.title,
      start: p.start,
      end: p.end,
    })),
  };
}
