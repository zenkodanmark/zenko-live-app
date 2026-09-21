import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  BODY_GAP_PT,
  collapseRepeatedCopy,
  descriptionOnce,
  drawPdfBytes,
  flowBody,
  headingFor,
  isNumberedHeading,
  keptPrice,
  noteOnce,
  paginateKeepTogether,
  pdfFilename,
  pdfPhotoIds,
  pdfStoragePath,
  pdfText,
  photoBoxHeight,
  uniquePhotoList,
  unstickQuotes,
  wrapLines,
} from "./render-pdf.ts";

const ER_ONCE =
  "Facaden vaskes med Fila Deterdek Pro i blandingsforhold 1:20 og skures med stiv kost. Formålet er at fjerne kalk- og cementslør, så stenene står rene.\nNår slør, byggestøv og gammel snavs løsnes fra stenen, kan en del af det sætte sig i fugerne. Fugerne får derved et gråligt skær og ser matte ud. Det er en følge af rengøringen, ikke en skade i fugen.\nDerefter vaskes sten og fuger med Jotun Husvask tilsat ganske lidt rødt pulver — samme pulver, som er blandet i fugen. Behandlingen svarer til den, man bruger, når nye mursten skal ligne de eksisterende.\nDet er en kosmetisk efterbehandling. Vejrliget vil over tid give det samme udtryk.";

function extractPages(bytes: Uint8Array) {
  const path = `/tmp/zenko-pdf-pages-${process.pid}.pdf`;
  writeFileSync(path, bytes);
  const py = spawnSync(
    "python3",
    [
      "-c",
      "from pypdf import PdfReader; import sys, json; r=PdfReader(sys.argv[1]); print(json.dumps([(p.extract_text() or '') for p in r.pages]))",
      path,
    ],
    { encoding: "utf8" },
  );
  if (py.status !== 0) throw new Error(py.stderr || "pypdf failed");
  return JSON.parse(py.stdout) as string[];
}

test("255.810 bliver stående som 255.810,- — ingen gæt", () => {
  assert.equal(keptPrice("255.810 eksk"), "255.810,-");
  assert.equal(keptPrice("255.810 ekskl. moms"), "255.810,-");
});

test("PDF-filnavn og sti under sagen", () => {
  assert.equal(pdfFilename("Z-AS-2026-007"), "Z-AS-2026-007.pdf");
  assert.equal(pdfStoragePath("job-hillerodsholm", "Z-AS-2026-007"), "job-hillerodsholm/pdf/Z-AS-2026-007.pdf");
});

test("overskrifter", () => {
  assert.match(headingFor("as", "Z-AS-2026-007"), /Aftaleseddel/);
  assert.match(headingFor("er", "Z-ER-2026-002"), /Entreprenør/);
  assert.match(headingFor("todo", "td-1"), /To-do/);
});

test("page-break-inside: avoid — foto og titel flækkes ikke", () => {
  const page = 700;
  const blocks = [
    { key: "title", h: 80 },
    { key: "body", h: 120 },
    { key: "price", h: 40 },
    { key: "photo-1", h: 240 },
    { key: "photo-2", h: 240 },
    { key: "photo-3", h: 240 },
  ];
  const pages = paginateKeepTogether(blocks, page);
  for (const p of pages) {
    assert.ok(p.length >= 1);
  }
  const photoPages = pages.map((p) => p.filter((k) => k.startsWith("photo-")));
  for (const p of photoPages) {
    for (const key of p) {
      assert.equal(p.filter((k) => k === key).length, 1);
    }
  }
  assert.ok(pages.some((p) => p.includes("title") && p.includes("body")));
  assert.ok(photoBoxHeight(1600, 900) <= 240 + 16);
});

test("lange linjer wraps, tom body giver ikke tom side-logik", () => {
  const lines = wrapLines("aaa bbb ccc ddd", 5);
  assert.ok(lines.length >= 2);
});

