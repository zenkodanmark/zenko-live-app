import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function login(name) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(name) }).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.waitForTimeout(800);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });

  await login("Ole");
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  const board = await page.locator("body").innerText();
  console.log("MAT_TITLE", /Materiale/.test(board));
  console.log("MAT_NEED", /Mangler mørtel, brædder og afdækning/.test(board));
  console.log("MAT_ION", /Ion/.test(board) && /Islevvænge/.test(board));
  console.log("MAT_WEBER_ON_BOARD", /Weber/.test(board));
  await shot("mat-board");

  await page.getByText("Mangler mørtel, brædder og afdækning").first().click();
  await page.waitForTimeout(600);
  const sheet = await page.locator("body").innerText();
  console.log("MAT_KC", /KC\s*50\/50\/700/.test(sheet));
  console.log("MAT_NO_WEBER", !/Weber/.test(sheet));
  console.log("MAT_NOT_UDBUD", /ikke i udbud/.test(sheet));
  console.log("MAT_BRAEDDER", /brædder/.test(sheet));
  console.log("MAT_AFDAEK", /afdækning/.test(sheet));
  console.log("MAT_SEND", /Send nu/.test(sheet));
  console.log("MAT_DRAFT", /Gem som kladde/.test(sheet));
  await shot("mat-order");

  await page.getByLabel("Antal").fill("10");
  await page.getByRole("button", { name: "Gem som kladde" }).click();
  await page.waitForTimeout(1200);
  const after = await page.locator("body").innerText();
  console.log("MAT_ORDERED", /Z-MAT-2026/.test(after) || /KC\s*50\/50\/700/.test(after));
  console.log("MAT_DRAFT_STATUS", /Kladde/.test(after));
  await shot("mat-ordered");

  await page.getByRole("button", { name: /Log ud/i }).first().click();
  await page.getByText("Vælg dit navn").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Ion/ }).first().click();
  await page.getByText(/Ion Zafier|Am ajuns|To-do/i).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const ion = await page.locator("body").innerText();
  console.log("ION_SNIP", ion.slice(0, 500).replace(/\n/g, " | "));
  console.log("ION_TODO", /Material comandat|Materiale bestilt|KC\s*50\/50\/700/.test(ion));
  console.log("ION_EFECTUAT", /Efectuat/.test(ion));
  await shot("mat-ion-todo");

  if (!/Efectuat/.test(ion)) {
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(400);
  }
  const ion2 = await page.locator("body").innerText();
  console.log("ION_TODO2", /Material comandat|Materiale bestilt/.test(ion2));
  const files = page.locator('input[type="file"]');
  console.log("ION_FILES", await files.count());
  const note = page.getByPlaceholder(/Ce se vede|Hvad viser/);
  if (await note.count()) await note.fill("Weber 700");
  if ((await files.count()) > 0) {
    await files.last().setInputFiles("/workspace/attachments/IMG_6275.jpg");
    await page.waitForTimeout(800);
  }
  if (await page.getByRole("button", { name: /Efectuat|Udført/ }).count()) {
    await page.getByRole("button", { name: /Efectuat|Udført/ }).first().click();
    await page.waitForTimeout(1500);
  }
  const done = await page.locator("body").innerText();
  console.log("ION_WARN", /Weber 700/.test(done) || /billedet viser/.test(done) || /Modtaget/.test(done));
  await shot("mat-ion-done");

  await page.getByRole("button", { name: /Ieșire|Log ud|Deconectare/i }).first().click();
  await page.getByText("Vælg dit navn").waitFor({ timeout: 15000 });
  await login("Ole");
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  const ole2 = await page.locator("body").innerText();
  console.log("OLE_MISMATCH", /Afvigelse|Weber 700|billedet viser/.test(ole2));
  await shot("mat-mismatch");

  const orderBtn = page.getByText(/Z-MAT-2026|KC\s*50\/50\/700/).first();
  if (await orderBtn.count()) {
    await orderBtn.click();
    await page.waitForTimeout(500);
    const view = await page.locator("body").innerText();
    console.log("KS_BTN", /KS-modtagelseskontrol/.test(view));
    await shot("mat-ks");
    const ks = page.getByRole("button", { name: /Lav KS-modtagelseskontrol/ });
    if (await ks.count()) {
      await ks.click();
      await page.waitForTimeout(600);
    }
  }

  console.log("QA_MATERIAL_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/mat-fail.png" });
} finally {
  await browser.close();
}
