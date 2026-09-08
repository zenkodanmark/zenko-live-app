import type { MailSnap } from "./mail.snapshot";

export type SagBriefLine = { title: string; lines: string[] };

export type SagBriefInput = {
  projectName: string;
  mail: MailSnap;
  chats: { at: string; from: string; text: string }[];
  todos: { title: string; who: string; done: boolean; due: string }[];
  slips: { number: string; title: string }[];
  tfs: { number: string; title: string; answered: boolean }[];
  ents: { number: string; title: string }[];
  ks: { number: string; point: string }[];
  meetings: { name: string }[];
  cal: { title: string; at: string }[];
  crew: { name: string; in: boolean }[];
};

export type SagBrief = {
  headline: string;
  sections: SagBriefLine[];
  pack: string;
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function buildSagBrief(input: SagBriefInput): SagBrief {
  const open = input.todos.filter((t) => !t.done);
  const crewIn = input.crew.filter((c) => c.in).map((c) => c.name);
  const nextCal = input.cal[0];
  const bits: string[] = [];
  if (crewIn.length) bits.push(`På plads: ${crewIn.join(", ")}.`);
  else bits.push("Ingen mødt på sagen lige nu.");
  if (open.length) bits.push(`${open.length} åbne to-do.`);
  if (input.mail.headline) bits.push(input.mail.headline);
  if (nextCal) bits.push(`Næste i kalender: ${nextCal.title} · ${fmtWhen(nextCal.at)}.`);
  const unanswered = input.tfs.filter((t) => !t.answered);
  if (unanswered.length) bits.push(`${unanswered.length} TF uden svar.`);
  const headline = bits.join(" ") || `Ingen aktivitet på ${input.projectName} lige nu.`;

  const sections: SagBriefLine[] = [];
  const mailLines = input.mail.items.slice(0, 4).map((m) => `${m.date} · ${m.from}: ${m.subject}`);
  if (mailLines.length) sections.push({ title: "Mail", lines: mailLines });

  const chatLines = input.chats.slice(0, 3).map((c) => `${c.from}: ${c.text}`);
  if (chatLines.length) sections.push({ title: "Chat", lines: chatLines });

  if (open.length) {
    sections.push({
      title: "To-do",
      lines: open.slice(0, 5).map((t) => `${t.who}: ${t.title}${t.due ? ` · ${t.due}` : ""}`),
    });
  }

  const meetLines = [
    ...input.cal.slice(0, 3).map((c) => `${fmtWhen(c.at)} · ${c.title}`),
    ...input.meetings.slice(0, 3).map((m) => m.name),
  ];
  if (meetLines.length) sections.push({ title: "Møder og referater", lines: meetLines });

  const reportLines = [
    ...input.slips.slice(0, 2).map((s) => `Aftale ${s.number} · ${s.title}`),
    ...input.tfs.slice(0, 2).map((s) => `TF ${s.number} · ${s.title}${s.answered ? " · besvaret" : ""}`),
    ...input.ks.slice(0, 2).map((s) => `KS ${s.number} · ${s.point}`),
    ...input.ents.slice(0, 2).map((s) => `ENT ${s.number} · ${s.title}`),
  ];
  if (reportLines.length) sections.push({ title: "Rapporter", lines: reportLines });

  const pack = [
    `Sag: ${input.projectName}`,
    headline,
    ...sections.flatMap((s) => [`## ${s.title}`, ...s.lines]),
  ].join("\n");

  return { headline, sections, pack };
}
