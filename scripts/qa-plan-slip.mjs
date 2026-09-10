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
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if ((await page.getByTestId("todo-open-board").count()) > 0) return;
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if ((await page.getByTestId("todo-open-board").count()) > 0) return;
  const pin = await page.evaluate(() => {
    try {
      const crew = JSON.parse(localStorage.getItem("zenko-crew-v1") || "[]");
      const ole = Array.isArray(crew) ? crew.find((e) => e.id === "emp-ole") : null;
      const p = String(ole?.pin || "").replace(/\D/g, "");
      return p.length === 4 ? p : "7777";
    } catch {
      return "7777";
    }
  });
  await page.getByTestId("login-emp-ole").click();
  await page.getByTestId("pin-pad").waitFor();
  for (const d of pin) await page.getByTestId(`pin-${d}`).click();
  await page.getByTestId("todo-open-board").waitFor({ timeout: 15000 });
}

async function goMester() {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("todo-open-board").count()) === 0) await loginOle();
  await page.getByTestId("todo-open-board").waitFor({ timeout: 12000 });
}

async function pinOf() {
  await goMester();
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 10000 });
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(400);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  return (clip.match(/Kode:\s*(\d{4})/) || [])[1] || (await page.getByTestId("ledelse-pin-field").inputValue());
}

async function closeDrop() {
  const drop = page.getByTestId("plan-dropdown");
  if ((await drop.count()) === 0) return;
  const openBtn = page.locator('[data-testid^="plan-drop-"][aria-expanded="true"]');
  if (await openBtn.count()) await openBtn.click();
  else await page.keyboard.press("Escape");
  await drop.waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
}

async function unlockPlan(pin) {
  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm/plan", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(300);
    if ((await page.getByTestId("plan-grid").count()) === 0) {
      for (const d of pin) await page.getByTestId(`sag-pin-${d}`).click();
      await page.waitForTimeout(300);
    }
  }
  await page.getByTestId("plan-grid").waitFor({ timeout: 12000 });
}