test("pdfText omskriver ikke æøå eller rumænsk", () => {
  const s = "Rengøring æøå ÆØÅ ü ß ă â î ș ț";
  assert.equal(pdfText(s), s);
  assert.equal(pdfText(s).includes("oe"), false);
  assert.equal(pdfText("Formålet").includes("aa"), false);
});

test("duplikeret body klappes til én kopi", () => {
  const glued = ER_ONCE + ER_ONCE;
  assert.equal(collapseRepeatedCopy(glued), ER_ONCE);
  const once = descriptionOnce("Rengøring af facade.", glued);
  assert.equal(once.title, "Rengøring af facade.");
  assert.equal(once.body, ER_ONCE);
  assert.equal(noteOnce("Rengøring af facade.", ER_ONCE, "Rengøring af facade."), "");
});

test("drawPdfBytes tåler linjeskift og laver rigtig PDF-fil", async () => {
  const bytes = await drawPdfBytes({
    kind: "as",
    id: "slip-hillerodsholm-tb-kaelder-2026",
    number: "Z-AS-2026-007",
    title: "Kælder\nmed to linjer",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    customer: "Bygherre",
    createdAt: "2026-01-15T10:00:00.000Z",
    body: "Beskrivelse linje 1\n\nAnden linje med æøå.",
    extra: "Bemærkning",
    extraHeading: "Kunde bemærkning",
    priceRaw: "255.810 eksk",
    photos: [],
  });
  assert.ok(bytes.byteLength > 400);
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), "%PDF");
});

test("Z-ER-2026-003: ÆØÅ i titel og body, én beskrivelse", async () => {
  const bytes = await drawPdfBytes({
    kind: "er",
    id: "ent-3db570d9-7adc-4b7d-ab9e-0c4455df532d",
    number: "Z-ER-2026-003",
    title: "Rengøring af facade.",
    projectId: "job-islevvaenge",
    projectName: "Islevvænge",
    customer: "Bygherre",
    createdAt: "2026-09-21T12:50:22.748Z",
    body: ER_ONCE + ER_ONCE,
    extra: "Rengøring af facade.",
    extraHeading: "Bemærkning",
    photos: [],
  });
  const raw = Buffer.from(bytes).toString("latin1");
  assert.equal(raw.includes("Rengoering"), false);
  assert.equal(raw.includes("Entreprenoerrapport"), false);
  assert.equal(raw.includes("Formaalet"), false);
  assert.equal(raw.includes("loesnes"), false);
  assert.equal(raw.includes("graaligt"), false);
  const text = extractPages(bytes).join("\n");
  for (const word of [
    "Rengøring",
    "Entreprenørrapport",
    "Formålet",
    "slør",
    "så",
    "støv",
    "løsnes",
    "sætte",
    "gråligt",
    "skær",
    "følge",
    "rødt",
    "Islevvænge",
  ]) {
    assert.match(text, new RegExp(word));
  }
  assert.equal((text.match(/Fila Deterdek Pro/g) || []).length, 1);
  assert.equal((text.match(/Formålet/g) || []).length, 1);
  assert.doesNotMatch(text, /Rengoering|Entreprenoerrapport|Formaalet|sloer|stoev|loesnes|graaligt/);
});

test("fotos: photo_ids-rækkefølge, ingen concat af to lister", () => {
  const a = "https://example.com/er/img_5940.jpeg";
  const b = "https://example.com/er/img_5941.jpeg";
  assert.deepEqual(uniquePhotoList([a, b, a, b, a + "?v=2"]), [a, b]);
  assert.deepEqual(pdfPhotoIds([a, b], [a, b]), [a, b]);
  assert.deepEqual(pdfPhotoIds([], [a, b]), [a, b]);
  assert.equal(pdfPhotoIds([a, b], [a, b]).length, 2);
  assert.deepEqual(pdfPhotoIds(["softr-as-396-1", "softr-as-396-2"], [a, b]), [a, b]);
  assert.equal(pdfPhotoIds([a, b, a], [a, b, a, b]).length, 2);
});

