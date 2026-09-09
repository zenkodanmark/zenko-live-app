import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

function log(label, value) {
  console.log(label, value);
}

try {
  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("ledelse-home");
  const home = await page.locator("body").innerText();
  log("HOME_DESK", await page.getByTestId("ledelse-desk").count());
  log("HOME_BTN_TF", await page.getByTestId("ledelse-btn-tf").count());
  log("HOME_BTN_AS", await page.getByTestId("ledelse-btn-as").count());
  log("HOME_BTN_ER", await page.getByTestId("ledelse-btn-er").count());
  log("HOME_BTN_KS", await page.getByTestId("ledelse-btn-ks").count());
  log("HOME_BTN_TB", await page.getByTestId("ledelse-btn-tb").count());
  log("HOME_BTN_TODO", await page.getByTestId("ledelse-btn-todo").count());
  log("HOME_NO_BRICK", (await page.locator("img[src*='mursten']").count()) === 0);
  log("HOME_TODO_EXPANDED", await page.getByTestId("ledelse-todo").count());
  log("HOME_PLAN", await page.getByTestId("ledelse-plan").count());
  log("HOME_HAS_KS", /\bKS\b/.test(home));
  log("HOME_HAS_TB", /\bTB\b/.test(home));

  await page.getByTestId("ledelse-btn-ks").click();
  await page.waitForTimeout(600);
  await shot("ledelse-ks-list");
  log("KS_LIST", await page.locator("h1").filter({ hasText: "KS" }).count());
  log("KS_LIST_ROWS", await page.locator('[data-testid^="ledelse-row-"]').count());

  const ksRow = page.locator('[data-testid^="ledelse-row-"]').first();
  if (await ksRow.count()) {
    await ksRow.click();
    await page.waitForTimeout(500);
    await shot("ledelse-ks-slip");
    log("KS_SLIP", await page.getByTestId("ledelse-slip").count());
    log("KS_COMMENT", await page.getByTestId("ledelse-comment").count());
    log("KS_NO_GEM", !(await page.getByRole("button", { name: /^Gem$/ }).count()));
  }

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.getByTestId("ledelse-btn-tb").click();
  await page.waitForTimeout(500);
  await shot("ledelse-tb-list");
  log("TB_LIST", await page.locator("h1").filter({ hasText: "TB" }).count());

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.getByTestId("ledelse-btn-todo").click();
  await page.waitForTimeout(500);
  await shot("ledelse-todo-list");
  log("TODO_LIST", await page.getByTestId("ledelse-todo").count());
  const newTodo = page.getByTestId("ledelse-todo-new");
  await newTodo.fill("Tjek udsparing under dør inden hug.");
  await page.getByRole("button", { name: "Tilføj to-do" }).click();
  await page.waitForTimeout(400);
  const todoText = await page.getByTestId("ledelse-todo").innerText();
  log("TODO_ADDED", /udsparing under dør/i.test(todoText));

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  log("PLAN_ON_HOME", await page.getByTestId("ledelse-plan").count());
  log("TODO_NOT_ON_HOME", (await page.getByTestId("ledelse-todo").count()) === 0);

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("ledelse-look-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2000));
  process.exitCode = 1;
} finally {
  await browser.close();
}
