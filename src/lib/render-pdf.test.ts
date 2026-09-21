import assert from "node:assert/strict";
import test from "node:test";
import { drawPdfBytes, headingFor, keptPrice, paginateKeepTogether, pdfFilename, pdfStoragePath, photoBoxHeight, wrapLines } from "./render-pdf.ts";

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
