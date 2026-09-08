import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function fresh() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 15000 });
}

async function login(name) {
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().waitFor({ timeout: 12000 });
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().click();
  await page.waitForTimeout(800);
}

async function logout() {
  const btn = page.getByRole("button", { name: /Ieșire|Log ud|Salir|Wyloguj|Log out/i }).first();
  if (await btn.count()) await btn.click();
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 12000 });
}

async function tapNav(label) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label, "i") }).click({ force: true });
  await page.waitForTimeout(400);
}

try {
  await fresh();

  await login("Ion");
  await tapNav("Chat");
  const ionChat = await page.locator("body").innerText();
  console.log("ION_RO_CHAT", /Chat nou|Galerie|Trimite|mesaje noi|Curăț|Văzut/i.test(ionChat));
  console.log("ION_NOT_DA_MIG", !/Ny chat/.test(ionChat));
  await shot("lang-ion-chat");
  await tapNav("Eu");
  const ionMe = await page.locator("body").innerText();
  console.log("ION_RO_ME", /Eu|Efectuat|Săptămână|Planul/i.test(ionMe));
  await shot("lang-ion-me");
  await logout();

  await login("Marius");
  await tapNav("Czat");
  const pl = await page.locator("body").innerText();
  console.log("MARIUS_PL", /Czat|Galeria|Wyślij|nowe wiadomości/i.test(pl));
  await shot("lang-marius-chat");
  await logout();

  await login("Osvaldo");
  await tapNav("Chat");
  const os = await page.locator("body").innerText();
  console.log("OSVALDO_ES", /Chat|Galería|Enviar|mensajes nuevos|Nuevo chat/i.test(os));
  await shot("lang-osvaldo-chat");
  await logout();

  await login("Alex");
  await tapNav("Chat");
  const alex = await page.locator("body").innerText();
  console.log("ALEX_DA", /Ny chat|Galleri|Send/i.test(alex));
  await shot("lang-alex-chat");
  await logout();

  await login("Federico");
  await page.getByRole("button", { name: /Tablón/i }).waitFor({ timeout: 12000 });
  const fe = await page.locator("body").innerText();
  console.log("FEDE_ES_BOARD", /Tablón|To-do|ER|TF|AS|KS|MA/i.test(fe));
  console.log("FEDE_PILES", (await page.locator("[data-testid^='board-pile-']").count()) === 6);
  await shot("lang-fede-board");
  await tapNav("Chat");
  const feChat = await page.locator("body").innerText();
  console.log("FEDE_ES_CHAT", /Nuevo chat|Abrir chat|mensajes nuevos|Chat/i.test(feChat));
  await shot("lang-fede-chat");
  await logout();

  await login("Ole");
  await page.getByText("Live tavle").waitFor({ timeout: 12000 });
  console.log("OLE_PILES", (await page.locator("[data-testid^='board-pile-']").count()) === 6);
  await shot("board-piles");
  await tapNav("Chat");
  const oleChat = await page.locator("body").innerText();
  console.log("OLE_DA_CHAT", /Ny chat|nye beskeder/i.test(oleChat));
  await shot("lang-ole-chat");

  const ionRow = page.getByRole("button").filter({ hasText: /mørtel|Mangler/i }).first();
  if (!(await ionRow.count())) {
    await page.getByRole("button").filter({ hasText: /Ion/i }).first().click({ force: true });
  } else {
    await ionRow.click({ force: true });
  }
  await page.waitForTimeout(500);
  const ksBtn = page.getByTestId("chat-class-ks");
  console.log("CLASS_KS", await ksBtn.count());
  if (await ksBtn.count()) {
    await ksBtn.click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /Tilbage|Back/i }).first().click();
  await page.waitForTimeout(300);
  await tapNav("Tavle");
  await page.waitForTimeout(400);
  const ksDot = page.getByTestId("board-dot-ks");
  console.log("BOARD_KS_DOT", (await ksDot.count()) > 0);
  await page.getByTestId("board-pile-ks").click();
  await page.waitForTimeout(400);
  const pile = await page.locator("body").innerText();
  console.log("BOARD_KS_LAND", /Fra chat|Z-KS|div|mørtel|Mangler|Islev/i.test(pile));
  await shot("board-ks-pile");

  const pileClose = page.getByTestId("sag-list-sheet").getByRole("button", { name: /Luk/i });
  if (await pileClose.count()) await pileClose.click({ force: true });
  await page.waitForTimeout(300);

  await tapNav("Sager");
  await page.waitForTimeout(500);
  const sagBtn = page.getByRole("button").filter({ hasText: /Islev/i }).first();
  if (await sagBtn.count()) await sagBtn.click();
  await page.waitForTimeout(400);
  const sagText = await page.locator("body").innerText();
  console.log("SAG_HAS_KS", /KS/.test(sagText));
  const ksOpen = page.locator("button").filter({ hasText: /KS/ }).first();
  if (await ksOpen.count()) await ksOpen.click({ force: true });
  await page.waitForTimeout(500);
  const sagKs = await page.locator("body").innerText();
  console.log("SAG_KS_FROM_CHAT", /Fra chat/i.test(sagKs));
  await shot("sag-ks-from-chat");

  const close = page.getByRole("button", { name: /Tilbage|Back|Luk/i }).first();
  if (await close.count()) await close.click({ force: true });
  await page.waitForTimeout(300);

  await tapNav("Chat");
  await page.getByRole("button", { name: /Ny chat/i }).click();
  await page.getByRole("button", { name: /^Alex$/ }).click();
  await page.locator("input").last().fill("Husk billeder i kælderen");
  await page.getByRole("button", { name: /^To-do$/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Tilbage/i }).first().click();
  await tapNav("Tavle");
  await page.getByTestId("board-pile-todo").click();
  await page.waitForTimeout(400);
  const todoPile = await page.locator("body").innerText();
  console.log("TODO_FROM_CHAT", /Husk billeder|Fra chat|Alex/i.test(todoPile));
  await shot("board-todo-from-chat");
} catch (e) {
  console.log("FAIL", e.message);
  await shot("lang-board-fail");
} finally {
  await browser.close();
}
