import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("login-emp-ole").click();
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("sag-row-todo").waitFor({ timeout: 10000 });

  const hill = page.getByRole("button", { name: /Hillerødsholm/i }).first();
  if (await hill.count()) await hill.click();
  await page.waitForTimeout(400);

  console.log("SAG_PLUS_TODO", await page.getByTestId("sag-plus-todo").count());
  console.log("SAG_PLUS_KS", await page.getByTestId("sag-plus-ks").count());

  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  console.log("LIST_PLUS_TODO", await page.getByTestId("list-plus-todo").count());

  if (await page.getByTestId("todo-pdf").count()) {
    await page.getByTestId("close-x").last().click({ force: true });
    await page.waitForTimeout(300);
  }

  let row = page.locator('[data-testid="sag-list-sheet"] li', { hasText: /trappe/i }).first();
  if (!(await row.count())) {
    row = page.locator('[data-testid="sag-list-sheet"] li').first();
  }
  await row.waitFor({ timeout: 8000 });
  console.log("PENCIL_ON_LINE", await row.getByRole("button", { name: /Rediger/i }).count());
  await row.getByRole("button", { name: /Rediger/i }).click();
  await page.getByTestId("todo-edit-sheet").waitFor({ timeout: 8000 });
  await shot("todo-edit-open");

  const bodyBox = page.getByTestId("todo-edit-body");
  await bodyBox.fill("Ny tekst: trappe afrettes og fuges om.");
  await page.getByTestId("todo-edit-save").click();
  await page.waitForTimeout(800);
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  const listAfter = await page.locator('[data-testid="sag-list-sheet"]').innerText();
  console.log("LIST_NEW_TEXT", /trappe afrettes/.test(listAfter));
  await shot("todo-edit-saved");

  row = page.locator('[data-testid="sag-list-sheet"] li', { hasText: /trappe/i }).first();
  if (!(await row.count())) row = page.locator('[data-testid="sag-list-sheet"] li').first();
  await row.getByRole("button", { name: /Rediger/i }).click();
  await page.getByTestId("todo-edit-sheet").waitFor({ timeout: 8000 });
  await page.evaluate(() => {
    window.__printed = false;
    window.print = () => {
      window.__printed = true;
    };
  });
  await page.getByTestId("todo-pdf").click();
  const printed = await page.evaluate(() => window.__printed);
  const docText = await page.getByTestId("todo-doc").innerText();
  console.log("PDF_CALLED", printed);
  console.log("PDF_HAS_TITLE", /trappe/i.test(docText));
  console.log("PDF_HAS_BODY", /trappe afrettes/.test(docText));
  console.log("PDF_HAS_STATUS", /Åben|Udført/.test(docText));
  console.log("PDF_HAS_JOB", /Hillerødsholm/.test(docText));
  await shot("todo-edit-pdf");

  await page.getByTestId("todo-edit-status-done").click();
  await page.getByTestId("todo-edit-save").click();
  await page.waitForTimeout(800);
  const openList = await page.locator('[data-testid="sag-list-sheet"]').innerText();
  console.log("GONE_FROM_OPEN", !/trappe/i.test(openList));
  await page.getByRole("button", { name: /Udførte to-do/i }).click();
  await page.waitForTimeout(500);
  const doneList = await page.locator("body").innerText();
  console.log("IN_DONE", /trappe/i.test(doneList) && /Ny tekst|trappe afrettes/.test(doneList));
  await shot("todo-edit-done");

  const doneRow = page.locator("button", { hasText: /trappe/i }).first();
  if (await doneRow.count()) {
    await doneRow.click();
    await page.waitForTimeout(400);
    if (await page.getByRole("button", { name: /Rediger/i }).count()) {
      await page.getByRole("button", { name: /Rediger/i }).last().click();
    } else if (await page.locator('[data-testid^="todo-edit-"]').count()) {
      await page.locator('[data-testid^="todo-edit-"]').last().click();
    }
  }
  if (await page.getByTestId("todo-edit-sheet").count()) {
    await page.getByTestId("todo-edit-status-open").click();
    await page.getByTestId("todo-edit-save").click();
    await page.waitForTimeout(400);
    console.log("REOPENED_AFTER_TEST", true);
  }

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("sag-row-ks").waitFor({ timeout: 8000 });
  console.log("KS_ROW", await page.getByTestId("sag-row-ks").count());
  console.log("MA_ROW", await page.getByTestId("sag-row-material").count());
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("todo-edit-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
