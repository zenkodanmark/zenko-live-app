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

async function openIslevSag() {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Islevvænge/i }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 12000 });
}

async function openIslevTodos() {
  await openIslevSag();
  await page.getByTestId("sag-row-todo").waitFor({ timeout: 12000 });
  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1000);
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

async function dbFlag(id) {
  const { data, error } = await sb.from("todos").select("id, translations").eq("id", id).maybeSingle();
  if (error) return `err:${error.message}`;
  const v = data?.translations && typeof data.translations === "object" ? data.translations.__ledelse : "";
  return v || "";
}

function hasR21NotBlik(text) {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return lines.some((l) => /^R21/i.test(l) && !/rep efter blik/i.test(l) && l.length < 80);
}

try {
  await loginOle();
  await openIslevSag();
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(300);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  const pin = (clip.match(/Kode:\s*(\d{4})/) || [])[1] || "";
  log("PIN", pin.length === 4 ? "yes" : "no");

  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1000);
  await shot("todo-ledelse-list");

  const blikBtn = line(/^Rep efter blik/i).locator('[data-testid^="todo-ledelse-hak-"]');
  const r21Btn = r21Line().locator('[data-testid^="todo-ledelse-hak-"]');
  await blikBtn.waitFor({ timeout: 10000 });
  await r21Btn.waitFor({ timeout: 10000 });

  await setHak(blikBtn, "off");
  await setHak(blikBtn, "on");
  await setHak(r21Btn, "on");
  await setHak(r21Btn, "off");

  const blikOn = await blikBtn.getAttribute("data-ledelse");
  const r21On = await r21Btn.getAttribute("data-ledelse");
  const blikClass = await blikBtn.getAttribute("class");
  const r21Class = await r21Btn.getAttribute("class");
  log("BLIK_GREEN", blikOn === "on" && /bg-moss/.test(blikClass || ""));
  log("R21_WHITE", r21On === "off" && /bg-white/.test(r21Class || ""));

  const blikId = (await blikBtn.getAttribute("data-testid") || "").replace("todo-ledelse-hak-", "");
  const r21Id = (await r21Btn.getAttribute("data-testid") || "").replace("todo-ledelse-hak-", "");
  await page.waitForTimeout(600);
  const blikDb = await dbFlag(blikId);
  const r21Db = await dbFlag(r21Id);
  log("BLIK_ID", blikId);
  log("R21_ID", r21Id);
  log("DB_BLIK", blikDb);
  log("DB_R21", r21Db);
  log("FLAG_IN_SUPABASE", blikDb === "med_til_ledelse" && r21Db === "skjult");
  await shot("todo-ledelse-toggled");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (await page.getByTestId("login-emp-ole").count()) await loginOle();
  await openIslevTodos();
  const blikAfter = await line(/^Rep efter blik/i).locator('[data-testid^="todo-ledelse-hak-"]').getAttribute("data-ledelse");
  const r21After = await r21Line().locator('[data-testid^="todo-ledelse-hak-"]').getAttribute("data-ledelse");
  log("REFRESH_BLIK", blikAfter);
  log("REFRESH_R21", r21After);
  log("REFRESH_SAME", blikAfter === "on" && r21After === "off");
  await shot("todo-ledelse-refresh");

  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await guest.newPage();
  g.setDefaultTimeout(25000);
  await g.goto("http://127.0.0.1:8080/sag/islevvaenge/todo", { waitUntil: "networkidle" });
  await g.getByTestId("ledelse-todo-page").waitFor({ timeout: 12000 });
  await g.waitForTimeout(1500);
  const listText = await g.getByTestId("ledelse-todo-list").innerText();
  log("LEDELSE_HAS_BLIK", /Rep efter blik/i.test(listText));
  log("LEDELSE_NO_R21_PLAIN", !hasR21NotBlik(listText));
  await g.screenshot({ path: "/workspace/screenshots/todo-ledelse-sag-list.png" });
  console.log("shot todo-ledelse-sag-list");
  await guest.close();

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
  log("DROP_NO_R21_PLAIN", !hasR21NotBlik(drop));
  await shot("todo-ledelse-plan-drop");

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("todo-ledelse-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 1800));
  process.exitCode = 1;
} finally {
  await browser.close();
}