test("Z-ER-2026-004: to unikke fotos, ikke fire", async () => {
  const a = "https://jauggqxhemjnbxoxkpeh.supabase.co/storage/v1/object/public/plads/job-islevvaenge/er/mubbf4tq-img_5940.jpeg";
  const b = "https://jauggqxhemjnbxoxkpeh.supabase.co/storage/v1/object/public/plads/job-islevvaenge/er/mubbf5jl-img_5941.jpeg";
  const cache = new Map<string, Uint8Array>();
  async function load(src: string) {
    if (cache.has(src)) return cache.get(src)!;
    const res = await fetch(src);
    assert.equal(res.ok, true, src);
    const buf = new Uint8Array(await res.arrayBuffer());
    cache.set(src, buf);
    return buf;
  }
  await load(a);
  await load(b);
  const bytes = await drawPdfBytes(
    {
      kind: "er",
      id: "ent-84145120-e284-4eab-95da-decac7254e74",
      number: "Z-ER-2026-004",
      title: "Rengøring af facade.",
      projectId: "job-islevvaenge",
      projectName: "Islevvænge",
      customer: "Bygherre",
      createdAt: "2026-09-21T14:00:00.000Z",
      body: ER_ONCE,
      extra: "Rengøring af facade.",
      photos: [
        { src: a },
        { src: b },
        { src: a },
        { src: b },
      ],
    },
    load,
  );
  const path = `/tmp/Z-ER-2026-004-test.pdf`;
  writeFileSync(path, bytes);
  const py = spawnSync(
    "python3",
    [
      "-c",
      "from pypdf import PdfReader\nimport sys\nr = PdfReader(sys.argv[1])\nn = 0\nfor p in r.pages:\n    res = p.get('/Resources')\n    if not res: continue\n    x = res.get('/XObject')\n    if not x: continue\n    x = x.get_object()\n    for k in x:\n        obj = x[k].get_object()\n        if obj.get('/Subtype') == '/Image':\n            n += 1\ntext = '\\n'.join((p.extract_text() or '') for p in r.pages)\nprint(n, len(r.pages), text.count('Rengøring'), text.count('Formålet'))",
      path,
    ],
    { encoding: "utf8" },
  );
  if (py.status !== 0) throw new Error(py.stderr || "pypdf failed");
  const [images, pages, rengoring, formaalet] = py.stdout.trim().split(/\s+/).map(Number);
  assert.equal(images, 2);
  assert.ok(pages >= 1 && pages <= 3, `pages=${pages}`);
  assert.equal(rengoring, 1);
  assert.equal(formaalet, 1);
});

