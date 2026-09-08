import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

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
  await shot("login-unfrozen");
  const body = await page.locator("body").innerText();
  console.log("LOGIN_BODY", body.slice(0, 400).replace(/\n/g, " | "));
  console.log("HAS_OLE", body.includes("Ole"));
  console.log("HAS_PIN", /PIN/.test(body));

  await page.getByRole("button", { name: /Ole/ }).first().click();
  await shot("login-pin");
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await shot("login-mester");
  console.log("LOGGED_IN", true);

  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByText(/Teknisk forespørgsel/i).waitFor({ timeout: 10000 });
  await shot("sager-after-login");
  const sag = await page.locator("body").innerText();
  console.log("HAS_TF006_CARD", sag.includes("Z-TF-2026-006") || sag.includes("Altanbæringer"));

  await page.getByRole("button", { name: /Åbn alle/, exact: false }).nth(1).click();
  const row = page.getByRole("button", { name: "Z-TF-2026-006 · Altanbæringer — udsparing i mur under dør", exact: true });
  await row.waitFor({ timeout: 8000 });
  await shot("tf-list");
  await row.click();
  await page.getByText("Teknisk Forespørgsel Nr").waitFor({ timeout: 8000 });
  await shot("tf-006");
  const doc = await page.locator("body").innerText();
  console.log("HAS_SKETCH_TEXT", doc.includes("340") && doc.includes("356"));
  console.log("HAS_APPROVAL", /Vi hugger ikke|skriftlig godkendelse/i.test(doc));
  const img = page.locator('img[src*="altan-baeringer"]');
  console.log("HAS_IMG", await img.count());
  await page.evaluate(() => window.scrollTo(0, 1600));
  await shot("tf-006-photo");

  // also verify Osvaldo login
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Osvaldo/ }).first().click();
  for (const d of "5555") {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await page.getByRole("button", { name: /He llegado al trabajo|Jeg er mødt på job/ }).waitFor({ timeout: 12000 });
  await shot("login-osvaldo");
  console.log("OSVALDO_OK", true);
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("login-tf-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
