import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function tapNav(label) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label, "i") }).click();
  await page.waitForTimeout(400);
}

async function fresh() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8z8BQz0AEYBxVSF+FAP5IAv6knsWvAAAAAElFTkSuQmCC",
  "base64",
);

try {
  await fresh();
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  const today = await page.locator("body").innerText();
  console.log("CHAT_BANNER_TODAY", /nye beskeder/i.test(today));
  console.log("CHAT_NAV_BRICK", (await page.locator("nav button.bg-brick").count()) > 0);
  await shot("chat-banner-today");

  await tapNav("Chat");
  const chat = await page.locator("body").innerText();
  console.log("CHAT_NEW_BANNER", /nye beskeder/i.test(chat));
  console.log("CHAT_UNREAD_COLOR", (await page.locator("button.bg-brick").count()) > 0);
  console.log("CHAT_NOT_MAIL", !/Aktive chat/i.test(chat));
  await shot("chat-unread");

  await page.getByRole("button", { name: /Ny chat/i }).click();
  await page.getByText(/Tryk navne|personer/i).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /^Alex$/ }).click();
  const gal = page.getByTestId("chat-gallery-input");
  console.log("GAL_COUNT", await gal.count());
  await gal.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await page.waitForTimeout(600);
  console.log("CHAT_PHOTO_DRAFT", (await page.locator("img").count()) > 0);
  console.log("CHAT_PHOTO_READY", /ligger klar|tryk Send/i.test(await page.locator("body").innerText()));
  await shot("chat-photo-draft");
  await page.locator('button[aria-label="Send"]').click({ force: true });
  await page.waitForTimeout(700);
  console.log("CHAT_PHOTO_SENT", (await page.locator("ul img").count()) > 0);
  await shot("chat-photo-sent");

  await page.getByRole("button", { name: /Tilbage|back/i }).first().click();
  await page.waitForTimeout(300);
  const row = page.locator("button").filter({ hasText: /Alex/i }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(400);
  await gal.setInputFiles({ name: "foto2.png", mimeType: "image/png", buffer: png });
  await page.waitForTimeout(500);
  console.log("CHAT_PHOTO_THREAD_DRAFT", (await page.locator("img").count()) > 0);
  await page.locator('button[aria-label="Send"]').click({ force: true });
  await page.waitForTimeout(700);
  console.log("CHAT_PHOTO_THREAD_SENT", (await page.locator("ul img").count()) > 1);
  await shot("chat-photo-thread");

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("zenko-plads-v31"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.waitForTimeout(800);
  await tapNav("Mig");
  await page.waitForTimeout(500);
  const weekLabel = await page.locator('[data-testid="me-week-label"]').innerText().catch(() => "");
  console.log("ME_WEEK_LABEL", weekLabel);
  console.log("ME_UGE_37", /37/.test(weekLabel));
  const me = await page.locator("body").innerText();
  const ugeIdx = me.toLowerCase().indexOf("uge");
  const todoIdx = me.toLowerCase().indexOf("to-do");
  console.log("ME_UGE_TOP", ugeIdx >= 0 && (todoIdx < 0 || ugeIdx < todoIdx));
  console.log("ME_FARVET", /Islev|Prøvesten|Puds/i.test(me));
  await shot("mig-uge-top");
  const bar = page.locator("button").filter({ hasText: /Puds|Islev|Prøvesten|Kloster/i }).first();
  if (await bar.count()) {
    await bar.click({ force: true });
    await page.waitForTimeout(400);
  }
  const detail = await page.locator("body").innerText();
  console.log("ME_BAR_OPEN", /Dagens plan|Sted|Arbejde|Puds|Islev|Prøvesten/i.test(detail));
  await shot("mig-bar-open");
} catch (e) {
  console.log("FAIL", e.message);
  await shot("mig-chat-fail");
} finally {
  await browser.close();
}
