import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(25000);

function log(label, value) {
  console.log(label, value);
}

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

try {
  await page.goto("http://127.0.0.1:8080/sag/islevvaenge/ks", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("islev-ks-list");
  const listText = await page.locator("body").innerText();
  const rowCount = await page.locator('[data-testid^="ledelse-row-"]').count();
  log("KS_LIST_ROWS", rowCount);
  log("KS_LIST_EMPTY", /Ingen KS-rapporter/i.test(listText));
  log("KS_LIST_NO_TWELVE", !/\b12\b/.test(listText) || /Ingen KS-rapporter/i.test(listText));
  log("KS_LIST_NO_DUMMY_NRS", !/\bKS-89\b/.test(listText) && !/\bKS-110\b/.test(listText));

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (await page.getByTestId("login-emp-ole").count()) {
    await page.getByTestId("login-emp-ole").click();
    await page.getByTestId("pin-pad").waitFor();
    for (const d of "7777") await page.getByTestId(`pin-${d}`).click();
    await page.getByTestId("todo-open-board").waitFor({ timeout: 15000 });
  }
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Islevvænge/i }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 12000 });
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(400);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  const pin = (clip.match(/Kode:\s*(\d{4})/) || [])[1] || (await page.getByTestId("ledelse-pin-field").inputValue());
  log("ISLEV_PIN", pin.length === 4 ? "yes" : "no");

  await page.goto("http://127.0.0.1:8080/sag/islevvaenge", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if ((await page.getByTestId("sag-pin-gate").count()) && pin.length === 4) {
    await page.getByTestId("sag-pin-input").fill(pin);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("ledelse-types").waitFor({ timeout: 10000 });
  await shot("islev-ledelse-home");
  const home = await page.locator("body").innerText();
  const ksBtn = page.getByTestId("ledelse-btn-ks");
  const ksCount = await ksBtn.count();
  log("HOME_KS_CARD", ksCount);
  if (ksCount) {
    const n = (await ksBtn.innerText()).match(/(\d+)\s*$/m)?.[1] || "";
    log("HOME_KS_COUNT", n);
    log("HOME_KS_ZERO", n === "0" || /Ingen endnu/.test(await ksBtn.innerText()));
    log("HOME_KS_NOT_12", n !== "12");
  } else {
    log("HOME_KS_ZERO", true);
    log("HOME_KS_NOT_12", true);
  }
  log("HOME_HAS_TF", await page.getByTestId("ledelse-btn-tf").count());
  log("HOME_HAS_AS", await page.getByTestId("ledelse-btn-as").count());
  log("HOME_HAS_TODO", await page.getByTestId("ledelse-btn-todo").count());
  log("HOME_NO_DUMMY_NRS", !/KS-89|KS-110/.test(home));

  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("ks-ledelse-count-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 1800));
  process.exitCode = 1;
} finally {
  await browser.close();
}
