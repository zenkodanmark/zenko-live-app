import { UDBUD_CORPUS } from "./udbud-corpus.ts";
import { stemDa } from "./udbud-synonyms.ts";
import type { ControlPoint, KsReport } from "./types.ts";

export type UdbudPart = {
  code: string;
  title: string;
  controlPoint: string;
  qcScope: string;
  qcMethod: string;
  keywords: string[];
};

export type UdbudScan = {
  projectId: string;
  fileName: string;
  found: boolean;
  parts: UdbudPart[];
  meta: { name: string; client: string; address: string; scope: string };
  scannedAt: string;
};

const LIVE = new Map<string, UdbudScan>();

const SKIP_TITLE =
  /^(generelt|orientering|omfang|lokalisering|tegning|tegningshenvisning|koordinering|projektering|undersøg|materialer|udførelse|mål og|prøver|arbejdsmiljø|kontrol|d&v|planlægning|tilstødende|indholdsfortegnelse|murerarbejdet|bygningsdele)$/i;

export function isMurerFile(name: string) {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/tomrer|stillads|tegning|byggepladsplan|maler|nedriv|ventilation|jordarbejder/.test(n)) return false;
  return /murer|murvaerk|murerarbejde|zmur/.test(n);
}

function wordsOf(s: string) {
  return s
    .toLowerCase()
    .replace(/[–—]/g, " ")
    .split(/[^a-zæøå0-9.]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function extraKeys(title: string) {
  const t = title.toLowerCase();
  const extra: string[] = [];
  if (/indervæg|indvendig/.test(t)) extra.push("indervæg", "indvendig", "indv", "puds", "overligger", "teglsten", "døre", "dørhuller");
  if (/ydervæg/.test(t)) extra.push("ydervæg", "facade", "binder", "omfugning", "mursten");
  if (/sokkel/.test(t)) extra.push("sokkel");
  if (/sålbænk|saalbaenk/.test(t)) extra.push("sålbænk", "saalbaenk");
  if (/vådrum|vaadrum/.test(t)) extra.push("vådrum", "fliser", "bad");
  if (/fundament/.test(t)) extra.push("fundament");
  if (/terrændæk|terraendaek/.test(t)) extra.push("terrændæk", "gulv");
  if (/overligger/.test(t)) extra.push("overligger", "teglsten", "døre");
  if (/puds|reparation|altan|filts|fils/.test(t)) extra.push("filsning", "filts", "filtsning", "vange", "altan", "puds");
  if (/omfug|fugning/.test(t)) extra.push("skorsten", "gesims", "udkasning", "udkradsning", "fugning", "omfugning");
  return extra;
}

export function parseUdbudParts(text: string): UdbudPart[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const found: { code: string; title: string; i: number }[] = [];
  const re = /^(\d+\.\d+\.\d+|\d{3}\.\d{2,3})\s+(.{2,90})$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(re);
    if (!m) continue;
    const code = m[1]!;
    let title = m[2]!.replace(/\.{2,}.*$/, "").replace(/\s+\d+\s*$/, "").replace(/[.\s]+$/, "").trim();
    title = title.replace(/^[-–•]+\s*/, "");
    const head = title.split(/[–,—]/)[0]!.trim();
    if (/^[234]\.\d+\.\d+$/.test(code)) continue;
    if (SKIP_TITLE.test(head)) continue;
    if (title.length < 3 || /^\d+$/.test(title)) continue;
    found.push({ code, title, i });
  }
  const by = new Map<string, { code: string; title: string; i: number }>();
  for (const f of found) {
    if (!by.has(f.code)) by.set(f.code, f);
  }
  const ordered = [...by.values()].sort((a, b) => a.i - b.i);
  const parts = ordered.map((f, idx) => {
    const keys = new Set([...wordsOf(f.title), ...extraKeys(f.title)]);
    const end = ordered[idx + 1]?.i ?? Math.min(f.i + 18, lines.length);
    let qcScope = "";
    let qcMethod = "";
    for (let i = f.i + 1; i < end; i++) {
      const line = lines[i]!;
      if (/^(\d+\.\d+\.\d+|\d{3}\.\d{2,3})\s/.test(line)) break;
      for (const w of wordsOf(line)) keys.add(w);
      if (/omfang/i.test(line) && !qcScope) qcScope = line.replace(/^.*omfang[:\s]*/i, "").slice(0, 180);
      if (/^4\.14\b|kontrol[:\s]/i.test(line) && line.length > 12) qcMethod = line.replace(/^.*kontrol[:\s]*/i, "").slice(0, 180);
    }
    return {
      code: f.code,
      title: f.title,
      controlPoint: f.code,
      qcScope,
      qcMethod,
      keywords: [...keys].filter((k) => k.length >= 3).slice(0, 40),
    };
  });
  for (const line of lines) {
    for (const p of parts) {
      if (!line.includes(p.code)) continue;
      for (const w of wordsOf(line)) p.keywords.push(w);
    }
  }
  for (const p of parts) p.keywords = [...new Set(p.keywords)].slice(0, 48);
  return parts;
}

export function parseUdbudMeta(text: string): UdbudScan["meta"] {
  const compact = text.replace(/\s+/g, " ");
  const nameHit = compact.match(/Kærhuset|Hillerødsholm|Islevvænge|Prøvestenen/i);
  const addr = compact.match(/Ruskær\s*35|Selskovvej[^.]{0,40}|Fortvej[^.]{0,40}|Strandvejen[^.]{0,40}/i);
  const scopeHit = compact.match(/Ombygning|NAB afd\.\s*\d+|Rødovre afd\.\s*\d+/i);
  return {
    name: nameHit?.[0] ?? "",
    client: "",
    address: addr?.[0]?.trim() ?? "",
    scope: scopeHit?.[0] ?? "",
  };
}

export function rememberUdbudPlan(scan: UdbudScan) {
  LIVE.set(scan.projectId, scan);
}

export function liveUdbudPlan(projectId: string) {
  return LIVE.get(projectId) ?? null;
}

function murerRows(projectId: string) {
  return (UDBUD_CORPUS[projectId] ?? []).filter((r) => isMurerFile(r.name));
}

export function bundledUdbudScan(projectId: string): UdbudScan | null {
  const rows = murerRows(projectId);
  if (!rows.length) {
    return {
      projectId,
      fileName: "",
      found: false,
      parts: [],
      meta: { name: "", client: "", address: "", scope: "" },
      scannedAt: "bundled",
    };
  }
  const seen = new Set<string>();
  const parts: UdbudPart[] = [];
  let meta: UdbudScan["meta"] = { name: "", client: "", address: "", scope: "" };
  for (const row of rows) {
    if (!meta.name) meta = parseUdbudMeta(row.text);
    for (const p of parseUdbudParts(row.text)) {
      if (seen.has(p.code)) continue;
      seen.add(p.code);
      parts.push(p);
    }
  }
  return {
    projectId,
    fileName: rows[0]!.name,
    found: true,
    parts,
    meta,
    scannedAt: "bundled",
  };
}

export function scanFromText(projectId: string, fileName: string, text: string): UdbudScan {
  const parts = parseUdbudParts(text);
  return {
    projectId,
    fileName,
    found: Boolean(fileName),
    parts,
    meta: parseUdbudMeta(text),
    scannedAt: new Date().toISOString(),
  };
}

export function planForProject(projectId: string): UdbudPart[] {
  return (LIVE.get(projectId) ?? bundledUdbudScan(projectId))?.parts ?? [];
}

export function scanForProject(projectId: string): UdbudScan {
  return LIVE.get(projectId) ?? bundledUdbudScan(projectId) ?? {
    projectId,
    fileName: "",
    found: false,
    parts: [],
    meta: { name: "", client: "", address: "", scope: "" },
    scannedAt: "",
  };
}

export function matchUdbudPart(hay: string, parts: UdbudPart[]): UdbudPart | null {
  if (!parts.length) return null;
  const h = hay.toLowerCase();
  let best: { p: UdbudPart; s: number } | null = null;
  for (const p of parts) {
    let s = 0;
    if (h.includes(p.code.toLowerCase())) s += 80;
    if (h.includes(p.title.toLowerCase())) s += 50;
    for (const k of p.keywords) {
      if (k.length < 4) continue;
      if (h.includes(k)) s += k.length >= 6 ? 6 : 3;
      else {
        const st = stemDa(k);
        if (st.length >= 5 && h.includes(st)) s += 2;
      }
    }
    if (!best || s > best.s) best = { p, s };
  }
  if (!best || best.s < 8) return null;
  return best.p;
}

export function partFromUdbud(report: Pick<KsReport, "point" | "task" | "location" | "projectId">, parts?: UdbudPart[]) {
  const plan = parts ?? planForProject(report.projectId);
  return matchUdbudPart(`${report.point} ${report.task} ${report.location ?? ""}`, plan);
}

export function controlPointsFromUdbud(projectId: string): ControlPoint[] {
  return planForProject(projectId).map((p) => ({
    code: p.code,
    title: p.title,
    hint: p.title,
    qcScope: p.qcScope || "Ifølge udbud.",
    method: p.qcMethod || "Visuel. Foto.",
    criteria: "Udført iht. udbud.",
    controlType: p.qcMethod || "Visuel",
    extent: p.qcScope || "",
    process: "Murerarbejde",
  }));
}