const ER_002 =
  "1. Indledning\nVi har modtaget tilsynsnotatet af 05.08.2026, hvori det konstateres, at der er udført filtsning af gavle i række 21 i fuldt solskin uden afdækning, og at lufttemperaturen ifølge vejr-app var 27 °C i skyggen. \nDer henvises til Mur & Tag – Overfladebehandling med tynde mørtellag, udførelse, og det udførte arbejde kan ikke godkendes.\nVi har har gennemgået både de faktiske udførelsesforhold og de tekniske krav grundigt. \nNedenfor følger en teknisk redegørelse baseret på de gældende anvisninger og de konkrete forhold på byggepladsen.\n\n2. Det præcise krav i Mur & Tag\nMur & Tag stiller følgende krav (citat):«Murværkets overfladetemperatur skal være mellem 5 °C og 25 °C under udførelse og hærdneperiode, hvilket udelukker tyndpudsarbejde i direkte sol og i vinterhalvåret, med mindre der er etableret totalinddækning og opvarmning af konstruktionen.\n»Det afgørende parameter er overfladetemperaturen på murværket – ikke lufttemperaturen.\nWeber angiver tilsvarende, at temperaturen under udførelse og hærdeperiode skal være minimum 5 °C, og i deres pudsevejledninger præciseres, at tyndpudsning skal ske, når både luft- og murværkstemperatur ligger mellem 5 °C og 25 °C.\n\n3. Dokumentation i tilsynsnotatet\nTilsynsnotatet dokumenterer lufttemperaturen (27 °C i skyggen) via en vejr-app. \nDer er ikke foretaget måling af den faktiske overfladetemperatur på murværket under udførsel. \nLufttemperatur og overfladetemperatur er to forskellige størrelser. \nEn 24 cm massiv murstensvæg har betydelig termisk masse. \nDen opvarmes og afkøles langsomt og følger ikke momentant lufttemperaturen. Uden en konkret måling (f.eks. med infrarødt termometer eller kontakttermometer) er det ikke dokumenteret, at overfladetemperaturen har overskredet 25 °C.\n\n4. Udførte foranstaltninger – forvanding\nFacaden er forvandede grundigt inden påføring af tyndpudsmørtlen. Formålet med forvanding er dobbelt: \nAt regulere underlagets sugeevne, så mørtlen ikke mister vand for hurtigt til murværket.\nAt udnytte fordampningskøling. Fordampning af vand kræver energi (fordampningsvarme ca. 2250–2450 kJ/kg), som tages fra overfladen. Herved opnås en lokal køleeffekt, der midlertidigt sænker overfladetemperaturen.\nForvanding er den standardprocedure, der anbefales både af Mur & Tag og af Weber for at sikre korrekt udførelse under varme forhold. Den er udført systematisk for at kompensere for de aktuelle vejrforhold. (det ses på billeder i TN at murværket er fugtigt)\n\n5. Efterfølgende kontrol af overfladerne\nEfter udførelsen er samtlige filtsede overflader systematisk gennemgået visuelt. \nDer er ikke konstateret en eneste synlig svindrevne eller andre tegn på for hurtig udtørring.\nHvis der havde været en kritisk for hurtig udtørring som følge af for høj overfladetemperatur, ville man forvente synlige krakelerings- eller svindrevner i det tynde lag. Disse er ikke til stede.\n\n6. Sammenfatning af de tekniske forhold der taler for godkendelse\nKravet i Mur & Tag er overfladetemperatur 5–25 °C – ikke lufttemperatur.\nDer foreligger ingen måling af den faktiske overfladetemperatur.Der er tale om en 24 cm massiv murstensvæg med høj termisk masse.\nFacaden er grundigt forvandede, hvilket både regulerer sugeevnen og giver fordampningskøling.\nDer er efter udførelsen ikke konstateret synlige svindrevner eller andre skader, der indikerer for hurtig udtørring.\nArbejdet er udført i overensstemmelse med de praktiske foranstaltninger, som både Mur & Tag og Weber anbefaler under varme forhold (forvanding og kontrol af overfladen).\n\n7. Konklusion\nPå baggrund af ovenstående vurderer vi, at det udførte uden fejl og arbejde teknisk set er forsvarlig\n\nSe billeder af alle facader R21 B";

test("nummererede linjer er overskrift, « klistrer ikke, tom linje er luft", () => {
  assert.equal(BODY_GAP_PT >= 10, true);
  assert.equal(isNumberedHeading("1. Indledning"), true);
  assert.equal(isNumberedHeading("7. Konklusion"), true);
  assert.equal(isNumberedHeading("Vi har modtaget"), false);
  assert.equal(unstickQuotes("(citat):«Murværkets"), "(citat):«\nMurværkets");
  assert.equal(unstickQuotes("»Det afgørende"), "»\nDet afgørende");
  const items = flowBody(ER_002, (t) => wrapLines(t, 90));
  const heads = items.filter((i) => i.kind === "heading");
  assert.equal(heads.length, 7);
  assert.match(heads[0]!.lines.join(" "), /1\.\s+Indledning/);
  assert.match(heads[6]!.lines.join(" "), /7\.\s+Konklusion/);
  let gapsBeforeHead = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.kind !== "heading") continue;
    if (i === 0) continue;
    const prev = items[i - 1]!;
    assert.equal(prev.kind, "gap");
    assert.ok(prev.h >= 10, `gap ${prev.h} < 10`);
    gapsBeforeHead += 1;
  }
  assert.equal(gapsBeforeHead, 6);
});

