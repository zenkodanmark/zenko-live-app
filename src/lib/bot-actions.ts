import { downloadCsv } from "./csv.ts";
import { jobSlug, looksLikePlan, matchEmployees, parsePlanRange, parseWeekPlan, placeFor, planWorkTitle } from "./plan.ts";
import { hoursWorked, projectById, suggestKsPoint, canonicalProjectId } from "./seed.ts";
import type { DayLog, Employee, Project } from "./types.ts";

export type BotAction =
  | { type: "create_ks"; projectId: string; point: string; floor?: string; room?: string; deviations?: string }
  | { type: "create_slip"; projectId: string; title: string; location?: string; body: string; customerPrice?: string }
  | { type: "create_tf"; projectId: string; title?: string; question: string }
  | { type: "create_ent"; projectId: string; title: string; location?: string; body: string }
  | { type: "create_todo"; projectId: string; title: string; assigneeId?: string; due?: string; needsPhoto?: boolean }
  | { type: "set_plan"; employeeId: string; projectId: string; title: string; start: string; end: string }
  | { type: "create_note"; projectId: string; body: string }
  | { type: "export_hours"; employeeName?: string; projectId?: string; month?: string }
  | { type: "create_chat"; projectId: string; text: string; assigneeId?: string }
  | { type: "draft_mail"; to: string; subject: string; body: string }
  | { type: "create_project"; id?: string; name: string; address?: string; lat?: number; lng?: number };

