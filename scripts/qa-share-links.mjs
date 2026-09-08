import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300));
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

function noPin(text) {
  return !/Pinkode|Mød ind på pladsen|Live tavle|Chatbot/i.test(text);
}

try {
  const guests = [
    { path: "/r/ks/52", name: "r-ks-52", expect: /Proceskontrol/i, photo: /\/ks\/softr\/52\// },
    { path: "/r/as/399", name: "r-as-399", expect: /Aftaleseddel/i, photo: /\/as\/softr\/399\// },
    { path: "/r/tf/12", name: "r-tf-12", expect: /Teknisk forespørgsel/i, photo: /\/as\/softr\/12\// },
    { path: "/r/er/5", name: "r-er-5", expect: /Entreprenørrapport/i, photo: /\/as\/softr\/5\// },
  ];

  for (const g of guests) {
    await page.goto(`http://127.0.0.1:8080${g.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const body = await page.locator("body").innerText();
    const html = await page.content();
    const okTitle = g.expect.test(body);
    const okPhoto = g.photo.test(html);
    const hung = /Henter rapporten/.test(body) && !okTitle;
    const pin = !noPin(body);
    console.log(g.path, { okTitle, okPhoto, hung, pin, snippet: body.replace(/\s+/g, " ").slice(0, 180) });
    if (!okTitle) throw new Error(`${g.path} missing title`);
    if (hung) throw new Error(`${g.path} hung`);
    if (pin) throw new Error(`${g.path} showed PIN/board`);
    await shot(g.name);
  }

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  for (const d of "7777") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Rapporter" }).click();
  await page.getByRole("button", { name: /Proceskontrol|KS/ }).first().click();
  await page.getByText(/Nr\. 52/).first().waitFor({ timeout: 10000 });
  const ksRow = page.locator("div").filter({ hasText: /^Nr\. 52/ }).first();
  const copyBtn = page.getByRole("button", { name: "Kopiér link" }).filter({ has: page.locator("xpath=ancestor::div[contains(., 'Nr. 52')]") }).first();
  // fallback: click the chip next to Nr. 52
  const chip = page.locator("div.flex").filter({ hasText: "Nr. 52" }).getByRole("button", { name: "Kopiér link" }).first();
  await chip.click();
  await page.waitForTimeout(500);
  let clip = "";
  try {
    clip = await page.evaluate(() => navigator.clipboard.readText());
  } catch (e) {
    clip = `CLIP_FAIL:${e.message}`;
  }
  const shareAttr = await chip.getAttribute("data-share-url");
  const toast = await page.locator("body").innerText();
  console.log("COPY", { clip, shareAttr, toastHasR: /\/r\/ks\/52/.test(toast + clip + (shareAttr || "")) });
  await shot("ks-52-copy");
  const url = clip.startsWith("http") ? clip : shareAttr || "";
  if (!/\/r\/ks\/52(?:$|[?#])/.test(url) && !/\/r\/ks\/52/.test(toast)) {
    throw new Error(`copy did not produce /r/ks/52 got clip=${clip} attr=${shareAttr}`);
  }
  if (/\/mester/.test(url) || /#ksr/.test(url)) throw new Error(`copy still mester hash: ${url}`);

  const guest = await context.newPage();
  await guest.goto(url.startsWith("http") ? url : `http://127.0.0.1:8080/r/ks/52`, { waitUntil: "networkidle" });
  const gbody = await guest.locator("body").innerText();
  console.log("GUEST_AFTER_COPY", gbody.replace(/\s+/g, " ").slice(0, 200));
  if (!/Proceskontrol/.test(gbody)) throw new Error("guest after copy missing report");
  if (/Pinkode|Mød ind/.test(gbody)) throw new Error("guest after copy asked for PIN");
  await guest.screenshot({ path: "/workspace/screenshots/r-ks-52-after-copy.png" });
  await guest.close();

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("share-links-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
