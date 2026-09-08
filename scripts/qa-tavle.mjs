import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function login(name, pin) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  for (const d of pin.split("")) {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
}

try {
  await login("Ole", "7777");
  await page.getByText("Live tavle").waitFor({ timeout: 12000 });
  const board = await page.locator("body").innerText();
  console.log("BOARD_MANDSKAB", /Mandskab|MANDSKAB|mødt|ikke mødt/i.test(board));
  console.log("BOARD_WORKING", /Working field|WORKING FIELD/i.test(board));
  console.log("BOARD_BRIEF", /Brief|BRIEF/i.test(board));
  console.log("BOARD_MARIUS", /Marius|stål|steel|żelaz/i.test(board));
  await shot("qa-tavle");
  await page.evaluate(() => window.scrollTo(0, 700));
  await shot("qa-tavle-brief");

  await login("Osvaldo", "5555");
  await page.getByRole("button", { name: /He llegado al trabajo|Jeg er mødt på job/ }).waitFor({ timeout: 12000 });
  const today = await page.locator("body").innerText();
  console.log("SVEND_TODO_OPRYD", /Opryd|blok A/.test(today));
  console.log("SVEND_TODO_15", /kl\.\s*15|tandlæge|tandlaege/i.test(today));
  console.log("SVEND_DONE_BTN", /Udførte to-do|To-do hechos/i.test(today));
  await shot("qa-osvaldo-today");

  await page.getByRole("button", { name: "Obra" }).click();
  await page.getByText(/Sag-bot|Bot de obra/i).waitFor({ timeout: 10000 });
  const sag = await page.locator("body").innerText();
  console.log("SVEND_SAG_NAME", sag.includes("Hillerødsholm") || sag.includes("Kærhuset"));
  console.log("SVEND_NO_FOLDERS", !/Mapper|Udbudsmateriale|Aftaleseddel/.test(sag));
  console.log("SVEND_SAG_BOT", /Sag-bot|Bot de obra/i.test(sag));
  await shot("qa-osvaldo-sag");

  await page.getByRole("button", { name: /Anclajes|Bindere/ }).click();
  await page.getByText(/Kigger i udbuddet|4 stk|6 stk|binder/i).waitFor({ timeout: 28000 });
  const bot = await page.locator("body").innerText();
  console.log("SVEND_BINDER", /4|6|binder/i.test(bot));
  await shot("qa-osvaldo-binder");

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("qa-tavle-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
