import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const APP = "a8a92f75-665c-4973-a97e-52db3d86be29";
const PAGE = "710c592f-a04c-4a1e-ad61-83951deb0a75";
const BLOCK = "ec0dca46-5bb0-43b4-9dd5-0f7acffa4c67";
const DS = "82cfbf72-d1f2-47c2-b539-64d35d02aa6e";
const LIST = `https://trey21664.softr.app/v1/datasource/applications/${APP}/pages/${PAGE}/blocks/${BLOCK}/datasources/${DS}/records`;
const DETAIL = (id) => `${LIST}/${id}`;
const SEED = "https://trey21664.softr.app/time-entries-details?recordId=a3N9NVt1E94Wzb";
const OUT_RAW = "/tmp/softr-ks-all-raw.json";
const PUBLIC = "/workspace/public/ks/softr";
const MANIFEST = "/workspace/src/lib/softr-ks-manifest.json";

const PROJECTS = [
  { re: /hillerød|hillerod/i, id: "job-hillerodsholm", name: "Hillerødsholm" },
  { re: /kær|kaer|ruskær|ruskaer/i, id: "job-kaerhuset", name: "Kærhuset" },
  { re: /islev|isv\b|rødovre afd/i, id: "job-islevvaenge", name: "Islevvænge" },
  { re: /prøve|prove|strandvej/i, id: "job-provestenen", name: "Prøvestenen Frederiksværk" },
  { re: /kloster/i, id: "job-klostergaarden", name: "Klostergården Hillerød" },
  { re: /solbak/i, id: "job-solbakkegaard", name: "Solbakkegård" },
];

function mapProject(label) {
  const s = String(label || "").trim();
  for (const p of PROJECTS) if (p.re.test(s)) return p;
  return null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SEED, { waitUntil: "networkidle", timeout: 45000 });

const meta = await page.evaluate(async (url) => {
  const r = await fetch(url);
  return await r.json();
}, `https://trey21664.softr.app/v1/datasource/applications/${APP}/pages/${PAGE}/blocks/${BLOCK}/datasources/${DS}/metadata`);
const fmap = Object.fromEntries((meta.fields || []).map((f) => [f.id, f.name]));
console.log("FIELDS", fmap);

async function postList(body) {
  return page.evaluate(async ({ url, body }) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text.slice(0, 200), status: r.status };
    }
  }, { url: LIST, body });
}

async function getRecord(id) {
  return page.evaluate(async (url) => {
    const r = await fetch(url);
    const t = await r.text();
    try { return JSON.parse(t); } catch { return null; }
  }, DETAIL(id));
}

const seen = new Map();
function ingest(items) {
  let n = 0;
  for (const it of items || []) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.set(it.id, it);
    n += 1;
  }
  return n;
}

const baseBody = { options: { timeZone: "UTC", userLocale: "da-DK" }, pageContext: null, filterCriteria: {} };
const first = await postList({ ...baseBody, limit: 500 });
console.log("first", first.total, first.items?.length, first.offset);
ingest(first.items);

const dates = [];
for (const [y, m, days] of [[2026, 3, 31], [2026, 4, 30], [2026, 5, 31], [2026, 6, 30], [2026, 7, 31], [2026, 8, 31], [2026, 9, 10]]) {
  for (let d = 1; d <= days; d++) dates.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}

const filterTries = [];
for (const date of dates) {
  filterTries.push({ filterCriteria: { kWf4Q: date } });
  filterTries.push({
    filterCriteria: {
      conjunction: "and",
      filterSet: [{ fieldId: "kWf4Q", operator: "is", value: date }],
    },
  });
}

let dateHits = 0;
for (const extra of [
  { limit: 100, offset: "100" },
  { limit: 100, offset: 200 },
  { skip: 100 },
  { pageContext: { offset: 100 } },
  { filterCriteria: { lWisM: "UKxNUVqzavCbJp" } },
  {
    filterCriteria: {
      conjunction: "and",
      filterSet: [{ fieldId: "lWisM", operator: "contains", value: "Kærhuset" }],
    },
  },
  { search: "Kærhuset Rødovre" },
  { search: "Isv" },
  { search: "Hillerødsholm" },
  { search: "Prøvestenen" },
]) {
  const data = await postList({ ...baseBody, ...extra });
  const n = ingest(data.items);
  if (n) console.log("extra+", n, "unique", seen.size, JSON.stringify(extra).slice(0, 80));
}

