import { chromium } from "playwright";
import fs from "node:fs";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
fs.writeFileSync("/tmp/qa-todo-a.png", Buffer.from(PNG, "base64"));
fs.writeFileSync("/tmp/qa-todo-b.png", Buffer.from(PNG, "base64"));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
  console.log("shot", name);
}

function log(label, value) {
  console.log(label, value);
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if ((await page.getByTestId("todo-open-board").count()) > 0) return;
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
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

try {
  await loginOle();

  // --- 1. Fotos på redigér ---
  await page.getByTestId("todo-open-board").click();
  await page.locator('[data-testid^="todo-edit-"]').first().waitFor({ timeout: 10000 });
  await page.locator('[data-testid^="todo-edit-"]').first().click();
  await page.getByTestId("todo-edit-sheet").waitFor();
  log("EDIT_PHOTOS", await page.getByTestId("todo-edit-photos").count());
  log("EDIT_CAM", await page.getByTestId("todo-edit-cam").count());
  log("EDIT_GAL", await page.getByTestId("todo-edit-gal").count());
  log("EDIT_FILE", await page.getByTestId("todo-edit-file").count());
  await page.getByTestId("todo-edit-title").fill("TEST-to-do");
  await page.getByTestId("todo-edit-body").fill("TEST-to-do med to fotos til byggeledelse.");
  const gal = page.locator('[data-testid="todo-edit-photos"] input[accept="image/*"]:not([capture])');
  await gal.setInputFiles(["/tmp/qa-todo-a.png", "/tmp/qa-todo-b.png"]);
  await page.waitForTimeout(4000);
  const thumbsAfterAdd = await page.locator('[data-testid^="todo-edit-photo-"]:not([data-testid^="todo-edit-photo-x-"])').count();
  log("EDIT_THUMBS_AFTER_ADD", thumbsAfterAdd);
  await shot("todo-edit-photos");
  await page.getByTestId("todo-edit-save").click();
  await page.waitForTimeout(800);

  const search = page.getByPlaceholder("Søg i to-do");
  if (await search.count()) await search.fill("TEST-to-do");
  await page.waitForTimeout(300);
  const testRow = page.locator('[data-testid^="todo-line-"]').filter({ hasText: "TEST-to-do" }).first();
  await testRow.waitFor({ timeout: 8000 });
  await testRow.getByText("TEST-to-do", { exact: true }).click();
  await page.getByTestId("todo-doc").waitFor({ timeout: 8000 });
  const slip = await page.getByTestId("todo-doc").innerText();
  log("SLIP_TITLE", /TEST-to-do/.test(slip));
  log("SLIP_HAS_FOTOS", /Fotos/i.test(slip));
  const slipImgs = await page.locator('[data-testid="todo-doc"] img').count();
  log("SLIP_IMGS", slipImgs);
  await shot("todo-slip-photos");
  await page.getByText("Rediger", { exact: true }).click();
  await page.getByTestId("todo-edit-sheet").waitFor();
  const xs = page.locator('[data-testid^="todo-edit-photo-x-"]');
  const beforeDel = await xs.count();
  log("EDIT_THUMBS_BEFORE_DEL", beforeDel);
  if (beforeDel > 0) {
    await xs.first().click();
    await page.waitForTimeout(600);
  }
  const afterDel = await page.locator('[data-testid^="todo-edit-photo-"]:not([data-testid^="todo-edit-photo-x-"])').count();
  log("EDIT_THUMBS_AFTER_DEL", afterDel);
  await page.getByTestId("todo-edit-save").click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if ((await page.getByTestId("todo-open-board").count()) === 0) await loginOle();
  await page.getByTestId("todo-open-board").click();
  const search2 = page.getByPlaceholder("Søg i to-do");
  await search2.waitFor();
  await search2.fill("TEST-to-do");
  await page.waitForTimeout(300);
  const testRow2 = page.locator('[data-testid^="todo-line-"]').filter({ hasText: "TEST-to-do" }).first();
  await testRow2.locator('[data-testid^="todo-edit-"]').click();
  await page.getByTestId("todo-edit-sheet").waitFor();
  const afterRefresh = await page.locator('[data-testid^="todo-edit-photo-"]:not([data-testid^="todo-edit-photo-x-"])').count();
  log("EDIT_THUMBS_AFTER_REFRESH", afterRefresh);
  log("PHOTO_DELETE_STICKS", afterRefresh === Math.max(0, beforeDel - 1));
  await shot("todo-edit-after-del");
  await page.getByTestId("todo-edit-sheet").getByTestId("close-x").click();

  // --- 2. Folk Gem adgang ---
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("todo-open-board").count()) === 0) await loginOle();
  await page.getByRole("button", { name: "Folk", exact: true }).click();
  await page.getByTestId("folk-person-emp-alex").waitFor({ timeout: 10000 });
  await page.getByTestId("folk-person-emp-alex").click();
  await page.getByTestId("folk-sager-card").waitFor({ timeout: 8000 });
  log("FOLK_SAGER_CARD", await page.getByTestId("folk-sager-card").count());
  log("FOLK_SAVE", await page.getByTestId("folk-assign-save").count());
  const kaer = page.getByTestId("folk-assign-job-kaerhuset");
  await kaer.waitFor();
  const startOn = await kaer.isChecked();
  log("ALEX_KAER_START", startOn);
  await kaer.click();
  log("ALEX_KAER_TOGGLED", await kaer.isChecked());
  await shot("folk-alex-toggle");
  await page.locator("div.fixed").filter({ has: page.getByTestId("folk-sager-card") }).getByRole("button", { name: "Folk" }).click();
  await page.getByTestId("folk-person-emp-alex").waitFor();
  await page.getByTestId("folk-person-emp-alex").click();
  await page.getByTestId("folk-sager-card").waitFor();
  const withoutSave = await page.getByTestId("folk-assign-job-kaerhuset").isChecked();
  log("ALEX_KAER_WITHOUT_SAVE", withoutSave);
  log("WITHOUT_SAVE_UNCHANGED", withoutSave === startOn);
  if (withoutSave === startOn) {
    await page.getByTestId("folk-assign-job-kaerhuset").click();
  }
  await page.getByTestId("folk-assign-save").click();
  await page.getByTestId("folk-assign-ok").waitFor({ timeout: 5000 });
  log("ADGANG_GEMT", (await page.getByTestId("folk-assign-ok").innerText()).includes("Adgang gemt"));
  await shot("folk-alex-saved");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  if ((await page.getByTestId("folk-person-emp-alex").count()) === 0) {
    if ((await page.getByTestId("todo-open-board").count()) === 0) await loginOle();
    await page.getByRole("button", { name: "Folk", exact: true }).click();
    await page.getByTestId("folk-person-emp-alex").waitFor({ timeout: 10000 });
  }
  await page.getByTestId("folk-person-emp-alex").click();
  await page.getByTestId("folk-sager-card").waitFor();
  const afterFolkRefresh = await page.getByTestId("folk-assign-job-kaerhuset").isChecked();
  log("ALEX_KAER_AFTER_REFRESH", afterFolkRefresh);
  await shot("folk-alex-refresh");

  // --- 3. Byggeleder to-do-liste ---
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm/todo", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  log("LIST_PAGE", await page.getByTestId("ledelse-todo-page").count());
  log("LIST_BLOCK", await page.getByTestId("ledelse-todo-list").count());
  log("LIST_CREATE", await page.getByTestId("ledelse-todo-create").count());
  const wide = await page.locator('[data-testid="ledelse-todo-page"] .max-w-4xl').count();
  log("LIST_WIDE", wide);
  if ((await page.locator('[data-testid^="ledelse-todo-row-"]').count()) === 0) {
    await page.getByTestId("ledelse-todo-create").click();
    await page.getByTestId("compose-title").waitFor();
    log("COMPOSE_CAM", await page.getByTestId("compose-cam").count());
    log("COMPOSE_GAL", await page.getByTestId("compose-gal").count());
    log("COMPOSE_FILE", await page.getByTestId("compose-file").count());
    await page.getByTestId("compose-title").fill("TEST-to-do");
    await page.getByTestId("compose-body").fill("Tjek udsparing og tag to fotos.");
    await page.getByTestId("todo-save").click();
    await page.waitForTimeout(900);
  }
  const rows = await page.locator('[data-testid^="ledelse-todo-row-"]').count();
  log("LIST_ROWS", rows);
  log("LIST_HAS_AABN", (await page.getByRole("button", { name: "Åbn" }).count()) > 0);
  log("LIST_HAS_TITLE", /TEST-to-do|Ryd|Tjek/i.test(await page.getByTestId("ledelse-todo-list").innerText()));
  await shot("ledelse-todo-pc-list");
  const firstOpen = page.locator('[data-testid^="ledelse-todo-open-"]').first();
  if (await firstOpen.count()) {
    await firstOpen.click();
    await page.getByTestId("todo-doc").waitFor({ timeout: 8000 });
    const doc = await page.getByTestId("todo-doc").innerText();
    log("OPEN_SLIP", await page.getByTestId("ledelse-todo-slip").count());
    log("SLIP_TITLE_ONCE", (doc.match(/TEST-to-do|Ryd|Tjek/g) || []).length >= 1);
    log("SLIP_FOTOS_LABEL", /Fotos/i.test(doc));
    await shot("ledelse-todo-pc-slip");
  }

  console.log("QA_DONE");
} catch (err) {
  console.error("FAIL", err);
  await shot("fotos-folk-liste-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
