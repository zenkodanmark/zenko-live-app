import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Planlægning" }).click();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  console.log("HAS_STEP_PERSON", /1 · Person/.test(body));
  console.log("HAS_STEP_DAYS", /2 · Dage/.test(body));
  console.log("HAS_STEP_PLACE", /3 · Sted/.test(body));
  console.log("HAS_STEP_WORK", /4 · Udføres/.test(body));
  console.log("HAS_LAGER", /Lager/.test(body));
  console.log("HAS_KOERSEL", /Kørsel/.test(body));
  console.log("HAS_ANDET", /Andet/.test(body));
  console.log("HAS_ALEX", /Alex/.test(body));
  console.log("HAS_OLE", /Ole/.test(body));
  console.log("NO_DATE_INPUT", (await page.locator("input[type=date]").count()) === 0);
  console.log("NO_SELECT", (await page.locator("select").count()) === 0);
  console.log("NO_SMALL_CAL", !/Møder fra Google/.test(body));
  await page.screenshot({ path: "/workspace/screenshots/plan-mester.png" });

  await page.getByRole("button", { name: "Alex", exact: true }).first().click();
  await page.getByRole("button", { name: /man/i }).first().click();
  await page.getByRole("button", { name: "Lager" }).first().click();
  await page.getByPlaceholder("Hvad skal udføres").fill("Hent mørtel");
  await page.getByRole("button", { name: "Læg i ugeplan" }).click();
  await page.waitForTimeout(600);
  const after = await page.locator("body").innerText();
  console.log("SAVED", /Lagt i ugeplanen|Gemt i Drive/.test(after));
  console.log("ROW_MORTAR", /Hent mørtel/.test(after));
  await page.screenshot({ path: "/workspace/screenshots/plan-saved.png" });

  await page.getByRole("button", { name: /Log ud/i }).first().click();
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.getByRole("button", { name: "Mig", exact: true }).click();
  await page.waitForTimeout(400);
  const me = await page.locator("body").innerText();
  console.log("CREW_SEES_OWN", /Hent mørtel|Lager/.test(me));
  await page.screenshot({ path: "/workspace/screenshots/plan-crew-me.png" });
  console.log("QA_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/plan-fail.png" });
} finally {
  await browser.close();
}