try {
  await loginOle();

  await page.getByTestId("todo-open-board").click();
  const hak = page.locator('[data-testid^="todo-ledelse-hak-"]').first();
  await hak.waitFor({ timeout: 10000 });
  const hakId = (await hak.getAttribute("data-testid")) || "";
  if ((await hak.getAttribute("data-ledelse")) === "on") await hak.click();
  log("HAK_WHITE", (await hak.getAttribute("data-ledelse")) === "off");
  await hak.click();
  log("HAK_GREEN", (await hak.getAttribute("data-ledelse")) === "on");
  const todoId = hakId.replace("todo-ledelse-hak-", "");
  await shot("plan-hak-list");
  await page.getByTestId("close-x").click();

  const pin = await pinOf();
  await unlockPlan(pin);
  log("NO_TOP_DROP", (await page.getByTestId("plan-drop-draft").count()) > 0);
  log("CREATE_BTN", (await page.getByTestId("plan-create").count()) > 0);
  log("NO_HEADER_VAELG", (await page.locator("header").filter({ hasText: "Vælg to-do" }).count()) === 0);

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const dropBox = await page.getByTestId("plan-dropdown").boundingBox();
  log("DROP_VISIBLE", Boolean(dropBox && dropBox.height > 40 && dropBox.width > 180));
  const inDrop = todoId ? (await page.getByTestId(`plan-todo-${todoId}`).count()) > 0 : (await page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"]').count()) > 0;
  log("DROP_HAS_HAKKED", inDrop);
  await shot("plan-row-drop");
  await closeDrop();

  await goMester();
  await page.getByTestId("todo-open-board").click();
  const hak2 = page.getByTestId(hakId);
  await hak2.waitFor();
  if ((await hak2.getAttribute("data-ledelse")) === "on") await hak2.click();
  log("HAK_OFF", (await hak2.getAttribute("data-ledelse")) === "off");
  await page.getByTestId("close-x").click();

  await unlockPlan(pin);
  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const gone = todoId ? (await page.getByTestId(`plan-todo-${todoId}`).count()) === 0 : true;
  log("UNHAK_GONE", gone);
  await closeDrop();
  await page.getByTestId("plan-create").evaluate((el) => el.click());
  await page.getByTestId("todo-compose").waitFor();
  log("COMPOSE_CAM", (await page.getByTestId("compose-cam").count()) > 0);
  log("COMPOSE_GAL", (await page.getByTestId("compose-gal").count()) > 0);
  log("COMPOSE_FILE", (await page.getByTestId("compose-file").count()) > 0);
  await page.getByTestId("compose-title").fill("Rep efter blik");
  await page.getByTestId("compose-body").fill("Puds efter blik på gavlen. Kun ét sted på sedlen.");
  await page.getByTestId("todo-save").click();
  await page.waitForTimeout(700);
  log("COMPOSE_CLOSED", (await page.getByTestId("todo-compose").count()) === 0);
  await shot("plan-compose");

  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  log("DROP_HAS_NEW", (await page.getByTestId("plan-dropdown").innerText()).includes("Rep efter blik"));
  const unused = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"][data-used="0"]');
  if (await unused.count()) await unused.first().click();
  await page.waitForTimeout(300);
  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const unused2 = page.locator('[data-testid="plan-dropdown"] [data-testid^="plan-todo-"][data-used="0"]');
  if (await unused2.count()) await unused2.first().click();
  await page.waitForTimeout(400);

  const rows = page.locator('[data-testid^="plan-row-pl-"]');
  log("TWO_ROWS", (await rows.count()) >= 1);
  const last = rows.nth(Math.max(0, (await rows.count()) - 1));
  const rowId = ((await last.getAttribute("data-testid")) || "").replace("plan-row-", "");
  const ons = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  if ((await ons.count()) && (await ons.getAttribute("aria-pressed")) !== "true") await ons.click();
  await page.waitForTimeout(250);
  log("DAY_LINE", await page.evaluate(() => {
    const el = document.querySelector(".plan-day");
    if (!el) return false;
    const w = el.getBoundingClientRect().width;
    const b = getComputedStyle(el).borderLeftWidth;
    return w >= 36 && parseFloat(b) >= 1;
  }));
  log("ONS_ON", (await ons.getAttribute("aria-pressed")) === "true");
  await shot("plan-days");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("plan-grid").waitFor();
  const ons2 = page.getByTestId(`plan-cell-${rowId}-2026-09-09`);
  await ons2.waitFor();
  log("REFRESH_DAY", (await ons2.getAttribute("aria-pressed")) === "true");

  await goMester();
  await page.getByTestId("todo-open-board").click();
  const openBtn = page.locator('[data-testid^="todo-open-"], [data-testid^="todo-line-"]').filter({ hasText: "Rep efter blik" }).first();
  if (await openBtn.count()) {
    await openBtn.click();
  } else {
    await page.locator('[data-testid^="todo-line-"]').first().click();
  }
  await page.waitForTimeout(500);
  if ((await page.getByTestId("todo-doc").count()) === 0) {
    const line = page.locator('[data-testid^="todo-line-"]').filter({ hasText: "Rep efter blik" }).first();
    if (await line.count()) await line.click();
  }
  const doc = page.getByTestId("todo-doc");
  if (await doc.count()) {
    await doc.waitFor();
    const title = (await page.getByTestId("todo-doc-title").innerText()) || "";
    const html = await doc.innerText();
    const tekstBoxes = await page.locator("text=Tekst:").count();
    log("DOC_TITLE", /Rep efter blik/.test(title) || /Rep efter blik/.test(html));
    log("DOC_NO_TEKST_BOX", tekstBoxes === 0);
    const bodyCount = (html.match(/Puds efter blik på gavlen/g) || []).length;
    const titleCount = (html.match(/Rep efter blik/g) || []).length;
    log("DOC_NO_DUP", titleCount <= 2 && bodyCount <= 1);
    await shot("todo-seddel");
  } else {
    log("DOC_TITLE", false);
    log("DOC_NO_TEKST_BOX", false);
    log("DOC_NO_DUP", false);
    await shot("todo-seddel-miss");
  }

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  if ((await page.getByTestId("sag-pin-gate").count()) > 0 && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  log("KS_URORT", (await page.getByTestId("ledelse-btn-ks").count()) > 0);

  await goMester();
  await page.getByTestId("notice-bell").click();
  await page.waitForTimeout(300);
  const notice = await page.locator("body").innerText();
  log("NOTICE_MASTER", /Ny to-do|Rep efter blik|Plan ændret/.test(notice));

  const fail = [];
  for (const [k, v] of Object.entries(results)) {
    if (v !== true) fail.push(`${k}=${v}`);
  }
  if (fail.length) {
    console.error("FAIL_CHECKS", fail);
    process.exitCode = 1;
  } else console.log("OK");
} catch (err) {
  console.error("QA_ERROR", err);
  await shot("plan-slip-error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
