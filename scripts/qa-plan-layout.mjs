import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
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
    for (const k of Object.keys(sessionStorage)) sessionStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("login-emp-ole").click();
  await page.getByTestId("pin-pad").waitFor();
  for (const d of "7777") await page.getByTestId(`pin-${d}`).click();
  await page.getByRole("button", { name: "Planlægning" }).waitFor({ timeout: 15000 });
}

async function unlockPlan(pin) {
  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm/plan", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
    if ((await page.getByTestId("plan-grid").count()) === 0) {
      for (const d of pin) await page.getByTestId(`sag-pin-${d}`).click();
      await page.waitForTimeout(400);
    }
  }
  await page.getByTestId("plan-grid").waitFor({ timeout: 12000 });
}

try {
  await loginOle();

  await page.getByTestId("todo-open-board").click();
  await page.locator('[data-testid^="todo-ledelse-hak-"]').first().waitFor({ timeout: 10000 });
  await shot("plan-todo-board");
  const hakBtns = page.locator('[data-testid^="todo-ledelse-hak-"]');
  const hakN = await hakBtns.count();
  for (let i = 0; i < hakN; i++) {
    const btn = hakBtns.nth(i);
    if ((await btn.getAttribute("data-ledelse")) === "on") await btn.click();
  }
  const firstLine = page.locator('[data-testid^="todo-line-"]').first();
  log("LIST_UNHAKKED", (await firstLine.getAttribute("data-ledelse")) === "off");
  const ryd = page.getByTestId("todo-ledelse-hak-td-ryd-stillads");
  if (await ryd.count()) {
    if ((await ryd.getAttribute("data-ledelse")) !== "on") await ryd.click();
  } else if (hakN) {
    await hakBtns.first().click();
  }
  if (hakN > 1) {
    for (let i = 0; i < hakN; i++) {
      const btn = hakBtns.nth(i);
      const id = await btn.getAttribute("data-testid");
      if (id === "todo-ledelse-hak-td-ryd-stillads") continue;
      if ((await btn.getAttribute("data-ledelse")) !== "on") await btn.click();
      break;
    }
  }
  const onCount = await page.locator('[data-testid^="todo-ledelse-hak-"][data-ledelse="on"]').count();
  log("HAK_TWO", onCount >= 1);
  await shot("plan-todo-hak");

  await page.getByTestId("close-x").click();
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 10000 });
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(400);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  const pin = (clip.match(/Kode:\s*(\d{4})/) || [])[1] || (await page.getByTestId("ledelse-pin-field").inputValue());
  log("PIN", /^\d{4}$/.test(pin));

  await unlockPlan(pin);
  log("NO_HAK_STACK", (await page.getByTestId("plan-hak-list").count()) === 0);
  log("SLIM_CREATE", (await page.getByTestId("plan-create").count()) > 0);
  log("DROP_ARROW", (await page.getByTestId("plan-drop-draft").locator("svg").count()) > 0);

  await page.getByTestId("plan-create").fill("Tjek fuge uge 37");
  await page.getByRole("button", { name: "Opret" }).click();
  await page.waitForTimeout(500);

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const dropIds = await page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid") || ""),
  );
  log("DROP_HAS_HAKKED", dropIds.some((id) => /ryd-stillads|td-/.test(id)) && dropIds.length >= 1);
  log("DROP_HAS_CREATE", (await page.getByTestId("plan-dropdown").innerText()).includes("Tjek fuge uge 37"));
  await shot("plan-drop-hakked");

  const unused = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"][data-used="0"]');
  const unusedN = await unused.count();
  if (unusedN) await unused.first().click();
  await page.waitForTimeout(300);
  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const unused2 = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"][data-used="0"]');
  if (await unused2.count()) await unused2.first().click();
  else await page.getByTestId("plan-drop-draft").click();
  await page.waitForTimeout(400);

  const rows = page.locator('[data-testid^="plan-row-pl-"]');
  const rowCount = await rows.count();
  log("TWO_ROWS", rowCount >= 2);
  const row2 = rows.nth(Math.max(0, rowCount - 1));
  const row2id = ((await row2.getAttribute("data-testid")) || "").replace("plan-row-", "");
  log("ROW2", Boolean(row2id));
  const ons = page.getByTestId(`plan-cell-${row2id}-2026-09-09`);
  const tor = page.getByTestId(`plan-cell-${row2id}-2026-09-10`);
  if ((await ons.getAttribute("aria-pressed")) !== "true") await ons.click();
  if ((await tor.getAttribute("aria-pressed")) !== "true") await tor.click();
  await page.waitForTimeout(300);
  log("ROW2_ONS", (await ons.getAttribute("aria-pressed")) === "true");
  log("ROW2_TOR", (await tor.getAttribute("aria-pressed")) === "true");
  await shot("plan-two-rows");

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const items = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"]');
  const n = await items.count();
  const last = items.nth(n - 1);
  const lastClass = (await last.getAttribute("class")) || "";
  log("DROP_USED_RED", /bg-brick/.test(lastClass) && (await last.getAttribute("data-used")) === "1");
  await page.getByTestId("plan-drop-draft").click();

  const zebra = await rows.nth(1).getAttribute("data-zebra");
  log("ZEBRA", zebra === "1");
  const titleBox = await page.getByTestId(`plan-row-title-${row2id}`).boundingBox();
  const titleOverflow = await page.getByTestId(`plan-row-title-${row2id}`).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  log("NAME_FULL", Boolean(titleBox && titleBox.width > 80 && titleOverflow));

  const gridBox = await page.getByTestId("plan-grid").boundingBox();
  const vp = page.viewportSize();
  log("FULL_HEIGHT", Boolean(gridBox && vp && gridBox.y + gridBox.height >= vp.height - 12));
  log("NO_SAND_GAP", await page.evaluate(() => {
    const main = document.querySelector('[data-testid="plan-page"]');
    if (!main) return false;
    return window.getComputedStyle(main).backgroundColor !== "rgb(235, 228, 218)";
  }));

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("plan-grid").waitFor({ timeout: 12000 });
  const ons2 = page.getByTestId(`plan-cell-${row2id}-2026-09-09`);
  const tor2 = page.getByTestId(`plan-cell-${row2id}-2026-09-10`);
  await ons2.waitFor();
  log("REFRESH_ONS", (await ons2.getAttribute("aria-pressed")) === "true");
  log("REFRESH_TOR", (await tor2.getAttribute("aria-pressed")) === "true");
  log("REFRESH_TWO", (await page.locator('[data-testid^="plan-row-pl-"]').count()) >= 2);
  await shot("plan-refresh");

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("ledelse-types").waitFor({ timeout: 8000 });
  log("KS_URORT", (await page.getByTestId("ledelse-btn-ks").count()) > 0);
  log("HOME_NO_GRID", (await page.getByTestId("plan-grid").count()) === 0);
  log("HOME_OPEN", (await page.getByTestId("plan-open").count()) > 0);

  const fail = [];
  for (const [k, v] of Object.entries(results)) {
    if (k === "PIN") continue;
    if (v !== true) fail.push(`${k}=${v}`);
  }
  if (fail.length) {
    console.error("FAIL_CHECKS", fail);
    process.exitCode = 1;
  } else {
    console.log("OK");
  }
} catch (err) {
  console.error("QA_ERROR", err);
  await shot("plan-layout-error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
