import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/workspace/screenshots", { recursive: true });

const stamp = Date.now().toString(36);
const title = `TB-test ${stamp}`;
const BASE = "http://127.0.0.1:8080/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 240)));

async function pinLogin(empId, pin) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const link = page.getByTestId(`login-${empId}`);
  if (await link.count()) await link.click();
  else await page.getByText(/Ole|Marius|Alex/).first().click();
  await page.getByTestId("pin-pad").waitFor({ timeout: 12000 });
  for (const d of pin) await page.getByTestId(`pin-${d}`).click();
  await page.waitForTimeout(400);
  const submit = page.getByTestId("pin-submit");
  if (await submit.isEnabled().catch(() => false)) await submit.click();
}

async function logoutNow() {
  const closer = page.locator('[data-testid="logout-open"]');
  if (await closer.count()) {
    await closer.first().click({ force: true });
    const yes = page.getByTestId("logout-yes");
    if (await yes.count()) await yes.click();
    await page.waitForTimeout(800);
  }
}

try {
  await pinLogin("emp-ole", "7777");
  await page.getByTestId("board-pile-extra").waitFor({ timeout: 15000 });
  const boardTb = await page.getByTestId("board-pile-offer").count();
  const boardAs = await page.getByTestId("board-pile-extra").count();
  const boardTbLabel = (await page.getByTestId("board-pile-offer").innerText().catch(() => "")).slice(0, 40);

  await page.locator("nav").getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("sag-row-slip").waitFor({ timeout: 12000 });
  const hill = page.getByRole("button", { name: /Hillerødsholm/ });
  if (await hill.count()) await hill.first().click();
  await page.getByTestId("sag-row-offer").waitFor({ timeout: 8000 });
  const tbRow = await page.getByTestId("sag-row-offer").count();
  const asRow = await page.getByTestId("sag-row-slip").count();
  const tbLabel = await page.getByTestId("sag-row-offer").innerText();
  console.log("MASTER_ROWS", JSON.stringify({ boardTb, boardAs, boardTbLabel, tbRow, asRow, tbLabel: tbLabel.slice(0, 80) }));

  await page.getByTestId("sag-plus-offer").click();
  await page.getByPlaceholder("Titel").waitFor({ timeout: 8000 });
  const composeHead = await page.locator(".font-display").first().innerText().catch(() => "");
  await page.getByPlaceholder("Titel").fill(title);
  await page.getByPlaceholder("Tekst").fill("Tilbud på stillads.");
  await page.getByTestId("todo-save").click();
  await page.locator("[data-testid^='tb-row-']").first().waitFor({ timeout: 8000 });
  const listText = await page.locator("body").innerText();
  const hasNumber = /TB-2026-\d+/.test(listText);
  const hasTitle = listText.includes(title);
  console.log("CREATED", JSON.stringify({ composeHead, hasNumber, hasTitle, slice: listText.match(/TB-2026-[\s\S]{0,80}/)?.[0] }));

  const firstTb = page.locator("[data-testid^='tb-row-']").first();
  let pdfHead = "";
  if (await firstTb.count()) {
    await firstTb.click();
    await page.getByTestId("tb-doc-heading").waitFor({ timeout: 8000 });
    pdfHead = await page.getByTestId("tb-doc-heading").innerText().catch(() => "");
    console.log("PDF", pdfHead);
  }

  await page.screenshot({ path: "/workspace/screenshots/tb-master.png" });

  await logoutNow();
  await pinLogin("emp-marius", "4444");
  await page.locator("nav button").nth(1).waitFor({ timeout: 12000 });
  await page.locator("nav button").nth(1).click();
  await page.waitForTimeout(800);
  const empTb = await page.getByTestId("sag-row-offer").count();
  const empAs = await page.getByTestId("sag-row-slip").count();
  const empBoardTb = await page.getByTestId("board-pile-offer").count();
  const empBody = await page.locator("body").innerText();
  console.log("EMPLOYEE", JSON.stringify({ empTb, empAs, empBoardTb, hasTbWord: /\bTB\b/.test(empBody) }));
  await page.screenshot({ path: "/workspace/screenshots/tb-svend.png" });

  console.log("REPORT", JSON.stringify({
    masterHasTb: tbRow > 0,
    boardHasTb: boardTb > 0,
    asUntouched: asRow > 0 && boardAs > 0,
    created: hasNumber && hasTitle,
    pdfTilbud: /Tilbud/i.test(pdfHead),
    employeeNoTb: empTb === 0 && empAs === 0 && empBoardTb === 0,
  }));
} catch (err) {
  console.error("FAIL", err);
  await page.screenshot({ path: "/workspace/screenshots/tb-fail.png" });
  console.log("BODY", (await page.locator("body").innerText().catch(() => "")).slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
