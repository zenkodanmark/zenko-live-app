import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

const id = `td-qa-udfort-${Date.now()}`;
const title = `QA Bryggers ${id.slice(-6)}`;
const body = "Fliser 2,5 x 2,5 m";

function log(k, v) {
  console.log(k, v);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  log("shot", name);
}

try {
  const ins = await sb.from("todos").insert({
    id,
    project_id: "job-hillerodsholm",
    assignee_id: "emp-osvaldo",
    assignee_ids: ["emp-osvaldo"],
    from_id: "emp-ole",
    title,
    body,
    original: body,
    kind: "task",
    done: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: [],
    photo_file_ids: [],
    translations: { da: body },
  });
  log("INSERT", ins.error ? ins.error.message : "ok");

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-emp-ole").waitFor({ timeout: 20000 });
  await page.getByTestId("login-emp-ole").click();
  await page.getByTestId("pin-pad").waitFor();
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) {
    await page.getByTestId("pin-7").click({ force: true });
    await page.waitForTimeout(280);
  }
  await shot("todo-udfort-pin-filled");
  log("PIN_BODY", (await page.locator("body").innerText()).slice(0, 400).replace(/\n/g, " | "));
  if (await page.getByTestId("pin-submit").count()) {
    if (await page.getByTestId("pin-submit").isEnabled()) await page.getByTestId("pin-submit").click();
  }
  try {
    await page.getByTestId("todo-open-board").waitFor({ timeout: 20000 });
  } catch (e) {
    log("AFTER_PIN_URL", page.url());
    log("AFTER_PIN_BODY", (await page.locator("body").innerText()).slice(0, 600));
    await shot("todo-udfort-after-pin");
    throw e;
  }
  log("LOGGED_IN", true);

  await page.getByRole("button", { name: "Sager" }).click();
  const hill = page.getByRole("button", { name: /Hillerødsholm/i }).first();
  await hill.waitFor({ timeout: 12000 });
  await hill.click();
  await page.getByTestId("sag-row-todo").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1000);

  let line = page.getByTestId(`todo-line-${id}`);
  if (!(await line.count())) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Sager" }).click();
    await hill.waitFor({ timeout: 12000 });
    await hill.click();
    await page.getByTestId("sag-row-todo").click();
    await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
    await page.waitForTimeout(1200);
    line = page.getByTestId(`todo-line-${id}`);
  }
  log("LINE_ON_OPEN", await line.count());
  log("DONE_LINK_SAG", await page.getByTestId("sag-todo-done-link").count());
  await shot("todo-udfort-list");

  await page.getByTestId(`todo-open-${id}`).click();
  await page.getByTestId("master-todo-open").waitFor({ timeout: 8000 });
  log("OPEN_TITLE", await page.getByTestId("master-todo-title").innerText());
  log("OPEN_BODY", await page.getByTestId("master-todo-body").innerText());
  const doneBtn = page.getByTestId("master-todo-done");
  await doneBtn.waitFor();
  const boxes = await page.evaluate(() => {
    const done = document.querySelector("[data-testid=master-todo-done]");
    const titleEl = document.querySelector("[data-testid=master-todo-title]");
    const bodyEl = document.querySelector("[data-testid=master-todo-body]");
    const reply = document.querySelector("[data-testid=master-todo-reply]");
    const r = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
    return { done: r(done), title: r(titleEl), body: r(bodyEl), reply: r(reply) };
  });
  log("ORDER_TITLE_THEN_BODY", boxes.title && boxes.body ? boxes.title.bottom <= boxes.body.top + 2 : false);
  log("ORDER_BODY_THEN_DONE", boxes.body && boxes.done ? boxes.body.bottom <= boxes.done.top + 2 : false);
  log("ORDER_DONE_THEN_REPLY", boxes.done && boxes.reply ? boxes.done.bottom <= boxes.reply.top + 2 : false);
  log("DONE_PRESSABLE", await doneBtn.isEnabled());
  await shot("todo-udfort-open");

  await doneBtn.click();
  await page.waitForTimeout(800);
  log("GONE_AFTER_DONE", (await page.getByTestId(`todo-line-${id}`).count()) === 0);
  log("SHEET_CLOSED", (await page.getByTestId("master-todo-open").count()) === 0);
  await shot("todo-udfort-gone");

  await page.getByTestId("sag-todo-done-link").click();
  await page.getByTestId(`todo-undo-${id}`).waitFor({ timeout: 8000 });
  const hist = await page.locator("body").innerText();
  log("HIST_HAS_TITLE", hist.includes(title));
  log("HIST_HAS_BODY", hist.includes("Fliser"));
  log("HIST_HAS_DATE", /\d{4}-\d{2}-\d{2}/.test(hist));
  await shot("todo-udfort-hist");

  await page.getByTestId(`todo-undo-${id}`).click();
  await page.waitForTimeout(700);
  log("GONE_FROM_HIST", (await page.getByTestId(`todo-undo-${id}`).count()) === 0);
  await page.getByTestId("close-x").first().click({ force: true });
  await page.waitForTimeout(500);
  if (!(await page.getByTestId(`todo-line-${id}`).count())) {
    await page.getByTestId("sag-row-todo").click().catch(() => {});
    await page.waitForTimeout(700);
  }
  log("BACK_ON_OPEN", (await page.getByTestId(`todo-line-${id}`).count()) > 0);
  await shot("todo-udfort-back");

  await page.getByRole("button", { name: /Log ud/i }).click().catch(() => {});
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
  });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-emp-osvaldo").waitFor({ timeout: 15000 });
  await page.getByTestId("login-emp-osvaldo").click();
  await page.getByTestId("pin-pad").waitFor();
  await page.waitForTimeout(300);
  for (const d of "5555") {
    await page.getByRole("button", { name: d, exact: true }).click();
    await page.waitForTimeout(120);
  }
  if (await page.getByTestId("pin-submit").isEnabled()) await page.getByTestId("pin-submit").click();
  await page.waitForTimeout(2500);
  if (await page.getByText(title).count()) {
    await page.getByText(title).first().click();
    await page.waitForTimeout(700);
  }
  log("EMP_CREW_OPEN", await page.getByTestId("crew-todo-open").count());
  log("EMP_DONE_BTN", await page.getByTestId("crew-todo-done").count());
  log("EMP_NOT_MASTER", (await page.getByTestId("master-todo-open").count()) === 0);
  await shot("todo-udfort-emp");

  const db = await sb.from("todos").select("done, done_by_id, done_at").eq("id", id).maybeSingle();
  log("DB_AFTER_UNDO", JSON.stringify(db.data));
} finally {
  const del = await sb.from("todos").delete().eq("id", id);
  log("CLEANUP", del.error ? del.error.message : "ok");
  await browser.close();
}
