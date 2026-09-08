import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alex/ }).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.getByText(/Jeg er mødt|Mødt|I dag/i).first().waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Sag", exact: true }).click();
  await page.waitForTimeout(400);
  const sag = await page.locator("body").innerText();
  console.log("CREW_HAS_NEW_JOB", /Ny sag/.test(sag));
  await shot("crew-sag-new");

  await page.getByRole("button", { name: "Ny sag" }).first().click();
  await page.waitForTimeout(300);
  const form = await page.locator("body").innerText();
  console.log("CREW_FORM_NAME", /Navn|sag/i.test(form));
  console.log("CREW_FORM_NO_CLIENT", !/Bygherre/.test(form) || /Kun navn/.test(form));
  console.log("CREW_FORM_HINT", /Alle på holdet|adgang/.test(form));
  await shot("crew-new-job-form");

  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.waitForTimeout(400);
  const chat = await page.locator("body").innerText();
  console.log("CHAT_PICK", /Vælg 1 eller flere/.test(chat));
  console.log("CHAT_MESTER", /Mester/.test(chat));
  console.log("CHAT_ON_JOB", /Alle på sagen/.test(chat));
  console.log("CHAT_ION", /Ion/.test(chat));
  console.log("CHAT_MARIUS", /Marius/.test(chat));
  await shot("crew-chat-multi");

  await page.getByRole("button", { name: /Ion/ }).first().click();
  await page.getByRole("button", { name: /Marius/ }).first().click();
  await page.waitForTimeout(200);
  await shot("crew-chat-picked");

  await page.getByRole("button", { name: /Log ud/i }).first().click();
  await page.getByRole("button", { name: /Ole/ }).first().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Ny sag" }).first().click();
  await page.waitForTimeout(200);
  const masterForm = await page.locator("body").innerText();
  console.log("MASTER_OPEN_TO_ALL", /Alle har adgang/.test(masterForm));
  await shot("master-new-job");

  console.log("QA_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/chat-todo-fail.png" });
} finally {
  await browser.close();
}
