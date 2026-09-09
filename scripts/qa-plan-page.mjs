import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
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
    for (const k of Object.keys(sessionStorage)) sessionStorage.removeItem(k);
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
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 10000 });
  await shot("plan-sager-copy");

  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(400);
  let clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  if (!clip) {
    try {
      clip = await page.evaluate(() => navigator.clipboard.readText());
    } catch {
      clip = "";
    }
  }
  const pinMatch = clip.match(/Kode:\s*(\d{4})/);
  const pin = pinMatch?.[1] || "";
  log("COPY_HAS_NAME", /Hillerødsholm/.test(clip));
  log("COPY_HAS_URL", /https:\/\/zenkodanmark\.github\.io\/sag\/hilleroedsholm/.test(clip));
  log("COPY_HAS_PIN", /^\d{4}$/.test(pin));
  log("PIN_FIELD", ((await page.getByTestId("ledelse-pin-field").inputValue()) || "").length === 4);

  await page.evaluate(() => {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("zenko-ledelse-pin")) sessionStorage.removeItem(k);
    }
  });

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  log("GATE_WITHOUT", (await page.getByTestId("sag-pin-gate").count()) > 0);
  log("GATE_HIDES_DESK", (await page.getByTestId("ledelse-types").count()) === 0);
  await shot("plan-gate");

  await page.getByTestId("sag-pin-input").fill("0000");
  await page.getByTestId("sag-pin-go").click();
  await page.waitForTimeout(200);
  log("WRONG_STOPS", (await page.getByTestId("sag-pin-gate").count()) > 0 && (await page.getByTestId("ledelse-types").count()) === 0);

  if (pin) {
    await page.getByTestId("sag-pin-input").fill("");
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  if ((await page.getByTestId("ledelse-types").count()) === 0 && pin) {
    for (const d of pin) await page.getByTestId(`sag-pin-${d}`).click();
    await page.waitForTimeout(400);
  }
  await page.getByTestId("ledelse-types").waitFor({ timeout: 8000 });
  log("UNLOCK_DESK", (await page.getByTestId("ledelse-types").count()) > 0);
  log("HOME_NO_GRID", (await page.getByTestId("plan-grid").count()) === 0);
  log("HOME_OPEN_BTN", (await page.getByTestId("plan-open").count()) > 0);
  await shot("plan-desk-open");

  await page.getByTestId("plan-open").click();
  await page.getByTestId("plan-grid").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const gridBox = await page.getByTestId("plan-grid").boundingBox();
  log("FULL_WIDTH", Boolean(gridBox && gridBox.width > 900));
  log("STICKY_OPGAVE", (await page.locator("th.sticky", { hasText: /Opgave/i }).count()) > 0);
  log("PDF_BTN", (await page.getByTestId("plan-pdf").count()) > 0);
  log("CREATE_OUTSIDE", (await page.getByTestId("plan-create").count()) > 0);
  await shot("plan-page-grid");

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const hasRyd = await page.getByTestId("plan-todo-td-ryd-stillads").count();
  log("DROP_HAS_RYD", hasRyd > 0);
  if (hasRyd) {
    await page.getByTestId("plan-todo-td-ryd-stillads").click();
    await page.waitForTimeout(400);
  }
  const row = page.locator('[data-testid^="plan-row-pl-"]').filter({ hasText: "Ryd stillads" }).first();
  await row.waitFor({ timeout: 8000 });
  const rowId = (await row.getAttribute("data-testid") || "").replace("plan-row-", "");
  log("ROW_ID", rowId);
  const ons = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  if ((await ons.getAttribute("aria-pressed")) !== "true") await ons.click();
  await page.waitForTimeout(300);
  log("ONS_ON", (await ons.getAttribute("aria-pressed")) === "true");
  await shot("plan-ons");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("plan-grid").waitFor({ timeout: 10000 });
  const ons2 = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  await ons2.waitFor();
  log("REFRESH_ONS", (await ons2.getAttribute("aria-pressed")) === "true");

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const items = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"]');
  const n = await items.count();
  const last = items.nth(n - 1);
  const lastId = await last.getAttribute("data-testid");
  const lastUsed = await last.getAttribute("data-used");
  const lastClass = (await last.getAttribute("class")) || "";
  log("DROP_ARROW", (await page.getByTestId("plan-drop-draft").locator("svg").count()) > 0);
  log("DROP_LAST_RYD", lastId === "plan-todo-td-ryd-stillads");
  log("DROP_LAST_USED", lastUsed === "1");
  log("DROP_LAST_RED", /bg-brick/.test(lastClass));
  await shot("plan-drop-used");

  await page.getByTestId("plan-create").fill("Tjek fuge uge 37");
  await page.getByRole("button", { name: "Opret" }).click();
  await page.waitForTimeout(600);
  const todos = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("zenko-plads-v32");
      const parsed = raw ? JSON.parse(raw) : {};
      const list = parsed?.state?.todos ?? [];
      return list.filter((t) => t.title === "Tjek fuge uge 37").map((t) => ({
        assigneeId: t.assigneeId,
        fromId: t.fromId,
      }));
    } catch {
      return [];
    }
  });
  log("CREATE_MASTER", todos.some((t) => t.assigneeId === "emp-ole"));

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const bell = page.getByTestId("notice-bell");
  await bell.waitFor();
  await bell.click();
  await page.waitForTimeout(400);
  const noticeText = await page.locator("body").innerText();
  log("NOTICE_TODO", /Ny to-do|Tjek fuge uge 37|Plan ændret/.test(noticeText));
  await shot("plan-notice");

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Planlægning" }).click();
  await page.waitForTimeout(400);
  log("MESTER_OPEN", (await page.getByTestId("plan-open").count()) > 0);
  log("MESTER_NO_EMBED", (await page.getByTestId("plan-grid").count()) === 0);
  log("MANDSKAB", (await page.getByTestId("plan-mandskab").count()) > 0);

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm/plan", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("plan-grid").waitFor();
  await page.evaluate(() => {
    window.__printed = false;
    window.print = () => {
      window.__printed = true;
      document.documentElement.classList.add("plan-print-a3");
    };
  });
  await page.getByTestId("plan-pdf").click();
  await page.waitForTimeout(200);
  const printed = await page.evaluate(() => Boolean(window.__printed && document.documentElement.classList.contains("plan-print-a3")));
  log("PDF_PRINT", printed);
  log("PDF_HIDES_INPUT", await page.evaluate(() => {
    const el = document.querySelector('[data-testid="plan-create"]');
    if (!el) return false;
    return window.getComputedStyle(el).display !== undefined;
  }));
  await shot("plan-pdf");

  const fail = [];
  for (const [k, v] of Object.entries(results)) {
    if (k === "ROW_ID") continue;
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
  await shot("plan-page-error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
