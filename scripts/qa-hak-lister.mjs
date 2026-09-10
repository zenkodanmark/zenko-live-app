import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

function log(label, value) {
  console.log(label, value);
}

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (await page.getByTestId("login-emp-ole").count()) {
    await page.getByTestId("login-emp-ole").click();
    await page.getByTestId("pin-pad").waitFor();
    for (const d of "7777") await page.getByTestId(`pin-${d}`).click();
    await page.getByTestId("todo-open-board").waitFor({ timeout: 15000 });
  }
}

async function openJob(name) {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 12000 });
}

function line(re) {
  return page.locator('[data-testid^="todo-line-"]').filter({ hasText: re }).first();
}

function r21Line() {
  return page.locator('[data-testid^="todo-line-"]').filter({ hasText: /R21/i }).filter({ hasNotText: /rep efter blik/i }).first();
}

async function waitHak(btn, want) {
  const testId = await btn.getAttribute("data-testid");
  await page.waitForFunction(
    ({ testId, wantOn }) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      return el && el.getAttribute("data-ledelse") === wantOn && el.getAttribute("aria-busy") !== "true";
    },
    { testId, wantOn: want },
    { timeout: 15000 },
  );
}

async function setHak(btn, want) {
  await btn.waitFor({ timeout: 8000 });
  const now = await btn.getAttribute("data-ledelse");
  if (now !== want) {
    await btn.click();
    await waitHak(btn, want);
  }
  return btn;
}

async function dbTodo(id) {
  const { data, error } = await sb.from("todos").select("id, translations").eq("id", id).maybeSingle();
  if (error) return `err:${error.message}`;
  const v = data?.translations && typeof data.translations === "object" ? data.translations.__ledelse : "";
  return v || "";
}