export type HoursPack = {
  filename: string;
  header: string[];
  rows: (string | number)[][];
  total: number;
  days: number;
  label: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  marts: 3,
  apr: 4,
  april: 4,
  maj: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function parseMonth(text: string, now = new Date()): { year: number; month: number } | null {
  const q = text.toLowerCase();
  const iso = q.match(/\b(20\d{2})-(\d{2})\b/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
  const ym = q.match(/(20\d{2})[.\-/ ]?(1[0-2]|0[1-9]|[1-9])\b/);
  if (ym) return { year: Number(ym[1]), month: Number(ym[2]) };
  const named = Object.keys(MONTHS).sort((a, b) => b.length - a.length).find((k) => new RegExp(`\\b${k}\\b`, "i").test(q));
  if (!named) return null;
  const month = MONTHS[named]!;
  const y = q.match(/20\d{2}/);
  if (y) return { year: Number(y[0]), month };
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  return { year: month > cm ? cy - 1 : cy, month };
}

const NAME_ALIAS: Record<string, string> = {
  marian: "marius",
  osvando: "osvaldo",
  fede: "federico",
};

export function matchEmployee(text: string, employees: Employee[]): Employee | undefined {
  const q = fold(text);
  return employees.find((e) => {
    const first = fold(e.name.split(" ")[0]!);
    if (q.includes(first)) return true;
    return Object.entries(NAME_ALIAS).some(([alias, name]) => name === first && q.includes(alias));
  });
}

export function matchProject(text: string, projects: Project[]): Project | undefined {
  const q = fold(text);
  const scored = projects
    .map((p) => {
      const n = fold(p.name);
      const spaced = n.replace("holm", " holm");
      let score = 0;
      if (q.includes(n) || q.includes(spaced)) score = n.length;
      else if (n.startsWith("hillerod") && /hillerodsholm|hillerods holm/.test(q) && !/klostergard/.test(q)) score = 8;
      if (p.id === "job-provestenen" && /strandvej|provesten|prøvesten/.test(q)) score = Math.max(score, 12);
      if (p.id === "job-kaerhuset" && /ruskaer|ruskær|kaerhus|kærhus/.test(q)) score = Math.max(score, 10);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.p;
}

function fold(s: string) {
  return s.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
}

export function hoursSummary(days: Record<string, DayLog>, employees: Employee[], projects: Project[]): string {
  const bag = new Map<string, { name: string; job: string; ym: string; days: number; hours: number }>();
  for (const d of Object.values(days)) {
    if (!d.checkInAt) continue;
    const emp = employees.find((e) => e.id === d.employeeId);
    const job = projects.find((p) => p.id === d.projectId) ?? projectById(d.projectId);
    if (!emp) continue;
    const ym = d.date.slice(0, 7);
    const key = `${emp.id}|${d.projectId}|${ym}`;
    const cur = bag.get(key) ?? { name: emp.name, job: job.name, ym, days: 0, hours: 0 };
    cur.days += 1;
    cur.hours += hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now());
    bag.set(key, cur);
  }
  return [...bag.values()]
    .sort((a, b) => b.ym.localeCompare(a.ym) || a.name.localeCompare(b.name))
    .map((r) => `${r.name} · ${r.job} · ${r.ym} · ${r.days} dage · ${r.hours.toFixed(1).replace(".", ",")} t`)
    .join("\n");
}

export function buildHoursPack(
  days: Record<string, DayLog>,
  employees: Employee[],
  projects: Project[],
  filter: { employeeName?: string; projectId?: string; month?: string },
): HoursPack {
  const period = filter.month ? parseMonth(filter.month) : parseMonth(filter.month ?? "");
  const prefix = period ? `${period.year}-${String(period.month).padStart(2, "0")}` : "";
  const emp = filter.employeeName
    ? employees.find((e) => e.name.toLowerCase().includes(filter.employeeName!.toLowerCase().split(" ")[0]!))
    : undefined;
  const rows: (string | number)[][] = [];
  let total = 0;
  for (const d of Object.values(days)) {
    if (!d.checkInAt) continue;
    if (emp && d.employeeId !== emp.id) continue;
    if (filter.projectId && d.projectId !== filter.projectId) continue;
    if (prefix && !d.date.startsWith(prefix)) continue;
    const who = employees.find((e) => e.id === d.employeeId)?.name ?? d.employeeId;
    const job = projects.find((p) => p.id === d.projectId)?.name ?? d.projectId;
    const h = hoursWorked(d, d.checkOutAt ? new Date(d.checkOutAt).getTime() : Date.now());
    total += h;
    const inT = d.checkInAt ? new Date(d.checkInAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }) : "";
    const outT = d.checkOutAt ? new Date(d.checkOutAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }) : "åben";
    rows.push([who, d.date, job, inT, outT, d.pauseMinutes, h.toFixed(2).replace(".", ","), d.photos.length, d.workNote ?? ""]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const who = emp?.name ?? "alle";
  const job = filter.projectId ? (projects.find((p) => p.id === filter.projectId)?.name ?? "sag") : "alle-sager";
  const when = prefix || "periode";
  const filename = `timer-${slug(who)}-${slug(job)}-${when}.csv`;
  const label = `${who} · ${job} · ${when}: ${rows.length} dage, ${total.toFixed(1).replace(".", ",")} timer`;
  return {
    filename,
    header: ["Medarbejder", "Dato", "Sag", "Møde", "Gå", "Pause min", "Timer", "KS-fotos", "Beskrivelse"],
    rows,
    total,
    days: rows.length,
    label,
  };
}

export function downloadHours(pack: HoursPack) {
  downloadCsv(pack.filename, pack.header, pack.rows);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[æøå]/g, (c) => ({ æ: "ae", ø: "oe", å: "aa" }[c] ?? c)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function heuristicActions(
  query: string,
  photoCount: number,
  employees: Employee[],
  projects: Project[],
): { answer: string; actions: BotAction[] } {
  const q = query.toLowerCase();
  const emp = matchEmployee(query, employees);
  const job = matchProject(query, projects) ?? projects.find((p) => p.id === "job-hillerodsholm");
  const period = parseMonth(query);
  const wantsHours = /timer|løn|csv|download|\bark\b|timeark|dataløn|udtræk/.test(q) && !/arkiv/.test(q);
  const wantsTf = /\btf\b|teknisk foresp/.test(q);
  const wantsKs = /\bks\b|kontrolplan|proceskontrol/.test(q) && !wantsTf;
  const actions: BotAction[] = [];
  if (/arkiv|læg .*på sagen|beskrivelse.*(murer|tag)|murer og tag/.test(q) && /islev|udbud|beskriv|murer|tag/.test(q)) {
    const sag = matchProject(query, projects) ?? projects.find((p) => p.id === "job-islevvaenge") ?? job;
    return {
      answer: `Murer og tag ligger på ${sag?.name ?? "Islevvænge"}. Ansatte kan spørge sag-bot om fuger, puds, skorsten og mørtel.`,
      actions: [
        {
          type: "create_note",
          projectId: sag?.id ?? "job-islevvaenge",
          body: "Arbejdsbeskrivelser ISV_K01_C08.2_Zmur og Ztag arkiveret i 01 Udbud. Ansatte søger og spørger i sag-bot.",
        },
      ],
    };
  }
  if (wantsHours) {
    actions.push({
      type: "export_hours",
      employeeName: emp?.name,
      projectId: job?.id,
      month: period ? `${period.year}-${String(period.month).padStart(2, "0")}` : undefined,
    });
    return {
      answer: `Jeg laver et timeark${emp ? ` for ${emp.name}` : ""}${job ? ` på ${job.name}` : ""}${period ? ` ${period.month}/${period.year}` : ""}.`,
      actions,
    };
  }
  if (looksLikePlan(query) && !wantsKs) {
    const week = parseWeekPlan(query, employees, projects);
    if (week.length >= 2 || week.some((c) => c.create)) {
      for (const chunk of week) {
        const existing = projects.find((p) => fold(p.name) === fold(chunk.projectName) || fold(p.name).includes(fold(chunk.projectName).split(" ")[0] ?? "___"));
        const hit = existing ?? matchProject(chunk.projectName, projects);
        const id = hit && !chunk.create ? hit.id : hit && fold(hit.name) === fold(chunk.projectName) ? hit.id : jobSlug(chunk.projectName);
        if (chunk.create && (!hit || fold(hit.name) !== fold(chunk.projectName))) {
          const place = placeFor(chunk.projectName);
          actions.push({
            type: "create_project",
            id,
            name: chunk.projectName,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
          });
        }
        const pid = hit && fold(hit.name) === fold(chunk.projectName) ? hit.id : id;
        for (const e of chunk.employees) {
          actions.push({ type: "set_plan", employeeId: e.id, projectId: pid, title: chunk.title, start: chunk.start, end: chunk.end });
          actions.push({
            type: "create_todo",
            projectId: pid,
            assigneeId: e.id,
            title: `${chunk.title} · ${chunk.projectName}`,
            due: chunk.start,
            needsPhoto: true,
          });
        }
      }
      if (actions.length) {
        return { answer: `Udkast: ${week.length} poster i ugeplanen.`, actions };
      }
    }
    const who = matchEmployees(query, employees);
    const range = parsePlanRange(query);
    const crew = who.length ? who : [];
    if (crew.length && range && job) {
      const title = planWorkTitle(query);
      for (const e of crew) {
        actions.push({ type: "set_plan", employeeId: e.id, projectId: job.id, title, start: range.start, end: range.end });
        actions.push({
          type: "create_todo",
          projectId: job.id,
          assigneeId: e.id,
          title: `${title} · ${job.name}`,
          due: range.start,
          needsPhoto: true,
        });
      }
      return {
        answer: `Jeg lægger ${title} på ${job.name} for ${crew.map((e) => e.name).join(", ")} ${range.start}–${range.end}, og opretter to-do.`,
        actions,
      };
    }
  }
  if (wantsKs && job) {
    const point = suggestKsPoint(query, job.id);
    actions.push({
      type: "create_ks",
      projectId: job.id,
      point,
      floor: /2\.?\s*sal/.test(q) ? "2. sal" : /stuen/.test(q) ? "Stuen" : "1. sal",
      room: /altan/.test(q) ? "Altan" : /skorsten/.test(q) ? "Skorsten" : /gavl/.test(q) ? "Gavl nord" : "Facade øst",
      deviations: "Ingen afvigelser.",
    });
  }
  const wantsTodo = /to-?do|opgave/.test(q);
  const wantsSlip = /aftaleseddel/.test(q) || (/ekstra/.test(q) && /lav|opret/.test(q) && !wantsTf && !wantsTodo);
  if (wantsSlip && job) {
    actions.push({
      type: "create_slip",
      projectId: job.id,
      title: query.slice(0, 60),
      location: job.name,
      body: query,
      customerPrice: "0 kr",
    });
  }
  if (wantsTf && job) {
    actions.push({
      type: "create_tf",
      projectId: job.id,
      question: query,
      title: /stål/.test(q) || /byggeledelse/.test(q)
        ? "Gammelt stål i mur — kan ikke fortsætte"
        : query.slice(0, 48),
    });
  }
  if (wantsTodo && job) {
    const who = emp && emp.role !== "mester" ? emp : matchEmployee(query, employees);
    actions.push({
      type: "create_todo",
      projectId: job.id,
      assigneeId: who && who.role !== "mester" ? who.id : undefined,
      title: /fjern|stål/.test(q) ? `Fjern gammelt stål som ekstra · ${job.name}` : query.slice(0, 60),
      due: new Date().toISOString().slice(0, 10),
      needsPhoto: /billede|foto/.test(q) || photoCount > 0,
    });
  }
  if (actions.length) {
    const first = actions[0];
    if (first?.type === "create_ks") {
      return { answer: `Jeg laver KS ${first.point} på ${job?.name ?? "sagen"}${photoCount ? ` med ${photoCount} billeder` : ""}.`, actions };
    }
    return { answer: `Udkast: ${actions.map((a) => a.type.replace("create_", "")).join(", ")}.`, actions };
  }
  return { answer: "", actions: [] };
}

export function sanitizeActions(raw: unknown, projects: Project[]): BotAction[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(projects.map((p) => p.id));
  const out: BotAction[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const type = String(o.type ?? "");
    const rawPid = typeof o.projectId === "string" ? canonicalProjectId(o.projectId) : "";
    const projectId = ids.has(rawPid) ? rawPid : rawPid.startsWith("job-") ? rawPid : projects.find((p) => p.id === "job-hillerodsholm")?.id ?? projects[0]?.id ?? "";
    if (type === "create_ks") {
      out.push({
        type,
        projectId,
        point: typeof o.point === "string" && o.point ? o.point : "5.4",
        floor: typeof o.floor === "string" ? o.floor : undefined,
        room: typeof o.room === "string" ? o.room : undefined,
        deviations: typeof o.deviations === "string" ? o.deviations : undefined,
      });
    } else if (type === "create_slip") {
      out.push({
        type,
        projectId,
        title: String(o.title ?? "Ekstra arbejde").slice(0, 80),
        location: typeof o.location === "string" ? o.location : undefined,
        body: String(o.body ?? o.title ?? ""),
        customerPrice: typeof o.customerPrice === "string" ? o.customerPrice : "0 kr",
      });
    } else if (type === "create_tf") {
      out.push({ type, projectId, title: typeof o.title === "string" ? o.title : undefined, question: String(o.question ?? o.title ?? "") });
    } else if (type === "create_ent") {
      out.push({ type, projectId, title: String(o.title ?? "Entreprenørrapport"), location: typeof o.location === "string" ? o.location : undefined, body: String(o.body ?? "") });
    } else if (type === "create_todo") {
      out.push({
        type,
        projectId,
        title: String(o.title ?? ""),
        assigneeId: typeof o.assigneeId === "string" ? o.assigneeId : undefined,
        due: typeof o.due === "string" ? o.due : undefined,
        needsPhoto: o.needsPhoto === true,
      });
    } else if (type === "set_plan") {
      out.push({
        type,
        employeeId: String(o.employeeId ?? ""),
        projectId,
        title: String(o.title ?? "Udførsel").slice(0, 80),
        start: String(o.start ?? "").slice(0, 10),
        end: String(o.end ?? o.start ?? "").slice(0, 10),
      });
    } else if (type === "create_note") {
      out.push({ type, projectId, body: String(o.body ?? o.title ?? "") });
    } else if (type === "export_hours") {
      out.push({
        type,
        employeeName: typeof o.employeeName === "string" ? o.employeeName : undefined,
        projectId: typeof o.projectId === "string" && ids.has(o.projectId) ? o.projectId : undefined,
        month: typeof o.month === "string" ? o.month : undefined,
      });
    } else if (type === "create_chat") {
      out.push({
        type,
        projectId,
        text: String(o.text ?? o.body ?? o.title ?? "").slice(0, 400),
        assigneeId: typeof o.assigneeId === "string" ? o.assigneeId : undefined,
      });
    } else if (type === "draft_mail") {
      out.push({
        type,
        to: String(o.to ?? "").slice(0, 120),
        subject: String(o.subject ?? o.title ?? "").slice(0, 120),
        body: String(o.body ?? "").slice(0, 2000),
      });
    } else if (type === "create_project") {
      out.push({
        type,
        id: typeof o.id === "string" ? o.id : undefined,
        name: String(o.name ?? o.title ?? "").slice(0, 80),
        address: typeof o.address === "string" ? o.address : undefined,
        lat: typeof o.lat === "number" ? o.lat : undefined,
        lng: typeof o.lng === "number" ? o.lng : undefined,
      });
    }
  }
  return out;
}
