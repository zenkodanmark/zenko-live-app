import { chromium } from "playwright";

const MSG = "";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);

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
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.waitForTimeout(250);
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
    await page.waitForTimeout(120);
  }
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Sager", exact: true }).click();
  await page.getByRole("heading", { name: "Sager" }).waitFor();
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await page.waitForTimeout(300);
  await shot("sager-merged");
  const sager = await page.locator("body").innerText();
  const hasStrandChip = /Strandvejen 84/.test(sager) && !/Prøvestenen/.test(sager);
  console.log("HAS_PROVE", /Prøvestenen/.test(sager));
  console.log("HAS_KAER", /Kærhuset/.test(sager));
  console.log("HAS_STRAND_AS_OWN", /\bStrandvejen 84\b/.test(sager) && sager.includes("Strandvejen 84") && !sager.includes("Prøvestenen"));
  console.log("HAS_RUSKAER_CHIP", /Ruskær 35/.test(sager));
  console.log("HAS_STRAND_TEXT", /Strandvejen 84/.test(sager));

  await page.getByRole("button", { name: /Prøvestenen/ }).first().click();
  await page.waitForTimeout(250);
  await shot("sag-provestenen");
  const prove = await page.locator("body").innerText();
  console.log("PROVE_ADDR", /Strandvejen 84/.test(prove));

  await page.getByRole("button", { name: "Rapporter", exact: true }).click();
  await page.getByRole("button", { name: /Løn|Dataløn|Export/i }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  const lonBtn = page.getByRole("button", { name: /løn/i });
  if (await lonBtn.count()) await lonBtn.first().click();
  await page.waitForTimeout(300);
  await shot("reports-lon-merged");
  const lon = await page.locator("body").innerText();
  console.log("LON_PROVE", /Prøvestenen/.test(lon));
  console.log("LON_KAER", /Kærhuset/.test(lon));
  console.log("LON_STRAND_OWN", /Strandvejen 84/.test(lon) && !/Prøvestenen/.test(lon));
  console.log("LON_RUSKAER", /Ruskær 35/.test(lon));

  if (!/Prøvestenen/.test(sager) || !/Kærhuset/.test(sager)) throw new Error("missing canonical sager");
  if (/Ruskær 35/.test(sager)) throw new Error("Ruskær still listed as own sag");
  // Strandvejen 84 may appear as address on Prøvestenen — not as its own chip name in Alle list
  const jobCards = await page.evaluate(() => {
    return [...document.querySelectorAll("li,button")].map((n) => n.textContent?.trim() ?? "").filter(Boolean);
  });
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("merge-sager-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
