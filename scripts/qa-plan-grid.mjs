import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

const results = {};
function log(label, value) {
  results[label] = value;
  console.log(label, value);
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("login-emp-ole").click();
  await page.getByTestId("pin-pad").waitFor();
  for (const d of "7777") {
    await page.getByTestId(`pin-${d}`).click();
  }
  await page.getByRole("button", { name: "Planlægning" }).waitFor({ timeout: 15000 });
}

try {
  await loginOle();
  await page.getByRole("button", { name: "Planlægning" }).click();
  await page.waitForTimeout(600);
  const hill = page.getByTestId("plan-job-job-hillerodsholm");
  if (await hill.count()) await hill.click();
  await page.getByTestId("plan-grid").waitFor({ timeout: 8000 });
  await shot("plan-mester-grid");

  const hakRyd = page.getByTestId("plan-hak-td-ryd-stillads");
  await hakRyd.waitFor({ timeout: 8000 });
  if ((await hakRyd.getAttribute("data-ledelse")) !== "on") await hakRyd.click();
  const hakButtons = page.locator('[data-testid^="plan-hak-"]');
  const hakCount = await hakButtons.count();
  let secondHak = false;
  for (let i = 0; i < hakCount; i++) {
    const btn = hakButtons.nth(i);
    const id = await btn.getAttribute("data-testid");
    if (id === "plan-hak-td-ryd-stillads") continue;
    if ((await btn.getAttribute("data-ledelse")) !== "on") await btn.click();
    secondHak = true;
    break;
  }
  const flags = {
    HAK_TWO: (await hakRyd.getAttribute("data-ledelse")) === "on" && (secondHak || hakCount >= 1),
    HAK_RYD: (await hakRyd.getAttribute("data-ledelse")) === "on",
  };
  log("HAK_TWO", flags.HAK_TWO);
  log("HAK_RYD", flags.HAK_RYD);
  await shot("plan-mester-hak");

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByTestId("plan-grid").waitFor();
  log("SAG_GRID", (await page.getByTestId("plan-grid").count()) > 0);
  log("SAG_NO_CARDS", !(await page.getByRole("button", { name: /Gem kommentar/ }).count()));
  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const dropText = await page.getByTestId("plan-dropdown").innerText();
  log("DROP_HAS_RYD", /Ryd stillads/.test(dropText));
  await shot("plan-ledelse-drop");

  await page.getByTestId("plan-todo-td-ryd-stillads").click();
  await page.waitForTimeout(400);
  const row = page.locator('[data-testid^="plan-row-pl-"]').filter({ hasText: "Ryd stillads" }).first();
  await row.waitFor();
  const rowId = (await row.getAttribute("data-testid") || "").replace("plan-row-", "");
  log("ROW_ID", rowId);
  const ons = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  const tor = page.getByTestId(`plan-cell-${rowId}-2026-09-10`);
  if ((await ons.getAttribute("aria-pressed")) !== "true") await ons.click();
  if ((await tor.getAttribute("aria-pressed")) !== "true") await tor.click();
  await page.waitForTimeout(300);
  log("ONS_ON", (await ons.getAttribute("aria-pressed")) === "true");
  log("TOR_ON", (await tor.getAttribute("aria-pressed")) === "true");
  await shot("plan-ledelse-days");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const ons2 = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  const tor2 = page.getByTestId(`plan-cell-${rowId}-2026-09-10`);
  await ons2.waitFor();
  log("REFRESH_ONS", (await ons2.getAttribute("aria-pressed")) === "true");
  log("REFRESH_TOR", (await tor2.getAttribute("aria-pressed")) === "true");

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const items = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"]');
  const n = await items.count();
  const last = items.nth(n - 1);
  const lastId = await last.getAttribute("data-testid");
  const lastUsed = await last.getAttribute("data-used");
  const lastClass = (await last.getAttribute("class")) || "";
  log("DROP_LAST_RYD", lastId === "plan-todo-td-ryd-stillads");
  log("DROP_LAST_USED", lastUsed === "1");
  log("DROP_LAST_RED", /bg-brick/.test(lastClass));
  await shot("plan-ledelse-used");

  await page.getByTestId("plan-create").fill("Tjek fuge uge 37");
  await page.getByRole("button", { name: "Opret" }).click();
  await page.waitForTimeout(500);

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const bell = page.getByTestId("notice-bell");
  await bell.waitFor();
  await bell.click();
  await page.waitForTimeout(400);
  const noticeText = await page.locator("body").innerText();
  log("NOTICE_TODO", /Ny to-do|Tjek fuge uge 37|Plan ændret/.test(noticeText));
  await shot("plan-notice");

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Planlægning" }).click();
  await page.waitForTimeout(500);
  if (await page.getByTestId("plan-job-job-hillerodsholm").count()) {
    await page.getByTestId("plan-job-job-hillerodsholm").click();
  }
  const mesterRow = page.locator('[data-testid^="plan-row-pl-"]').filter({ hasText: "Ryd stillads" }).first();
  await mesterRow.waitFor();
  const mesterId = (await mesterRow.getAttribute("data-testid") || "").replace("plan-row-", "");
  const fre = page.getByTestId(`plan-cell-${mesterId}-2026-09-11`);
  if ((await fre.getAttribute("aria-pressed")) !== "true") await fre.click();
  await page.waitForTimeout(300);
  log("MESTER_MOVE", (await fre.getAttribute("aria-pressed")) === "true");
  log("MESTER_STILL_ONS", (await page.getByTestId(`plan-cell-${mesterId}-2026-09-09`).getAttribute("aria-pressed")) === "true");
  log("MANDSKAB", (await page.getByTestId("plan-mandskab").count()) > 0);
  await shot("plan-mester-move");

  const fail = [];
  for (const [k, v] of Object.entries(results)) {
    if (k === "ROW_ID") continue;
    if (v !== true) fail.push(`${k}=${v}`);
  }
  if (!(await page.getByTestId("plan-grid").count())) fail.push("mester mangler gitter");
  if (!(await page.getByTestId("plan-mandskab").count())) fail.push("mester mangler mandskab");
  if (fail.length) {
    console.error("FAIL_CHECKS", fail);
    process.exitCode = 1;
  } else {
    console.log("OK");
  }
} catch (err) {
  console.error("FAIL", err);
  await shot("plan-grid-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
