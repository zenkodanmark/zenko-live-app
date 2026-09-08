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

  await login("Ion");
  const today = await page.locator("body").innerText();
  console.log("ION_UDFORT", /Udført/.test(today));
  console.log("ION_EFECTUAT", /Efectuat/.test(today));
  console.log("ION_TODO_AZI", /To-do azi/.test(today));
  console.log("ION_START", /Am ajuns la muncă/.test(today) || /Pe șantier/.test(today) || /Azi/.test(today));
  console.log("ION_HILLEROED", /Hillerødsholm/.test(today));
  await shot("lang-ion-today");

  await page.getByRole("button", { name: "Chat" }).click();
  await page.waitForTimeout(500);
  const chat = await page.locator("body").innerText();
  console.log("ION_CHAT_RO", /Am curățat spatele/.test(chat));
  console.log("ION_CHAT_DA_BODY", /Jeg har ryddet/.test(chat));
  console.log("ION_REMOVE", /Șterge chatul/.test(chat));
  console.log("ION_ARKIV", /Arkivér/.test(chat) || /\bArkiv\b/.test(chat));
  console.log("ION_ORIGINAL", /Original/.test(chat));
  await shot("lang-ion-chat");

  await page.getByRole("button", { name: "Eu" }).click();
  await page.waitForTimeout(300);
  const me = await page.locator("body").innerText();
  console.log("ION_ME_LIMBA", /Limbă/.test(me));
  console.log("ION_ME_DONE", /Efectuat/.test(me));
  console.log("ION_ME_UDFORT", /Udført/.test(me));
  await shot("lang-ion-me");

  await page.getByRole("button", { name: /Ieșire|Deconectare/ }).first().click();
  await page.waitForTimeout(400);

  await login("Ole");
  await page.getByRole("button", { name: "Chat" }).click();
  await page.waitForTimeout(500);
  const oleChat = await page.locator("body").innerText();
  console.log("OLE_DA", /Jeg har ryddet bag skuret/.test(oleChat) || /Set\. Jeg gør det færdigt/.test(oleChat));
  console.log("OLE_ORIGINAL_LINK", /Original/.test(oleChat));
  console.log("OLE_ARKIV", /Arkiv/.test(oleChat));
  console.log("OLE_REMOVE_RO", /Șterge chatul/.test(oleChat));
  await shot("lang-ole-chat");

  console.log("QA_LANG_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/lang-fail.png" });
} finally {
  await browser.close();
}
