import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  collapseRepeatedCopy,
  descriptionOnce,
  drawPdfBytes,
  headingFor,
  keptPrice,
  noteOnce,
  paginateKeepTogether,
  pdfFilename,
  pdfStoragePath,
  pdfText,
  photoBoxHeight,
  wrapLines,
} from "./render-pdf.ts";

const ER_ONCE =
  "Facaden vaskes med Fila Deterdek Pro i blandingsforhold 1:20 og skures med stiv kost. Formålet er at fjerne kalk- og cementslør, så stenene står rene.\nNår slør, byggestøv og gammel snavs løsnes fra stenen, kan en del af det sætte sig i fugerne. Fugerne får derved et gråligt skær og ser matte ud. Det er en følge af rengøringen, ikke en skade i fugen.\nDerefter vaskes sten og fuger med Jotun Husvask tilsat ganske lidt rødt pulver — samme pulver, som er blandet i fugen. Behandlingen svarer til den, man bruger, når nye mursten skal ligne de eksisterende.\nDet er en kosmetisk efterbehandling. Vejrliget vil over tid give det samme udtryk.";

function extractPdf(bytes: Uint8Array) {
  const path = `/tmp/zenko-pdf-test-${process.pid}.pdf`;
  writeFileSync(path, bytes);
  const py = spawnSync(
    "python3",
    [
      "-c",
      "from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); print('\\n'.join((p.extract_text() or '') for p in r.pages))",
      path,
    ],
    { encoding: "utf8" },
  );
  if (py.status !== 0) throw new Error(py.stderr || "pypdf failed");
  return py.stdout;
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
  const text = extractPdf(bytes);
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
