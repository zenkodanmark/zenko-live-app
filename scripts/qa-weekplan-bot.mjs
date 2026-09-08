import { chromium } from "playwright";

const MSG = `Plan for næste uge Marius og Ole og Alex skal arbejde på sagen Islevvænge de skal pudse gavle og være færdig med dette mandag.

Tirsdag Marius skal ud til et lille sag der hedder Søren privat - opret en ny sag med det navn

Frederico og Osvaldo skal arbejde på et projekt der hedder Klostergården Hillerød - opret en ny sag der hedder dette

Ole og Alex skat til en sag der hedder Prøvestenen Frederiksværk- opret en sag der hedder dette.
De skal pudse kælder - tirsdag og onsdag

Lig at dette i planen`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function pin(digits) {
  for (const d of digits) {
    await page.getByRole("button", { name: d, exact: true }).click();
    await page.waitForTimeout(280);
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
  await shot("weekplan-login");

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
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/planen er lagt|oprettet/i).waitFor({ timeout: 20000 });
  await shot("bot-weekplan");
  const botBody = await page.locator("body").innerText();
  console.log("BOT_HAS_CONFIRM", /planen er lagt/i.test(botBody));
  console.log("BOT_HAS_JOBS", /Søren privat|Klostergården|Prøvestenen/.test(botBody));

  await page.getByRole("button", { name: "Planlægning", exact: true }).click();
  await page.getByText(/Uge|Planlægning/i).first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "→", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("plan-week37");
  const planBody = await page.locator("body").innerText();
  console.log("PLAN_HAS_ISLEV", /Islevvænge/.test(planBody));
  console.log("PLAN_HAS_SOREN", /Søren privat/.test(planBody));
  console.log("PLAN_HAS_KLOSTER", /Klostergården/.test(planBody));
  console.log("PLAN_HAS_PROVE", /Prøvestenen/.test(planBody));
  console.log("PLAN_HAS_PUDS_GAVLE", /Puds gavle/.test(planBody));
  console.log("PLAN_HAS_PUDS_KAELDER", /Puds kælder/.test(planBody));
  console.log("PLAN_WEEK", /Uge 37/.test(planBody) ? 37 : planBody.match(/Uge \d+/)?.[0]);

  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.waitForTimeout(500);
  await shot("sager-new");
  const sagBody = await page.locator("body").innerText();
  console.log("SAGER_SOREN", sagBody.includes("Søren privat"));
  console.log("SAGER_KLOSTER", sagBody.includes("Klostergården"));
  console.log("SAGER_PROVE", sagBody.includes("Prøvestenen"));
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("weekplan-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
