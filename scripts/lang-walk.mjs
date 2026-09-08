import { chromium } from "playwright";

const DA = [
  "Pinkode",
  "Mød ind på pladsen",
  "Jeg er mødt",
  "Gå hjem",
  "Planlægning",
  "Vælg medarbejder",
  "Åbn stemmehjælper",
  "Forkert pinkode",
  "I dag",
  "Log ud",
  "Sag-bot",
  "Er du sikker? Du logges ud",
];

function leftovers(text) {
  return DA.filter((w) => text.includes(w));
}

async function login(page, empId, pin) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const loginBtn = page.locator(`[data-testid="login-${empId}"]`);
  try {
    await loginBtn.waitFor({ timeout: 8000 });
  } catch {
    const out = page.getByRole("button", { name: /Ieșire|Wyloguj|Salir|Abmelden|Log out|Вийти|Log ud/i }).first();
    if (await out.count()) {
      page.once("dialog", (d) => d.accept());
      await out.click();
      await page.waitForTimeout(600);
    }
  }
  await loginBtn.waitFor({ timeout: 15000 });
  await loginBtn.click();
  await page.waitForSelector("[data-testid=pin-pad]");
  for (const d of pin) {
    await page.locator("[data-testid=pin-pad] button", { hasText: new RegExp(`^${d}$`) }).first().click();
  }
  await page.waitForTimeout(900);
}

async function walk(page, name) {
  const report = [];
  const tabs = page.locator("nav button");
  const n = await tabs.count();
  const labels = [];
  for (let i = 0; i < n; i++) labels.push(((await tabs.nth(i).innerText()) || "").replace(/\s+/g, " ").trim());
  report.push({ where: "nav", labels, da: leftovers(labels.join(" | ")) });
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(500);
    const text = await page.locator("main").innerText();
    report.push({
      where: labels[i] || `tab-${i}`,
      sample: text.slice(0, 280).replace(/\s+/g, " "),
      da: leftovers(text),
      helper: /Deschide asistent vocal|Otwórz głosowego|Abrir ayudante|Öffne Sprachhelfer|Open voice helper|Відкрий голосового/i.test(text),
    });
  }
  console.log("\n===", name, "===");
  console.log(JSON.stringify(report, null, 2));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
try {
  await login(page, "emp-ion", "3333");
  await walk(page, "ION ro");
  await page.getByRole("button", { name: "Șantier" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/ion-sag.png", fullPage: true });
  await login(page, "emp-marius", "4444");
  await walk(page, "MARIUS pl");
  await login(page, "emp-osvaldo", "5555");
  await walk(page, "OSVALDO es");
  await login(page, "emp-federico", "2222");
  await walk(page, "FEDERICO es mester");
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: "/tmp/lang-fail.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
