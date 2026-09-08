import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function tapNav(label) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label) }).click();
  await page.waitForTimeout(400);
}

async function fresh() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

try {
  await fresh();
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  await tapNav("Chat");
  const list = await page.locator("body").innerText();
  console.log("CHAT_NY", /Ny chat/.test(list));
  console.log("CHAT_ACTIVE", /aktive chat/i.test(list));
  console.log("CHAT_SAVED", /gemte chat/i.test(list));
  console.log("CHAT_NO_TRAAD_WORD", !/Gemte tråde/.test(list) && !/Gem som tråd/.test(list));
  console.log("CHAT_NO_GPS_LIST", !/55\.\d+,\s*12\.\d+/.test(list));
  await shot("rett2-chat-list");

  await page.getByRole("button", { name: /Ny chat/ }).first().click();
  await page.waitForTimeout(400);
  const ny = await page.locator("body").innerText();
  console.log("CHAT_EMPTY_HINT", /Tryk navne|starter tom/.test(ny));
  console.log("CHAT_SELF_CHIP", /Ole/.test(ny) && /Federico/.test(ny) && /Alex/.test(ny));
  console.log("CHAT_NO_MESTER_CHIP", (await page.locator("button", { hasText: /^Mester$/ }).count()) === 0);
  const fedeBtn = page.getByRole("button", { name: /^Federico$/ });
  const fedeClass = (await fedeBtn.first().getAttribute("class")) || "";
  console.log("CHAT_FEDERICO_UNSELECTED", !/bg-sand text-navy/.test(fedeClass) && !/bg-navy/.test(fedeClass));
  await shot("rett2-chat-empty");

  await fedeBtn.first().click();
  await page.getByPlaceholder(/husk|regntøj|tråden/i).fill("Svar i tråden med foto");
  await page.locator('button[aria-label="Send"]').click({ force: true });
  await page.waitForTimeout(800);
  const afterSend = await page.locator("body").innerText();
  console.log("CHAT_THREAD", /Svar i tråden med foto/.test(afterSend));
  console.log("CHAT_GEM", /Gem chat/.test(afterSend));
  console.log("CHAT_FJERN", /Fjern chat/.test(afterSend));
  console.log("CHAT_NO_ARKIV", !/Arkivér|Arkiv\b/.test(afterSend));
  console.log("CHAT_NO_GPS_THREAD", !/55\.\d+/.test(afterSend));
  console.log("CHAT_REPLY_PH", (await page.getByPlaceholder(/Svar i tråden/i).count()) > 0);
  await shot("rett2-chat-thread");

  await page.getByRole("button", { name: /Gem chat/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Tilbage/ }).first().click();
  await page.waitForTimeout(400);
  const afterSave = await page.locator("body").innerText();
  console.log("CHAT_SAVED_HAS_NAMES", /Federico/.test(afterSave) || /Ole/.test(afterSave));
  await shot("rett2-chat-saved");

  await tapNav("Tavle");
  const tavle = await page.locator("body").innerText();
  console.log("TODO_OPEN_CARD", /ikke udført to-do/i.test(tavle));
  await page.getByText(/Ikke udført to-do/i).first().click();
  await page.waitForTimeout(500);
  const openList = await page.locator("body").innerText();
  console.log("TODO_LIST", /to-do|To-do/i.test(openList));
  const sheet = page.locator("div.fixed.inset-0").filter({ hasText: /ikke udført/i }).last();
  await sheet.locator("ul button").first().click({ force: true });
  await page.waitForTimeout(500);
  const report = await page.locator("body").innerText();
  console.log("TODO_REPORT", /Zenko Danmark/i.test(report) && /To-do/.test(report));
  console.log("TODO_UDFORT", /Udført/.test(report));
  console.log("TODO_FOTO_BTN", /Tilføj billede/.test(report));
  console.log("TODO_SVAR", /Svar/.test(report));
  await shot("rett2-todo-report");

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.waitForTimeout(800);
  const today = await page.locator("body").innerText();
  console.log("CREW_HEADING_ONLY", /to-do i dag/i.test(today));
  const gpsOnToday = /55\.9298/.test(today) || /maps\.google\.com/.test(today);
  console.log("CREW_NO_GPS", !gpsOnToday);
  await tapNav("Chat");
  await page.getByRole("button", { name: /Ny chat/ }).first().click();
  await page.waitForTimeout(300);
  const alexChat = await page.locator("body").innerText();
  console.log("SELF_CHIP_ALEX", /Alex/.test(alexChat));
  await page.getByRole("button", { name: /^Alex$/ }).first().click();
  await page.getByPlaceholder(/husk|regntøj|tråden|Fx/i).fill("ryd bag skur");
  await page.getByRole("button", { name: /^To-do$/ }).click({ force: true });
  await page.waitForTimeout(800);
  await shot("rett2-self-todo");
  await page.getByRole("button", { name: /Tilbage/ }).first().click().catch(() => {});
  await tapNav("I dag");
  await page.waitForTimeout(400);
  const afterTodo = await page.locator("body").innerText();
  console.log("SELF_TODO_LIST", /ryd bag skur/i.test(afterTodo));
  await shot("rett2-alex-today");

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await tapNav("Sager");
  await page.waitForTimeout(400);
  const islev = page.getByRole("button", { name: /Islev/i }).first();
  if (await islev.count()) await islev.click();
  await page.waitForTimeout(500);
  const sag = await page.locator("body").innerText();
  console.log("SAG_MATERIALE", /Materiale/.test(sag));
  const matBtn = page.locator("button").filter({ hasText: /^Materiale/ }).first();
  if (await matBtn.count()) {
    await matBtn.click({ force: true });
    await page.waitForTimeout(700);
  }
  const board = page.locator("div.fixed.inset-0").last();
  const needBtn = board.locator("button").filter({ hasText: /mørtel|mangler|Ion|Materiale/i }).first();
  if (await needBtn.count()) {
    await needBtn.click({ force: true });
    await page.waitForTimeout(600);
  }
  const order = await page.locator("body").innerText();
  console.log("MAT_ADD_LINE", /Tilføj linje/.test(order) || /Linjer/.test(order));
  await shot("rett2-materiale");
} catch (err) {
  console.log("FAIL", err.message);
  await shot("rett2-fail");
} finally {
  await browser.close();
}
