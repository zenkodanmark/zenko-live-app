import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(40000);

try {
  await page.goto("http://127.0.0.1:8080/kunde/hilleroedsholm/komplet", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const screen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("SCREEN", {
    tilbage: screen.includes("Tilbage"),
    gem: screen.includes("Gem som PDF"),
    book: screen.includes("Kvalitetssikringshåndbog"),
    rap: /RAPPORT/.test(screen),
  });

  const pdfPath = "/workspace/screenshots/hillerod-komplet.pdf";
  const buf = await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  writeFileSync(pdfPath, buf);
  console.log("PDF_BYTES", buf.length);

  const py = `
from pypdf import PdfReader
r = PdfReader("${pdfPath}")
print("PAGES", len(r.pages))
for i, p in enumerate(r.pages, 1):
    t = (p.extract_text() or "").replace("\\n", " ")
    t = " ".join(t.split())
    has_book = "Kvalitetssikringshåndbog" in t or "Formål" in t
    has_rap = "PROCESKONTROL" in t or "RAPPORT" in t
    has_nav = "Tilbage" in t or "Gem som PDF" in t
    print(f"P{i}", {
        "book": has_book,
        "rap": has_rap,
        "nav": has_nav,
        "h1": "Hillerødsholm" in t,
        "snippet": t[:180],
    })
    if has_book and has_rap:
        print("FAIL handbook+rapport same page", i)
`;
  const out = execFileSync("python3", ["-c", py], { encoding: "utf8" });
  console.log(out);
} catch (err) {
  console.error("QA_FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
