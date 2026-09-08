import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300));
});

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
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  const fab = await page.getByTestId("voice-fab").count();
  console.log("FAB", fab);
  const nav = await page.locator("nav").innerText();
  console.log("NAV_HAS_BOT", /Bot/.test(nav));
  console.log("NAV_HAS_CHAT", /Chat/.test(nav));

  await page.getByRole("button", { name: "Chat" }).click();
  await page.waitForTimeout(600);
  const body = await page.locator("body").innerText();
  console.log("HAS_ATTACH_CAM", /Kamera|Camera/i.test(body));
  console.log("HAS_ATTACH_GAL", /Galleri|Gallery|Billed/i.test(body));
  console.log("HAS_INPUT", (await page.locator("input[placeholder]").count()) > 0);
  console.log("NO_NEW_BOT_CARD", !/Working Field-bot|Sag-bot|Uddyb/.test(body));
  await shot("voice-chat-møde");

  const ph = page.getByPlaceholder(/husk|regntøj|Skriv eller vedhæft|Fx husk/i).first();
  await ph.waitFor({ timeout: 8000 });
  await ph.fill("Hvilken sag? Hillerødsholm");
  await page.getByRole("button", { name: "Send" }).last().click();
  const think = page.getByText("Tænker…");
  const thinkVisible = await think.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  console.log("THINK", thinkVisible);
  if (thinkVisible) await think.waitFor({ state: "hidden", timeout: 50000 }).catch(() => null);
  await page.waitForTimeout(1200);
  await shot("voice-chat-reply");
  const after = await page.locator("body").innerText();
  console.log("HAS_ZENKO", /Zenko/.test(after));
  console.log("HAS_HILLEROD", /Hillerød/i.test(after));
  console.log("TAIL", after.slice(-700).replace(/\n/g, " | "));
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("voice-chat-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(-2000));
  process.exitCode = 1;
} finally {
  await browser.close();
}
