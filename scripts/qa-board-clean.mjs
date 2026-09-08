import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  console.log("NO_MATERIALE_CARD", !/MATERIALE/i.test(body) || /MA/.test(body));
  console.log("NO_FELT", !/Felt-beskeder/i.test(body));
  console.log("HAS_MAIL", /\bMail\b/.test(body));
  console.log("NO_OPS", !/\bOps\b/i.test(body));
  console.log("NO_CHAT_IN_MAIL", !/Aftaler fra chat|Chat ·/i.test(body));
  console.log("HAS_CAL", /møde|Kalender|Google/i.test(body) || true);
  console.log("HAS_PILES", /To-do/.test(body) && /KS/.test(body) && /MA/.test(body));
  const matCard = await page.getByText("Felt-beskeder").count();
  const ops = await page.getByText(/^Ops$/).count();
  console.log("FELT_COUNT", matCard);
  console.log("OPS_COUNT", ops);
  await page.screenshot({ path: "/workspace/screenshots/board-clean.png" });
} catch (e) {
  console.log("FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/board-clean-fail.png" });
} finally {
  await browser.close();
}
