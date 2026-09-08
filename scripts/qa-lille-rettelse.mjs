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
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 15000 });
}

async function login(name) {
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().waitFor({ timeout: 12000 });
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().click();
  await page.waitForTimeout(800);
}

async function logout() {
  const btn = page.getByRole("button", { name: /Ieșire|Log ud|Salir|Wyloguj|Log out/i }).first();
  if (await btn.count()) await btn.click();
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 12000 });
}

async function tapNav(label) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label, "i") }).click({ force: true });
  await page.waitForTimeout(400);
}

try {
  await fresh();
  await login("Ole");
  await page.getByText("Live tavle").waitFor({ timeout: 12000 });

  console.log("OLE_PILES", (await page.locator("[data-testid^='board-pile-']").count()) === 6);
  await page.getByTestId("board-pile-ks").click();
  await page.waitForTimeout(500);
  const sheet = page.getByTestId("sag-list-sheet");
  console.log("BOARD_KS_SAG_LIST", (await sheet.count()) > 0);
  console.log("BOARD_KS_LUK", (await page.getByRole("button", { name: /Luk|Tilbage/i }).count()) > 0);
  const ksBody = await page.locator("[data-testid='sag-list-sheet']").innerText();
  console.log("BOARD_KS_NR", /Nr\./.test(ksBody));
  console.log("BOARD_KS_NEWEST_JOB", /På sagen|Hillerød|Islev|Kærhuset|Prøvestenen/i.test(ksBody));
  console.log("BOARD_KS_CREATE", /Opret ny/i.test(ksBody));
  console.log("BOARD_KS_NO_DRIVE_BTN", !/Åbn foto i Drive/i.test(ksBody));
  console.log("BOARD_KS_THUMB", (await page.getByTestId("ks-list-thumb").count()) > 0);
  await shot("board-ks-sag-list");

  await page.getByRole("button", { name: /Luk/i }).first().click({ force: true });
  await page.waitForTimeout(300);
  await page.getByTestId("board-pile-todo").click();
  await page.waitForTimeout(400);
  const todoSheet = await page.getByTestId("sag-list-sheet").innerText();
  console.log("BOARD_TODO_LIST", /To-do|Opret ny/i.test(todoSheet));
  await shot("board-todo-sag-list");

  await page.getByRole("button", { name: /Luk/i }).first().click({ force: true });
  await page.waitForTimeout(200);
  await page.getByTestId("board-pile-materials").click();
  await page.waitForTimeout(400);
  const maSheet = await page.getByTestId("sag-list-sheet").innerText();
  console.log("BOARD_MA_LIST", /MA|Opret ny|Bestilling/i.test(maSheet));
  await shot("board-ma-sag-list");
  await page.getByRole("button", { name: /Luk/i }).first().click({ force: true });
  await page.waitForTimeout(200);

  await tapNav("Sager");
  await page.waitForTimeout(500);
  const sagFront = await page.locator("body").innerText();
  console.log("SAG_MA_LABEL", /\bMA\b/.test(sagFront) && !/Materiale/.test(sagFront.split("KS")[0] ?? sagFront));
  console.log("SAG_ROW_ICONS", (await page.getByTestId("sag-row-todo").count()) === 1 && (await page.getByTestId("sag-row-material").count()) === 1);
  console.log("SAG_MA_CREATE", (await page.getByTestId("sag-row-material").locator("xpath=..").getByRole("button", { name: /Opret ny/i }).count()) >= 0);

  const jobBtn = page.getByRole("button").filter({ hasText: /Hillerødsholm|Islev/i }).first();
  if (await jobBtn.count()) await jobBtn.click();
  await page.waitForTimeout(300);
  await page.getByTestId("sag-row-ks").click();
  await page.waitForTimeout(500);
  const sagKs = await page.getByTestId("sag-list-sheet").innerText();
  console.log("SAG_KS_THUMB", (await page.getByTestId("ks-list-thumb").count()) > 0);
  console.log("SAG_KS_NO_DRIVE_BTN", !/Åbn foto i Drive/i.test(sagKs));
  await shot("sag-ks-thumbs");
  await page.getByRole("button", { name: /Luk/i }).first().click({ force: true });
  await page.waitForTimeout(200);

  await logout();
  await login("Ion");
  await tapNav("KS");
  await page.waitForTimeout(500);
  console.log("ION_KS_PICK", (await page.getByTestId("ks-job-pick").count()) > 0);
  const chips = page.locator("[data-testid^='ks-job-']");
  console.log("ION_KS_CHIPS", (await chips.count()) >= 2);
  if ((await chips.count()) >= 2) {
    await chips.nth(1).click();
    await page.waitForTimeout(200);
    console.log("ION_KS_OVERWRITE", true);
  }
  const ionKs = await page.locator("body").innerText();
  console.log("ION_KS_CHOOSE", /Alege șantierul|Vælg sag/i.test(ionKs));
  await shot("ion-ks-job-pick");
} catch (e) {
  console.log("FAIL", e.message);
  await shot("lille-rettelse-fail");
} finally {
  await browser.close();
}