for (const date of ["2026-04-08", "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-03-16", "2026-03-17"]) {
  for (const schema of [
    { filterCriteria: { EntryDate: date } },
    { filterCriteria: { "Entry Date": date } },
    { filter: { "Entry Date": date } },
    {
      filterCriteria: {
        filters: [{ field: "Entry Date", operator: "=", value: date }],
      },
    },
  ]) {
    const data = await postList({ ...baseBody, ...schema });
    const n = ingest(data.items);
    if (n) {
      dateHits += n;
      console.log("date+", n, date, JSON.stringify(schema).slice(0, 70));
    }
  }
}

const existing = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
for (const row of existing) {
  if (seen.has(row.id)) continue;
  const rec = await getRecord(row.id);
  if (rec?.id) {
    ingest([rec]);
    console.log("detail+", rec.id, row.no);
  }
}

console.log("UNIQUE AFTER FETCH", seen.size, "total claimed", first.total);
fs.writeFileSync(OUT_RAW, JSON.stringify({ fmap, items: [...seen.values()] }, null, 2));

function val(fields, name) {
  const id = Object.entries(fmap).find(([, n]) => n === name)?.[0];
  const v = id ? fields?.[id] : undefined;
  if (v && typeof v === "object" && v.label) return v.label;
  return v;
}

const rows = [];
for (const rec of seen.values()) {
  const fields = rec.fields || {};
  const projLabel = val(fields, "Project Name") || val(fields, "Project") || "";
  const mapped = mapProject(projLabel);
  const photos = val(fields, "QC Photos");
  const list = Array.isArray(photos) ? photos : [];
  rows.push({
    id: rec.id,
    no: Number(val(fields, "Auto number") || 0),
    date: String(val(fields, "Entry Date") || "").slice(0, 10),
    user: String(val(fields, "User") || val(fields, "User Name") || "").trim(),
    qc: String(val(fields, "QC Name and no") || "").trim(),
    point: String(val(fields, "QC Name and no") || "").trim(),
    task: String(val(fields, "Task Title") || val(fields, "Task") || "").trim(),
    loc: String(val(fields, "Lokation") || "").trim(),
    scope: String(val(fields, "QC Kontrolomfang") || "").trim(),
    method: String(val(fields, "QC Kontrolmetode") || "").trim(),
    criteria: String(val(fields, "QC Godkendelses-kriterier") || "").trim(),
    hours: val(fields, "Hours") ?? null,
    kunde: val(fields, "Kundeliste") || "",
    projectId: mapped?.id || "",
    projectName: mapped?.name || String(projLabel).trim(),
    softrProject: String(projLabel).trim(),
    photosRaw: list.map((p) => ({
      url: p.url,
      name: p.name || p.filename || (p.id || "").split("/").pop() || "foto.jpg",
    })),
  });
}

fs.mkdirSync(PUBLIC, { recursive: true });
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return fs.statSync(dest).size;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  return fs.statSync(dest).size;
}

let ok = 0;
let fail = 0;
const queue = [];
for (const row of rows) {
  row.photos = [];
  for (const p of row.photosRaw) {
    const safe = String(p.name).replace(/[^\w.\-æøåÆØÅ]+/g, "_");
    const rel = `/ks/softr/${row.no}/${safe}`;
    const dest = path.join("/workspace/public", rel);
    queue.push({ row, p, safe, rel, dest });
  }
}

const conc = 6;
let i = 0;
async function worker() {
  while (i < queue.length) {
    const job = queue[i++];
    try {
      const bytes = await download(job.p.url, job.dest);
      job.row.photos.push({ file: job.rel, name: job.safe, bytes });
      ok += 1;
      if (ok % 25 === 0) console.log("photos", ok, "/", queue.length, "fail", fail);
    } catch (e) {
      fail += 1;
      console.log("FAIL", job.rel, e.message);
    }
  }
}
await Promise.all(Array.from({ length: conc }, () => worker()));
console.log("DOWNLOAD done", ok, "fail", fail);

for (const row of rows) delete row.photosRaw;
rows.sort((a, b) => a.no - b.no);
fs.writeFileSync(MANIFEST, JSON.stringify(rows, null, 2));
const by = {};
for (const r of rows) by[r.projectName || "?"] = (by[r.projectName || "?"] || 0) + 1;
console.log("MANIFEST", rows.length, "photos", ok, by);
await browser.close();
