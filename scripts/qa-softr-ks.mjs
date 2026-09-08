import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.setDefaultTimeout(20000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.waitForTimeout(200);
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
    await page.waitForTimeout(80);
  }
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.getByRole("button", { name: "Hillerødsholm" }).first().click();
  await page.waitForTimeout(250);
  await page.locator("button").filter({ hasText: "KS-rapporter" }).first().click();
  await page.waitForTimeout(500);
  await shot("ks-list-photos");
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /\bKS 45\b/.test(x.textContent ?? ""));
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  });
  console.log("CLICKED_45", clicked);
  await page.waitForTimeout(900);
  await shot("ks-45-photos");
  const imgs = await page.locator('img[src*="/ks/softr/"]').count();
  console.log("SOFTR_IMGS", imgs);
  const doc = await page.locator("body").innerText();
  console.log("DOC_OSVALDO", /Osvaldo/.test(doc));
  console.log("DOC_20MM", /20 mm/.test(doc));
  console.log("DOC_MISSING", /Fotos mangler/.test(doc));
  console.log("DOC_BILLEDER", /BILLEDER/.test(doc));
} catch (err) {
  console.error("FAIL", err.message);
  await shot("softr-ks-fail");
  process.exitCode = 1;
} finally {
  await browser.close();
}