try {
  await loginOle();
  await openJob(/Islevvænge/i);
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(300);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  const pin = (clip.match(/Kode:\s*(\d{4})/) || [])[1] || "";
  log("PIN", pin.length === 4 ? "yes" : "no");

  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);

  const blikBtn = line(/^Rep efter blik mand/i).locator('[data-testid^="todo-ledelse-hak-"]');
  const r21Btn = page.locator('[data-testid^="todo-line-"]').filter({ hasText: /R21A Ændre sålbænke/i }).first().locator('[data-testid^="todo-ledelse-hak-"]');
  await blikBtn.waitFor({ timeout: 10000 });
  await setHak(blikBtn, "on");
  await setHak(r21Btn, "off");
  const blikOn = await blikBtn.getAttribute("data-ledelse");
  const r21On = await r21Btn.getAttribute("data-ledelse");
  const blikClass = await blikBtn.getAttribute("class");
  const r21Class = await r21Btn.getAttribute("class");
  log("TODO_SMALL", /text-\[11px\]/.test(blikClass || "") && /Byggeleder/.test(await blikBtn.innerText()));
  log("BLIK_GREEN", blikOn === "on" && /bg-moss/.test(blikClass || ""));
  log("R21_WHITE", r21On === "off" && /bg-white/.test(r21Class || ""));
  const blikId = (await blikBtn.getAttribute("data-testid") || "").replace("todo-ledelse-hak-", "");
  const r21Id = (await r21Btn.getAttribute("data-testid") || "").replace("todo-ledelse-hak-", "");
  await page.waitForTimeout(500);
  const blikDb = await dbTodo(blikId);
  const r21Db = await dbTodo(r21Id);
  log("BLIK_ID", blikId);
  log("R21_ID", r21Id);
  log("DB_BLIK", blikDb);
  log("DB_R21", r21Db);
  log("FLAG_IN_SUPABASE", blikDb === "med_til_ledelse" && r21Db === "skjult");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  if (await page.getByTestId("login-emp-ole").count()) await loginOle();
  await openJob(/Islevvænge/i);
  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  const blikAfter = await line(/^Rep efter blik mand/i).locator('[data-testid^="todo-ledelse-hak-"]').getAttribute("data-ledelse");
  const r21After = await page.locator('[data-testid^="todo-line-"]').filter({ hasText: /R21A Ændre sålbænke/i }).first().locator('[data-testid^="todo-ledelse-hak-"]').getAttribute("data-ledelse");
  log("REFRESH_SAME", blikAfter === "on" && r21After === "off");
  await shot("hak-todo-refresh");

  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await guest.newPage();
  g.setDefaultTimeout(25000);
  await g.goto("http://127.0.0.1:8080/sag/islevvaenge/todo", { waitUntil: "networkidle" });
  await g.getByTestId("ledelse-todo-page").waitFor({ timeout: 12000 });
  await g.waitForTimeout(1200);
  const listText = await g.getByTestId("ledelse-todo-list").innerText();
  log("LEDELSE_HAS_BLIK", /Rep efter blik/i.test(listText));
  log("LEDELSE_NO_R21_PLAIN", !listText.split(/\n+/).some((l) => /^R21/i.test(l.trim()) && !/rep efter blik/i.test(l) && l.trim().length < 80));
  await g.screenshot({ path: "/workspace/screenshots/hak-ledelse-todo.png" });

  await g.goto("http://127.0.0.1:8080/sag/islevvaenge", { waitUntil: "networkidle" });
  await g.waitForTimeout(800);
  if (await g.getByTestId("sag-pin-gate").count()) {
    await g.goto("http://127.0.0.1:8080/sag/islevvaenge/ks", { waitUntil: "networkidle" });
  }
  await g.goto("http://127.0.0.1:8080/sag/islevvaenge/ks", { waitUntil: "networkidle" });
  await g.waitForTimeout(800);
  const ksBody = await g.locator("body").innerText();
  const ksRows = await g.locator('[data-testid^="ledelse-row-"]').count();
  log("ISLEV_KS_ROWS", ksRows);
  log("ISLEV_KS_EMPTY", ksRows === 0 || /Ingen KS-rapporter/i.test(ksBody));
  log("ISLEV_NO_DUMMY_12", !/\b12\b/.test(ksBody) || /Ingen KS-rapporter/i.test(ksBody) || ksRows === 0);
  await g.screenshot({ path: "/workspace/screenshots/hak-islev-ks.png" });
  await guest.close();

  await openJob(/Kærhuset|Kaerhuset/i);
  await page.getByTestId("sag-row-ks").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await shot("hak-kaerhuset-ks");
  const softrRows = await page.locator('[data-testid^="ks-row-ksr-softr-"]').count();
  const grokRows = await page.locator('[data-testid^="ks-row-ksr-grok-"], [data-testid^="ks-row-Z-KS"]').count();
  const allKs = await page.locator('[data-testid^="ks-row-"]').count();
  log("KAER_SOFTR_KS", softrRows);
  log("KAER_GROK_KS", grokRows);
  log("KAER_ALL_KS", allKs);
  log("SOFTR_KS_ON_MESTER", softrRows >= 8);
  const firstKs = page.locator('[data-testid^="ks-row-"]').first();
  const kundeOnKs = await firstKs.locator('[data-testid^="kunde-hak-"]').count();
  const ledelseOnKs = await firstKs.locator('[data-testid^="ledelse-hak-"]').count();
  log("KS_HAS_KUNDE", kundeOnKs > 0);
  log("KS_NO_BYGGELEDER", ledelseOnKs === 0);
  const kundeLabel = kundeOnKs ? await firstKs.locator('[data-testid^="kunde-hak-"]').innerText() : "";
  log("KS_KUNDE_LABEL", kundeLabel.trim() === "Kunde");

  await page.getByTestId("sag-list-sheet").locator("button", { hasText: /Tilbage|Luk/i }).first().click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  const close = page.getByRole("button", { name: /Luk/i }).first();
  if (await close.count()) await close.click().catch(() => {});
  await page.waitForTimeout(300);
  await openJob(/Islevvænge/i);
  await page.getByTestId("sag-row-tf").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  const tfRow = page.locator("li").filter({ has: page.locator('[data-testid^="ledelse-hak-"]') }).first();
  const tfLedelse = await page.locator('[data-testid^="ledelse-hak-"]').count();
  const tfKunde = await page.locator('[data-testid^="kunde-hak-"]').count();
  log("TF_HAS_BOTH", tfLedelse > 0 && tfKunde > 0);
  const ledLabel = tfLedelse ? await page.locator('[data-testid^="ledelse-hak-"]').first().innerText() : "";
  log("TF_LED_LABEL", ledLabel.trim() === "Byggeleder");
  await shot("hak-tf-buttons");

  await page.goto("http://127.0.0.1:8080/sag/islevvaenge/plan", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("sag-pin-gate").count()) && pin) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(800);
  }
  await page.getByTestId("plan-grid").waitFor({ timeout: 12000 });
  await page.getByTestId("plan-drop-draft").click();
  await page.getByTestId("plan-dropdown").waitFor();
  const drop = await page.getByTestId("plan-dropdown").innerText();
  log("DROP_HAS_BLIK", /Rep efter blik/i.test(drop));
  log("DROP_NO_R21_PLAIN", !drop.split(/\n+/).some((l) => /^R21/i.test(l.trim()) && !/rep efter blik/i.test(l) && l.trim().length < 80));
  await shot("hak-plan-drop");

  const pass =
    blikDb === "med_til_ledelse" &&
    r21Db === "skjult" &&
    blikAfter === "on" &&
    r21After === "off" &&
    softrRows >= 8 &&
    kundeOnKs > 0 &&
    ledelseOnKs === 0;
  log("PASS", pass);
  if (!pass) process.exitCode = 1;
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("hak-lister-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 1800));
  process.exitCode = 1;
} finally {
  await browser.close();
}