test("Z-ER-2026-002: side 1 har Beskrivelse, syv punkter med luft, ingen citat-klister", async () => {
  const bytes = await drawPdfBytes({
    kind: "er",
    id: "ent-filtsning-tf396",
    number: "Z-ER-2026-002",
    title: "Vedr.: Tilsynsnotat facader dateret 05.08.2026",
    projectId: "job-islevvaenge",
    projectName: "Islevvænge",
    customer: "Bygherre",
    createdAt: "2026-08-13T08:06:23.189Z",
    body: ER_002,
    extra: "",
    photos: [],
  });
  const path = `/tmp/Z-ER-2026-002-test.pdf`;
  writeFileSync(path, bytes);
  const pages = extractPages(bytes);
  assert.ok(pages.length >= 1, "pdf has pages");
  const page1 = pages[0] || "";
  assert.match(page1, /Beskrivelse/);
  assert.match(page1, /1\.\s*Indledning/);
  const all = pages.join("\n");
  assert.equal(all.includes("(citat):«Mur"), false);
  assert.equal(all.includes("citat):«Mur"), false);
  assert.equal(all.includes("«Murværkets"), false);
  for (const label of [
    "1. Indledning",
    "2. Det præcise krav",
    "3. Dokumentation",
    "4. Udførte foranstaltninger",
    "5. Efterfølgende kontrol",
    "6. Sammenfatning",
    "7. Konklusion",
  ]) {
    assert.ok(all.includes(label), `missing ${label}`);
  }
  const py = spawnSync(
    "python3",
    [
      "-c",
      "from pypdf import PdfReader\nimport sys, json, re\nr=PdfReader(sys.argv[1])\nrows=[]\nfor pi,p in enumerate(r.pages):\n    def vis(text, cm, tm, fontDict, fontSize, _pi=pi):\n        t=(text or '').strip()\n        if t: rows.append({'t':t,'y':round(tm[5],1),'page':_pi})\n    p.extract_text(visitor_text=vis)\nheads=[x for x in rows if re.match(r'^\\d+\\.\\s', x['t'])]\nprint(json.dumps({'pages':len(r.pages),'heads':heads,'page0':[x['t'] for x in rows if x['page']==0][:12]}))",
      path,
    ],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  );
  if (py.status !== 0) throw new Error(py.stderr || "pypdf visitor failed");
  const info = JSON.parse(py.stdout) as {
    pages: number;
    heads: { t: string; y: number; page: number }[];
    page0: string[];
  };
  assert.ok(info.page0.some((t) => /Beskrivelse/.test(t)));
  assert.ok(info.page0.some((t) => /1\.\s*Indledning/.test(t)));
  const numbered = info.heads.filter((h) => /^\d+\.\s/.test(h.t));
  assert.ok(numbered.length >= 7, `heads=${numbered.length} ${JSON.stringify(numbered)}`);
  const byPage = new Map<number, { t: string; y: number }[]>();
  for (const row of numbered) {
    const list = byPage.get(row.page) || [];
    list.push(row);
    byPage.set(row.page, list);
  }
  for (const list of byPage.values()) {
    list.sort((a, b) => b.y - a.y);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i - 1]!.y - list[i]!.y;
      assert.ok(gap >= 20, `heading gap ${gap} between ${list[i - 1]!.t} and ${list[i]!.t}`);
    }
  }
});

