import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
page.setDefaultTimeout(25000);

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("sag-row-ud").waitFor({ timeout: 10000 });

  const order = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid^='sag-row-']")].map((el) => el.getAttribute("data-testid")),
  );
  console.log("ORDER", order);

  await page.getByTestId("sag-row-ud").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/workspace/screenshots/sager-ud-mid.png" });

  await page.getByTestId("sag-row-slip").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/workspace/screenshots/sager-as-er.png" });

  await page.getByTestId("kunde-aflevering").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/workspace/screenshots/sager-kunde.png" });

  const asBox = await page.getByTestId("sag-row-slip").boundingBox();
  const erBox = await page.getByTestId("sag-row-ent").boundingBox();
  const udBox = await page.getByTestId("sag-row-ud").boundingBox();
  console.log({ asBox, erBox, udBox });
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await page.screenshot({ path: "/workspace/screenshots/sager-ud2-fail.png" });
  process.exitCode = 1;
} finally {
  await browser.close();
}
