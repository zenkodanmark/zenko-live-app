import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.waitForTimeout(800);
  console.log("ALEX_IN", /I dag|KS|Chat/i.test(await page.locator("body").innerText()));

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const after = await page.locator("body").innerText();
  console.log("SKIP_LOGIN", !/Vælg navn|Vælg medarbejder|PIN/i.test(after) && /I dag|KS|Chat/i.test(after));
  await shot("login-skip");

  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Log ud" }).click();
  await page.waitForTimeout(400);
  console.log("LOGOUT_CANCEL", /I dag|KS|Chat/i.test(await page.locator("body").innerText()));

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Log ud" }).click();
  await page.waitForTimeout(800);
  const login = await page.locator("body").innerText();
  console.log("LOGOUT_LIST", /Alex/.test(login) && /Ole/.test(login));
  await shot("login-after-out");

  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 12000 });
  await page.locator("nav").getByRole("button", { name: /Folk|Hold/i }).click().catch(() => {});
  await page.waitForTimeout(500);
  const folk = await page.locator("body").innerText();
  console.log("PUSH_SETUP", /Notifikationer|Tillad notifikationer|hjemmeskærm/i.test(folk));
  const sw = await page.evaluate(async () => {
    const r = await fetch("/sw.js");
    const t = await r.text();
    return r.ok && t.includes("addEventListener(\"push\"");
  });
  console.log("SW_PUSH", sw);
  await shot("ole-push-setup");
} catch (e) {
  console.log("FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/login-push-fail.png" });
} finally {
  await browser.close();
}
