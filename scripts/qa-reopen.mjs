import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

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
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("reopen-sager-active");

  await page.getByRole("button", { name: /Afsluttede sager/ }).first().click();
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  console.log("HAS_SOLBAKKE", /Solbakkegård/.test(body));
  console.log("HAS_SKOLE", /\bSkole\b/.test(body));
  console.log("HAS_1Y", /1-års/.test(body));
  console.log("HAS_5Y", /5-års/.test(body));
  console.log("HAS_GENABN", /Genåbn/.test(body));
  console.log("HAS_AFLEVERET", /Afleveret/.test(body));
  console.log("HAS_NU", /\bNu\b/.test(body));
  await shot("reopen-archived-list");

  await page.getByRole("button", { name: /Solbakkegård/ }).first().click();
  await page.waitForTimeout(400);
  const open = await page.locator("body").innerText();
  console.log("OPEN_NAME", /Solbakkegård/.test(open));
  console.log("OPEN_ARCHIVED", /Afsluttet/.test(open));
  console.log("OPEN_HAS_KS", /\bKS\b/.test(open));
  console.log("OPEN_NOT_FALLBACK_HILL", !/^Hillerødsholm$/m.test(open.split("\n")[0] ?? ""));
  await shot("reopen-archived-open");

  await page.getByRole("button", { name: /Afsluttede sager/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Genåbn" }).first().click();
  await page.waitForTimeout(300);
  const sheet = await page.locator("body").innerText();
  console.log("SHEET_WHY", /Hvorfor genåbnes/.test(sheet));
  console.log("SHEET_MANGLER", /Mangler/.test(sheet));
  console.log("SHEET_1Y", /1-års aflevering/.test(sheet));
  console.log("SHEET_5Y", /5-års aflevering/.test(sheet));
  await shot("reopen-why");

  await page.getByRole("button", { name: "1-års aflevering" }).click();
  await page.waitForTimeout(500);
  const after = await page.locator("body").innerText();
  console.log("AFTER_ACTIVE_REASON", /Aktiv · 1-års aflevering/.test(after));
  console.log("AFTER_NAME", /Solbakkegård/.test(after));
  await shot("reopen-active-again");

  await page.getByRole("button", { name: /Afsluttede sager/ }).first().click();
  await page.waitForTimeout(300);
  const rest = await page.locator("body").innerText();
  console.log("ARCHIVED_STILL_SOLBAKKE", /Solbakkegård/.test(rest));
  console.log("ARCHIVED_STILL_SKOLE", /\bSkole\b/.test(rest));
  await shot("reopen-archived-after");

  console.log("QA_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/reopen-fail.png" });
} finally {
  await browser.close();
}
