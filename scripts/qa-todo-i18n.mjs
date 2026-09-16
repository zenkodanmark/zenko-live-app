import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

const TITLE = "QA Ryd op bag skuret";
const BODY = "Ryd op bag skuret. Send foto.";
const stamp = Date.now().toString(36);
const title = `${TITLE} ${stamp}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.split("\n")[0]));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function login(empId, pin) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId(`login-${empId}`).waitFor({ timeout: 20000 });
  await page.getByTestId(`login-${empId}`).click();
  await page.getByTestId("pin-pad").waitFor();
  await page.waitForTimeout(600);
  for (const d of pin) {
    const box = await page.getByTestId(`pin-${d}`).boundingBox();
    if (!box) throw new Error(`no pin-${d}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
  }
  const submit = page.getByTestId("pin-submit");
  if ((await submit.count()) && (await submit.isEnabled())) {
    const sbx = await submit.boundingBox();
    if (sbx) await page.mouse.click(sbx.x + sbx.width / 2, sbx.y + sbx.height / 2);
  }
}

async function waitDesk(testId) {
  await page.getByTestId(testId).waitFor({ timeout: 25000 });
}

let todoId = "";
try {
  await login("emp-ole", "7777");
  try {
    await waitDesk("todo-open-board");
  } catch (e) {
    console.log("AFTER_PIN", (await page.locator("body").innerText()).slice(0, 500).replace(/\n/g, " | "));
    await shot("todo-i18n-login-fail");
    throw e;
  }
  console.log("LOGGED_OLE", true);

  await page.getByRole("navigation").getByRole("button", { name: "Folk" }).click();
  await page.getByText("Ion Zafier", { exact: false }).first().waitFor({ timeout: 12000 });
  await page.getByText("Ion Zafier", { exact: false }).first().click();
  await page.getByTestId("folk-todo-plus").click();
  await page.getByTestId("todo-compose").waitFor();
  await page.getByTestId("compose-title").fill(title);
  await page.getByTestId("compose-body").fill(BODY);
  await page.getByTestId("todo-save").click();
  await page.waitForTimeout(1500);
  console.log("CREATED_UI", true);
  await shot("todo-i18n-created");

  let row = null;
  for (let i = 0; i < 24; i++) {
    const { data } = await sb.from("todos").select("id, title, body, original, source_lang, translations, assignee_id, assignee_ids").ilike("title", `%${stamp}%`).maybeSingle();
    row = data;
    if (row?.id) {
      todoId = row.id;
      const ro = row.translations?.ro;
      const roBody = typeof ro === "string" ? ro : ro?.body;
      if (roBody && !/Ryd op bag skuret/i.test(roBody)) break;
    }
    await page.waitForTimeout(1500);
  }
  const ro = row?.translations?.ro;
  const da = row?.translations?.da;
  const roBody = typeof ro === "string" ? ro : ro?.body;
  const roTitle = typeof ro === "string" ? ro : ro?.title;
  const daBody = typeof da === "string" ? da : da?.body;
  const daTitle = typeof da === "string" ? da : da?.title;
  console.log("DB_ID", todoId);
  console.log("DB_SOURCE", row?.source_lang);
  console.log("DB_RO_OBJ", Boolean(ro && typeof ro === "object"));
  console.log("DB_RO_TITLE", roTitle || "");
  console.log("DB_RO_BODY", roBody || "");
  console.log("DB_DA_TITLE", daTitle || "");
  console.log("DB_DA_BODY", daBody || "");
  console.log("RO_IS_RO", Boolean(roBody && !/Ryd op bag skuret/i.test(roBody)));
  console.log("DA_HAS_BODY", Boolean(daBody && /Send foto/i.test(daBody)));
  console.log("NOT_ONLY_TITLE", Boolean(ro && typeof ro === "object" && ro.title && ro.body));

  if (await page.getByTestId("folk-todo-bar").count()) {
    await page.getByTestId("folk-todo-bar").click();
  } else {
    await page.getByRole("navigation").getByRole("button", { name: "Folk" }).click();
    await page.getByText("Ion Zafier", { exact: false }).first().click();
    await page.getByTestId("folk-todo-bar").click();
  }
  const line = page.locator(`[data-testid^="todo-line-"]`).filter({ hasText: stamp }).first();
  await line.waitFor({ timeout: 12000 });
  await line.click();
  await page.getByTestId("master-todo-open").waitFor({ timeout: 8000 });
  const masterTitle = await page.getByTestId("master-todo-title").innerText();
  const masterBody = (await page.getByTestId("master-todo-body").count()) ? await page.getByTestId("master-todo-body").innerText() : "";
  console.log("MASTER_DA_TITLE", /Ryd op/.test(masterTitle));
  console.log("MASTER_DA_BODY", /Send foto/.test(masterBody));
  console.log("MASTER_NO_ORIGINAL", (await page.getByTestId("todo-original-line").count()) === 0);
  await shot("todo-i18n-ole");
  await page.getByTestId("close-x").first().click({ force: true }).catch(() => {});

  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
  });
  await login("emp-ion", "3333");
  await page.waitForTimeout(2500);
  const ionBody = await page.locator("body").innerText();
  console.log("ION_ON_CREW", /To-do|todo|Curăț|sopron|șopron|Trimite|foto/i.test(ionBody));
  const ionLine = page.locator(`[data-testid^="crew-todo-"], [data-testid^="todo-line-"]`).filter({ hasText: new RegExp(stamp + "|Curăț|șopron|sopron", "i") }).first();
  if (await ionLine.count()) {
    await ionLine.click();
    if (await page.getByTestId("crew-todo-open").count()) {
      const t = await page.getByTestId("crew-todo-title").innerText();
      const b = (await page.getByTestId("crew-todo-body").count()) ? await page.getByTestId("crew-todo-body").innerText() : "";
      console.log("ION_TITLE_RO", Boolean(t) && !/Ryd op bag skuret/i.test(t));
      console.log("ION_BODY_RO", Boolean(b) && !/Ryd op bag skuret/i.test(b));
      console.log("ION_HAS_ORIGINAL", (await page.getByTestId("todo-original-line").count()) > 0);
    }
  } else {
    console.log("ION_TITLE_RO", /Curăț|șopron|sopron/i.test(ionBody));
    console.log("ION_BODY_RO", /Trimite|foto/i.test(ionBody) && !/Ryd op bag skuret\. Send foto/i.test(ionBody));
  }
  await shot("todo-i18n-ion");
} finally {
  if (todoId) {
    await sb.from("todos").delete().eq("id", todoId);
    console.log("CLEANUP", todoId);
  }
  await browser.close();
}
