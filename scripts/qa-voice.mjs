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

async function sendVoice(text) {
  const fab = page.getByTestId("voice-fab");
  if (!(await page.getByPlaceholder("Skriv til agenten…").count())) {
    await fab.click();
    await page.getByPlaceholder("Skriv til agenten…").waitFor({ timeout: 5000 });
  }
  await page.getByPlaceholder("Skriv til agenten…").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const think = page.getByText("Tænker…", { exact: true });
  await think.waitFor({ timeout: 8000 });
  await think.waitFor({ state: "hidden", timeout: 50000 });
  await page.waitForTimeout(800);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  for (const d of "7777") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await shot("voice-mester-tavle");
  const tabs = await page.locator("nav").innerText();
  console.log("NAV", tabs.replace(/\n/g, " | "));
  console.log("NAV_HAS_BOT", /Bot/.test(tabs));
  console.log("FAB", await page.getByTestId("voice-fab").count());
  await sendVoice("Hvilken sag? Hillerødsholm");
  await shot("voice-mester-reply");
  const sheet = await page.locator("body").innerText();
  console.log("MESTER_HAS_HILLEROD", /Hillerød/i.test(sheet));
  console.log("MESTER_TAIL", sheet.slice(-500).replace(/\n/g, " | "));

  await page.getByRole("button", { name: "Sager" }).click();
  await page.waitForTimeout(800);
  const sag = await page.locator("body").innerText();
  console.log("HAS_KS_ROW", /\bKS\b/.test(sag));
  console.log("HAS_TF_ROW", /\bTF\b/.test(sag));
  console.log("HAS_AS_ROW", /\bAS\b/.test(sag));
  console.log("HAS_ER_ROW", /\bER\b/.test(sag));
  await shot("voice-mester-sager");

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  for (const d of "1111") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /Jeg er mødt på job/ }).waitFor({ timeout: 12000 });
  await shot("voice-svend-alex");
  console.log("SVEND_FAB", await page.getByTestId("voice-fab").count());
  await sendVoice("Der er stål i væggen, hvad skal vi gøre?");
  await shot("voice-svend-reply");
  const sv = await page.locator("body").innerText();
  console.log("SVEND_TAIL", sv.slice(-700).replace(/\n/g, " | "));
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("voice-qa-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(-2000));
  process.exitCode = 1;
} finally {
  await browser.close();
}
