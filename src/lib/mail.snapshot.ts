export type MailItem = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

export type MailSnap = { count: number; headline: string; live: boolean; items: MailItem[] };

const HILLEROD_ITEMS: MailItem[] = [
  { id: "1a061e8bbdba0abc", from: "Ole Jepsen", subject: "Hillerødsholm - sikkerhedsmødereferat nr. 9", date: "02.09.2026", snippet: "Sag 267. Afholdt 2. sep. Ingen bilag. Næste 16. sep." },
  { id: "1a05ca6b77d88ed5", from: "Lars Ingtrup Kralund", subject: "Hillerødsholm - Projektmøde Ang. understøtninger til altaner", date: "01.09.2026", snippet: "Teams-møde om understøtninger til altaner." },
  { id: "1a05b1f8e2095cce", from: "Dalux", subject: "Hillerødsholm - Helhedsplan har 1 ændring siden i går", date: "01.09.2026", snippet: "TN54 Muret stik over vindue." },
  { id: "1a057bd31af29375", from: "Ole Jepsen", subject: "Hillerødsholm - Byggemødereferat nr. 15", date: "31.08.2026", snippet: "Byggemøde 26. aug. Næste 2. sep. kl. 09.30 i kontorskuret." },
  { id: "1a056c1281b0979d", from: "Dalux", subject: "Hillerødsholm - Helhedsplan: TN54 Muret stik over vindue", date: "31.08.2026", snippet: "Ny opgave tildelt Ole i Field." },
  { id: "1a047d7cab3df274", from: "Hillerødsholm", subject: "Hillerødsholm Varsling", date: "28.08.2026", snippet: "Varsling til beboere for den kommende uge." },
  { id: "1a0445466b91330c", from: "Federico Nicolas Orlandi", subject: "The drawings of the hollow facade: Block A", date: "27.08.2026", snippet: "Tegninger hul facade, blok A." },
  { id: "1a037e76c275ff5d", from: "Ole Jepsen", subject: "Hillerødsholm - Byggemødereferat nr. 14", date: "25.08.2026", snippet: "RETTELSE: næste byggemøde 26. aug. kl. 09.30." },
  { id: "1a037342a9f53b05", from: "Zenko Danmark", subject: "Fakturanr. 264 - 01.08.26", date: "25.08.2026", snippet: "Uafklaret krav 6.000 kr. krediteres til enighed." },
  { id: "1a032df75bee9d2f", from: "Mads Jensen", subject: "Hillerødsholm - Faktura 262 krediteres.", date: "24.08.2026", snippet: "Husk kreditnota på faktura 262. Ny faktura jf. Lars' aftaleseddel." },
  { id: "1a023c6a20c6f69e", from: "Ole Jepsen", subject: "Hillerødsholm - sikkerhedsmødereferat nr. 8", date: "21.08.2026", snippet: "Afholdt 19. aug. Ingen bilag. Næste 2. sep." },
  { id: "1a019fadcaa1660d", from: "Lars Ingtrup Kralund", subject: "Hillerødsholm - Ang. dagens økonomimøde samt tilkøb af option.", date: "19.08.2026", snippet: "AS 2 og 3 til underskrift. Administration 6.000 kr. afvist." },
];

const HILLEROD: MailSnap = {
  count: 12,
  headline: "Sikkerhedsmøde 9 afholdt 2. sep. Næste 16. sep. Ingen bilag. Altan-understøtning og TN54 stik over vindue.",
  live: false,
  items: HILLEROD_ITEMS,
};

const MAP: Record<string, MailSnap> = {
  "job-hillerodsholm": HILLEROD,
  Hillerødsholm: HILLEROD,
  "job-islevvaenge": {
    count: 0,
    headline: "Ingen mail fundet endnu.",
    live: false,
    items: [],
  },
  "job-kaerhuset": {
    count: 0,
    headline: "Ingen mail fundet endnu.",
    live: false,
    items: [],
  },
};

