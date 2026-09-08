import { chromium } from "playwright";

const MSG = `Her er beskrivelse på Islevvænge på murer og tag beskrivelse, som vi udføre, arkivere dem ind på sagen så de ansatte kan søge og spørge ind til det`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function pin(digits) {
  for (const d of digits) {
    await page.getByRole("button", { name: d, exact: true }).click();
    await page.waitForTimeout(200);
  }
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await pin("7777");
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Bot", exact: true }).click();
  await page.getByText("Mester-bot", { exact: true }).waitFor({ timeout: 8000 });
  const ny = page.getByRole("button", { name: /Ny tråd/i });
  if (await ny.count()) await ny.click();
  await page.waitForTimeout(200);
  await page.evaluate((text) => {
    const ta = document.querySelector("textarea");
    if (!ta) throw new Error("no textarea");
    const proto = window.HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc.set.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, MSG);
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/Murer og tag ligger på Islevvænge/i).waitFor({ timeout: 12000 });
  await shot("islev-bot-archive");
  console.log("BOT_ARCHIVE_OK", true);

  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.getByRole("button", { name: /Islevvænge/ }).first().click();
  await page.waitForTimeout(400);
  await shot("islev-sager");
  const sag = await page.locator("body").innerText();
  console.log("SAG_CHIP_FUGER", /Fuger/.test(sag));
  console.log("SAG_CHIP_PUDS", /Puds Fortvej|Puds gavle/.test(sag));
  console.log("SAG_CHIP_SKORSTEN", /Skorsten/.test(sag));
  console.log("SAG_HAS_ZMUR", /Zmur|Murer/.test(sag));

  const fuger = page.getByRole("button", { name: /Fuger/ }).first();
  if (await fuger.count()) {
    await fuger.click();
    await page.waitForTimeout(2500);
    const after = await page.locator("body").innerText();
    const hit = /20 mm|KC 50\/50\/700|skrabefuge|udkrads/i.test(after);
    console.log("SAG_FUGER_ANSWER", hit);
    await shot("islev-sager-fuger");
  }

  await page.getByRole("button", { name: /Log ud/i }).first().click();
  await page.getByRole("button", { name: /Alex/ }).first().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await pin("1111");
  await page.getByRole("button", { name: "Sag", exact: true }).click();
  await page.waitForTimeout(300);
  const islevBtn = page.getByRole("button", { name: /Islevvænge/ }).first();
  if (await islevBtn.count()) await islevBtn.click();
  await page.waitForTimeout(400);
  await shot("islev-crew-alex");
  const crew = await page.locator("body").innerText();
  console.log("CREW_CHIP_FUGER", /Fuger 20 mm/.test(crew));
  console.log("CREW_CHIP_SKORSTEN", /Skorsten/.test(crew));
  console.log("CREW_NO_BINDERE", !/Bindere pr/.test(crew) || /Islevvænge/.test(crew));

  const crewFuger = page.getByRole("button", { name: /Fuger 20 mm/ }).first();
  if (await crewFuger.count()) {
    await crewFuger.click();
    try {
      await page.getByText(/20 mm|KC 50\/50\/700|skrabefuge/i).waitFor({ timeout: 22000 });
      console.log("CREW_FUGER_ANSWER", true);
    } catch {
      const t = await page.locator("body").innerText();
      console.log("CREW_FUGER_ANSWER", /20 mm|KC 50\/50\/700|udkrads/i.test(t));
      console.log("CREW_BODY_SNIP", t.slice(-400));
    }
    await shot("islev-crew-fuger");
  }
} catch (e) {
  console.log("FAIL", e instanceof Error ? e.message : e);
  await shot("islev-fail");
  process.exitCode = 1;
} finally {
  await browser.close();
}
