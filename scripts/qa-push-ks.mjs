import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function fresh() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

try {
  await fresh();
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator("nav").getByRole("button", { name: /KS/i }).click();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  console.log("KS_PICK_LABEL", /Vælg sag/i.test(body));
  console.log("KS_GPS_HINT", /GPS kan udfylde|ikke krav|baggrunden/i.test(body));
  const chips = page.getByTestId("ks-job-pick").locator("button");
  console.log("KS_JOB_CHIPS", await chips.count());
  const prove = chips.filter({ hasText: /Prøvesten/i }).first();
  if (await prove.count()) {
    await prove.click();
    await page.waitForTimeout(200);
    console.log("KS_JOB_OVERRIDE", (await prove.getAttribute("class"))?.includes("bg-navy") ?? false);
  } else {
    console.log("KS_JOB_OVERRIDE", false);
  }
  await shot("ks-pick-job");

  const photosBefore = await page.locator("ul.grid.grid-cols-2 > li").count();
  const t0 = Date.now();
  await page.getByRole("button", { name: /Demo-foto/i }).click();
  await page.waitForTimeout(400);
  const t1 = Date.now();
  console.log("KS_GPS_NOT_BLOCKING", t1 - t0 < 2500);
  await page.locator("ul.grid.grid-cols-2 > li").nth(photosBefore).waitFor({ timeout: 12000 }).catch(() => {});
  await page.getByText(/\d+\s*\/\s*\d+\s*i Drive/).first().waitFor({ timeout: 20000 }).catch(() => console.log("KS_NO_PROGRESS"));
  await page.getByText(/^Grok:/).first().waitFor({ timeout: 35000 }).catch(() => console.log("KS_NO_GROK"));
  await page.waitForTimeout(2000);
  await shot("ks-after-demo");
  const dump = await page.evaluate(() => {
    const raw = localStorage.getItem("zenko-plads-v31") || "";
    let notices = [];
    let ks = 0;
    try {
      const j = JSON.parse(raw);
      notices = j.state?.notices ?? [];
      ks = (j.state?.ksReports ?? []).filter((r) => r.employeeId === "emp-alex").length;
    } catch {
      /* */
    }
    return { n: notices.length, kinds: notices.map((x) => x.kind + ":" + x.title), ks, v: JSON.parse(raw || "{}").version };
  });
  console.log("DUMP", JSON.stringify(dump));

  await page.getByRole("button", { name: "Log ud" }).click();
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  const ole = await page.locator("body").innerText();
  const bell = page.getByTestId("notice-bell");
  console.log("OLE_BELL", (await bell.count()) > 0);
  await bell.click();
  await page.waitForTimeout(400);
  const sheet = await page.locator("body").innerText();
  console.log("OLE_KS_NOTICE", /Ny KS/i.test(sheet));
  await shot("ole-ks-notice");
} catch (e) {
  console.log("FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/push-ks-fail.png" });
} finally {
  await browser.close();
}