const SAG_ALIASES: Record<string, string[]> = {
  Hillerødsholm: ["Hillerødsholm", "Hillerodsholm", "Selskovvej"],
  Islevvænge: ["Islevvænge", "Islevvaenge", "Fortvej", "02304"],
  Kærhuset: ["Kærhuset", "Kaerhuset", "Kær Bygade"],
  Solbakkegård: ["Solbakkegård", "Solbakkegaard", "Vester Snogbæk"],
};

export function sagSearchTerms(name: string): string[] {
  const n = name.trim();
  if (n.length < 4) return [];
  const extra = SAG_ALIASES[n] ?? [];
  return [...new Set([n, ...extra])];
}

export function mailQueryFor(projectId: string, name: string) {
  const month = "newer_than:10d";
  if (projectId === "job-hillerodsholm" || /hillerødsholm|hillerodsholm/i.test(name)) {
    return `(Hillerødsholm OR Hillerodsholm OR Selskovvej) ${month}`;
  }
  if (projectId === "job-islevvaenge" || /islev/i.test(name)) return `(Islevvænge OR Islevvaenge OR Fortvej OR "Isv Rødovre" OR 02304) ${month}`;
  if (projectId === "job-kaerhuset" || /kærhuset|kaerhuset/i.test(name)) return `(Kærhuset OR Kaerhuset OR "Kær Bygade") ${month}`;
  if (projectId === "job-solbakkegaard" || /solbakke/i.test(name)) return `(Solbakkegård OR Solbakkegaard OR "Vester Snogbæk") ${month}`;
  const terms = sagSearchTerms(name);
  if (!terms.length) {
    const clean = name.replace(/"/g, "").trim() || "Zenko";
    return `"${clean}" ${month}`;
  }
  const or = terms.map((t) => (/\s/.test(t) ? `"${t.replace(/"/g, "")}"` : t)).join(" OR ");
  return `(${or}) ${month}`;
}

export function boardMailQuery(names: string[] = []) {
  const terms = [...new Set(names.flatMap(sagSearchTerms))];
  const list = terms.length
    ? terms
    : ["Hillerødsholm", "Hillerodsholm", "Islevvænge", "Islevvaenge", "Kærhuset", "Kaerhuset", "Solbakkegård", "Klostergården"];
  const or = list.map((t) => (/\s/.test(t) ? `"${t.replace(/"/g, "")}"` : t)).join(" OR ");
  return `(${or}) newer_than:10d`;
}

export function mailSnapshot(projectId: string, _name: string, _lang = "da"): MailSnap {
  return MAP[projectId] ?? { count: 0, headline: "Ingen mail i den seneste måned.", live: false, items: [] };
}

function isLin(m: MailItem) {
  return /lars ingtrup|\blin\b|lin@ole-jepsen/i.test(`${m.from} ${m.subject}`);
}
function isMeet(m: MailItem) {
  return /byggemøde|sikkerhedsmøde|projektmøde|referat/i.test(`${m.from} ${m.subject} ${m.snippet}`);
}
function isDeal(m: MailItem) {
  return /aftale|tilkøb|option|underskrift|as\s*\d|ekstra/i.test(`${m.subject} ${m.snippet}`);
}
function isMoney(m: MailItem) {
  return /faktura|kredit|krav|kr\b|økonomi/i.test(`${m.subject} ${m.snippet}`);
}

export function briefMailItems(items: MailItem[], projectName: string): string {
  if (!items.length) return `Ingen mail på ${projectName} den seneste måned.`;
  const lin = items.filter(isLin);
  const meet = items.filter(isMeet);
  const deal = items.filter(isDeal);
  const money = items.filter(isMoney);
  const newest = items[0]!;
  const lines = [
    `Overblik ${projectName} — seneste måned.`,
    `Nyest: ${newest.date} ${newest.from}: ${newest.subject}. ${newest.snippet}`,
  ];
  if (meet.length) {
    lines.push(`Møder: ${meet.slice(0, 4).map((m) => `${m.date} ${m.subject.replace(/^Hillerødsholm\s*-\s*/i, "")} (${m.snippet})`).join(" · ")}`);
  }
  if (lin.length) {
    lines.push(`LIN: ${lin.slice(0, 4).map((m) => `${m.date} ${m.subject.replace(/^Hillerødsholm\s*-\s*/i, "")} — ${m.snippet}`).join(" · ")}`);
  }
  if (deal.length) {
    lines.push(`Aftaler/tilkøb: ${deal.slice(0, 4).map((m) => `${m.date} ${m.snippet || m.subject}`).join(" · ")}`);
  }
  if (money.length) {
    lines.push(`Økonomi: ${money.slice(0, 3).map((m) => `${m.date} ${m.subject} — ${m.snippet}`).join(" · ")}`);
  }
  return lines.join("\n");
}

export function packMailItems(items: MailItem[], extraBodies?: Record<string, string>): string {
  return items
    .slice(0, 24)
    .map((m) => {
      const body = extraBodies?.[m.id];
      return `${m.date} | ${m.from} | ${m.subject}\n${body || m.snippet}`;
    })
    .join("\n\n");
}

export function scoreMail(item: MailItem, words: string[]): number {
  const blob = `${item.from} ${item.subject} ${item.snippet}`.toLowerCase();
  let s = 0;
  if (isLin(item)) s += 3;
  if (isMeet(item)) s += 2;
  if (isDeal(item)) s += 2;
  for (const w of words) if (blob.includes(w)) s += w.length >= 5 ? 4 : 2;
  return s;
}

export function parseMailDate(raw: string): Date {
  const m = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const year = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    return new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? new Date(0) : new Date(t);
}

export function mailWithinDays(item: MailItem, days: number, now = new Date()): boolean {
  const d = parseMailDate(item.date);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return d.getTime() >= start.getTime();
}

export function guessSag(item: MailItem, names: string[] = []): string {
  const blob = `${item.subject} ${item.snippet} ${item.from}`.toLowerCase();
  const ranked = [...names].filter((n) => n.trim().length >= 4).sort((a, b) => b.length - a.length);
  for (const n of ranked) {
    if (sagSearchTerms(n).some((t) => blob.includes(t.toLowerCase()))) return n;
  }
  if (/islev|fortvej|rødovre|rodovre|02304/.test(blob)) return "Islevvænge";
  if (/kærhuset|kaerhuset|kær bygade|kaer bygade/.test(blob)) return "Kærhuset";
  if (/solbakke|snogbæk|snogbaek/.test(blob)) return "Solbakkegård";
  if (/klostergård|klostergaard|klostervej/.test(blob)) return "Klostergården Hillerød";
  if (/hillerødsholm|hillerodsholm|selskov/.test(blob)) return "Hillerødsholm";
  return "";
}

export function mailKind(item: MailItem): "lin" | "meet" | "deal" | "money" | "mail" {
  if (isLin(item)) return "lin";
  if (isMeet(item)) return "meet";
  if (isDeal(item)) return "deal";
  if (isMoney(item)) return "money";
  return "mail";
}

export function boardHeadline(items: MailItem[]): string {
  if (!items.length) return "Ingen sag-mail de sidste 10 dage.";
  const meet = items.filter(isMeet);
  const lin = items.filter(isLin);
  const deal = items.filter(isDeal);
  const money = items.filter(isMoney);
  const bits: string[] = [`${items.length} mails på 10 dage.`];
  if (meet[0]) bits.push(`Møde: ${meet[0].subject.replace(/^Hillerødsholm\s*-\s*/i, "")}.`);
  if (lin[0]) bits.push(`LIN: ${lin[0].snippet || lin[0].subject}`);
  if (deal[0]) bits.push(`Aftale: ${deal[0].snippet || deal[0].subject}`);
  if (money[0]) bits.push(`Økonomi: ${money[0].subject}.`);
  if (bits.length === 1) bits.push(items[0]!.subject);
  return bits.join(" ");
}

export function recentBoardFallback(now = new Date()): MailItem[] {
  return HILLEROD_ITEMS.filter((m) => mailWithinDays(m, 10, now));
}
