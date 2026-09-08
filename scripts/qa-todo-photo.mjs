import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByText("Vælg dit navn").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Alex/ }).first().click();
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  console.log("CREW_CAMERA", /Kamera/.test(body));
  console.log("CREW_GALLERY", /Galleri/.test(body));
  console.log("CREW_UDFOERT", /Udført/.test(body));
  console.log("CREW_SNIP", body.slice(0, 400).replace(/\n/g, " | "));
  await page.screenshot({ path: "/workspace/screenshots/todo-crew-photo.png" });

  await page.getByRole("button", { name: /Log ud/i }).first().click();
  await page.getByText("Vælg dit navn").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByText(/Hillerødsholm/i).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /To-do/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Opret ny/i }).first().click();
  await page.waitForTimeout(400);
  const compose = await page.locator("body").innerText();
  console.log("COMPOSE_CAMERA", /Kamera/.test(compose));
  console.log("COMPOSE_GALLERY", /Galleri/.test(compose));
  await page.screenshot({ path: "/workspace/screenshots/todo-master-compose.png" });
  console.log("QA_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/todo-photo-fail.png" });
} finally {
  await browser.close();
}
