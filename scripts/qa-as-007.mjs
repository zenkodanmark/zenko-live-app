import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const shots = "/workspace/screenshots";

function snip(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .slice(0, 280);
}

async function shot(page, name) {
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
  console.log("shot", name);
}

try {
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await guest.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  await page.goto("http://127.0.0.1:8080/r/as/Z-AS-2026-007", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  const missing = /Rapporten findes ikke/.test(body);
  const login = /Pinkode|Mød ind på pladsen|Live tavle/i.test(body);
  const heading = /Aftaleseddel nr:\s*Z-AS-2026-007/.test(body);
  const price = /255\.810/.test(body);
  const cards = /TIL[\s\S]{0,40}DATO/.test(body) && /shadow-card/.test(await page.content()) && (await page.locator("dt").count()) >= 4;
  const firm = /ZENKO DANMARK/.test(body) && /42285757/.test(body);
  console.log("R_AS_007", { missing, login, heading, price, firm, snippet: snip(body) });
  await shot(page, "r-as-007");
  if (missing) throw new Error("/r/as/007 missing");
  if (login) throw new Error("/r/as/007 asked login");
  if (!heading) throw new Error("/r/as/007 missing A4 heading");
  if (!price) throw new Error("/r/as/007 missing 255.810");
  if (!firm) throw new Error("/r/as/007 missing firm");

  await page.goto("http://127.0.0.1:8080/r/as/399", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const b399 = await page.locator("body").innerText();
  console.log("R_AS_399", { ok: /Aftaleseddel/.test(b399), missing: /findes ikke/.test(b399), snippet: snip(b399) });
  if (/Rapporten findes ikke/.test(b399) || !/Aftaleseddel/.test(b399)) throw new Error("bundled 399 broken");
  await shot(page, "r-as-399");

  await page.goto("http://127.0.0.1:8080/r/tf/396", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const btf = await page.locator("body").innerText();
  console.log("R_TF_396", { ok: /Teknisk forespørgsel/.test(btf) || /396/.test(btf), missing: /findes ikke/.test(btf), snippet: snip(btf) });
  if (/Rapporten findes ikke/.test(btf)) throw new Error("tf 396 missing");
  await shot(page, "r-tf-396");
  await guest.close();

  const sagCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sag = await sagCtx.newPage();
  sag.setDefaultTimeout(25000);
  await sag.goto("http://127.0.0.1:8080/sag/hilleroedsholm/as/Z-AS-2026-007", { waitUntil: "networkidle" });
  await sag.waitForTimeout(800);
  if (await sag.getByTestId("sag-pin-input").count()) {
    await sag.getByTestId("sag-pin-input").fill("4000");
    await sag.waitForTimeout(400);
  }
  if (await sag.getByTestId("sag-pin-gate").count()) {
    for (const d of "4000") {
      const btn = sag.getByTestId(`sag-pin-${d}`);
      const box = await btn.boundingBox();
      if (box) await sag.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      else await btn.click();
    }
    await sag.waitForTimeout(500);
  }
  await sag.waitForTimeout(2500);
  const sbody = await sag.locator("body").innerText();
  const pinLeft = (await sag.getByTestId("sag-pin-gate").count()) > 0;
  const a4 = /Aftaleseddel nr:\s*Z-AS-2026-007/.test(sbody);
  const pdf = (await sag.getByTestId("as-save-pdf").count()) > 0 || /Gem som PDF/.test(sbody);
  const price2 = /255\.810/.test(sbody);
  const fourCards = (await sag.locator("dt").filter({ hasText: /^(Til|Dato|Byggesag|Lokation)$/i }).count()) >= 4;
  console.log("SAG_AS_007", { pinLeft, a4, pdf, price2, fourCards, snippet: snip(sbody) });
  await shot(sag, "sag-as-007");
  if (pinLeft) throw new Error("PIN still up");
  if (!a4) throw new Error("sag 007 not A4");
  if (!pdf) throw new Error("missing PDF button");
  if (!price2) throw new Error("sag 007 missing 255.810");
  if (fourCards) throw new Error("still four small cards");

  let printed = false;
  sag.once("dialog", (d) => d.dismiss().catch(() => {}));
  await sag.evaluate(() => {
    window.__printed = false;
    window.print = () => {
      window.__printed = true;
    };
  });
  await sag.getByTestId("as-save-pdf").click();
  printed = await sag.evaluate(() => window.__printed === true);
  console.log("PDF_CLICK", { printed });
  if (!printed) throw new Error("PDF button did not print");

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
