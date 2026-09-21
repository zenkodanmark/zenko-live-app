import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const shots = "/workspace/screenshots";

function snip(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

async function shot(page, name) {
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function loginOle(page) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (await page.getByTestId("login-emp-ole").count()) {
    await page.getByTestId("login-emp-ole").click();
    await page.getByTestId("pin-pad").waitFor();
    for (const d of "1307") await page.getByTestId(`pin-${d}`).click();
  }
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 20000 });
}

async function pinSag(page, pin) {
  if (await page.getByTestId("sag-pin-input").count()) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(300);
  }
  if (await page.getByTestId("sag-pin-gate").count()) {
    for (const d of pin) {
      const btn = page.getByTestId(`sag-pin-${d}`);
      await btn.click();
    }
    await page.waitForTimeout(600);
  }
}

const fail = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  await loginOle(page);
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Islevvænge/i }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 15000 });
  await page.getByTestId("sag-row-ent").waitFor({ timeout: 15000 });
  await page.getByTestId("sag-row-ent").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 12000 });
  await page.waitForTimeout(2500);
  const list = await page.locator("body").innerText();
  const has002 = /Z-ER-2026-002/.test(list);
  const hasFilts = /Filtsning/i.test(list);
  const dummyCount = (list.match(/Z-ER-2026-001/g) || []).length;
  console.log("MASTER_ER_LIST", { has002, hasFilts, dummyCount, snippet: snip(list) });
  if (!has002) fail.push("master list missing Z-ER-2026-002");
  await shot(page, "hak-pdf-er-list");

  const row = page.locator("li").filter({ hasText: /Z-ER-2026-002/ }).first();
  const hak = row.getByTestId("ledelse-hak-Z-ER-2026-002");
  if (await hak.count()) {
    const on = await hak.getAttribute("data-ledelse");
    console.log("MASTER_ER_HAK", on);
    if (on !== "on") fail.push("filtsning hak not green");
  } else {
    console.log("MASTER_ER_HAK", "missing in row — open report");
  }
  const pdfChip = row.locator('[data-testid^="save-pdf-chip-er-"]').first();
  console.log("MASTER_ER_PDF_CHIP", (await pdfChip.count()) > 0);

  if (await row.count()) await row.locator("button").first().click();
  await page.waitForTimeout(800);
  const open = await page.locator("body").innerText();
  const pdfBtn = page.getByRole("button", { name: /Gem som PDF/i }).first();
  const hasPdf = (await pdfBtn.count()) > 0;
  const hasKunde = /Kunde/.test(open) && /Byggeleder/.test(open);
  console.log("MASTER_ER_OPEN", { hasPdf, hasKunde, snippet: snip(open) });
  if (!hasPdf) fail.push("open ER missing Gem som PDF");
  await shot(page, "hak-pdf-er-open");

  if (hasPdf) {
    try {
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 25000 }),
        pdfBtn.click(),
      ]);
      const name = dl.suggestedFilename();
      const p = await dl.path();
      const fs = await import("node:fs");
      const bytes = p ? fs.readFileSync(p) : Buffer.alloc(0);
      console.log("MASTER_ER_PDF", { name, bytes: bytes.length, magic: bytes.slice(0, 4).toString() });
      if (bytes.slice(0, 4).toString() !== "%PDF") fail.push("ER pdf not a file");
    } catch (e) {
      console.log("MASTER_ER_PDF_FAIL", String(e));
      fail.push("ER pdf download failed");
    }
  }

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Hillerødsholm|Hilleroedsholm/i }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 15000 });
  await page.getByTestId("sag-row-slip").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 12000 });
  await page.waitForTimeout(1200);
  const asList = await page.locator("body").innerText();
  console.log("MASTER_AS_LIST", { has007: /Z-AS-2026-007/.test(asList), price: /255\.810/.test(asList), snippet: snip(asList) });
  const asRow = page.locator("li").filter({ hasText: /Z-AS-2026-007/ }).first();
  if (await asRow.count()) await asRow.locator("button").first().click();
  await page.waitForTimeout(800);
  const asOpen = await page.locator("body").innerText();
  const asPdf = page.getByRole("button", { name: /Gem som PDF/i }).first();
  const asHasPdf = (await asPdf.count()) > 0;
  const asPrice = /255\.810/.test(asOpen);
  console.log("MASTER_AS_OPEN", { asHasPdf, asPrice, snippet: snip(asOpen) });
  if (!asHasPdf) fail.push("AS 007 missing Gem som PDF");
  if (!asPrice) fail.push("AS 007 missing 255.810");
  await shot(page, "hak-pdf-as-007");
  if (asHasPdf) {
    try {
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 25000 }),
        asPdf.click(),
      ]);
      const fs = await import("node:fs");
      const p = await dl.path();
      const bytes = p ? fs.readFileSync(p) : Buffer.alloc(0);
      console.log("MASTER_AS_PDF", { name: dl.suggestedFilename(), bytes: bytes.length, magic: bytes.slice(0, 4).toString() });
      if (bytes.slice(0, 4).toString() !== "%PDF") fail.push("AS pdf not a file");
    } catch (e) {
      console.log("MASTER_AS_PDF_FAIL", String(e));
      fail.push("AS pdf download failed");
    }
  }
  await ctx.close();

  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const sag = await guest.newPage();
  sag.setDefaultTimeout(25000);
  await sag.goto("http://127.0.0.1:8080/sag/islevvaenge/er/Z-ER-2026-002", { waitUntil: "networkidle" });
  await pinSag(sag, "4000");
  await sag.waitForTimeout(2500);
  const gbody = await sag.locator("body").innerText();
  const pinLeft = (await sag.getByTestId("sag-pin-gate").count()) > 0;
  const gPdf = sag.getByRole("button", { name: /Gem som PDF/i }).first();
  const gHas = (await gPdf.count()) > 0;
  const gFilts = /Filtsning/i.test(gbody);
  const gMissing = /findes ikke/i.test(gbody);
  console.log("SAG_ER_002", { pinLeft, gHas, gFilts, gMissing, snippet: snip(gbody) });
  await shot(sag, "hak-pdf-sag-er-002");
  if (pinLeft) fail.push("byggeleder pin stuck");
  if (gMissing) fail.push("byggeleder missing Filtsning ER");
  if (!gHas) fail.push("byggeleder missing Gem som PDF");
  if (gHas) {
    try {
      const [dl] = await Promise.all([
        sag.waitForEvent("download", { timeout: 25000 }),
        gPdf.click(),
      ]);
      const fs = await import("node:fs");
      const p = await dl.path();
      const bytes = p ? fs.readFileSync(p) : Buffer.alloc(0);
      console.log("SAG_ER_PDF", { name: dl.suggestedFilename(), bytes: bytes.length, magic: bytes.slice(0, 4).toString() });
      if (bytes.slice(0, 4).toString() !== "%PDF") fail.push("byggeleder pdf not a file");
    } catch (e) {
      console.log("SAG_ER_PDF_FAIL", String(e));
      fail.push("byggeleder pdf download failed");
    }
  }
  await guest.close();
} finally {
  await browser.close();
}

console.log("FAILS", fail);
if (fail.length) process.exit(1);
