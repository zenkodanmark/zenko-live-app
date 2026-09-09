import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  if (await page.getByTestId("login-emp-ole").count()) {
    await page.getByTestId("login-emp-ole").click();
    for (const d of "7777") {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
  }
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
}

async function openHillTfList() {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  const hill = page.getByRole("button", { name: /Hillerødsholm/i }).first();
  if (await hill.count()) await hill.click();
  await page.getByTestId("sag-row-tf").waitFor({ timeout: 10000 });
  await page.getByTestId("sag-row-tf").click();
  await page.getByTestId("sag-list-sheet").waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
}

function hak(number) {
  return page.getByTestId(`ledelse-hak-${number}`);
}

let target = "Z-TF-2026-005";

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await loginOle();
  await openHillTfList();
  await shot("tf-ledelse-list");

  const listText = await page.getByTestId("sag-list-sheet").innerText();
  const has007 = /Z-TF-2026-007/.test(listText);
  target = has007 ? "Z-TF-2026-007" : "Z-TF-2026-005";
  console.log("TARGET", target, "HAS_007", has007);

  const btn = hak(target);
  await btn.waitFor({ timeout: 8000 });
  if ((await btn.getAttribute("data-ledelse")) === "on") await btn.click();
  await page.waitForTimeout(200);
  await btn.click();
  await page.waitForTimeout(2000);
  const onNow = await btn.getAttribute("data-ledelse");
  const onClass = await btn.getAttribute("class");
  console.log("HAK_ON", onNow);
  console.log("HAK_GREEN", /bg-moss/.test(onClass || ""));
  console.log("HAK_006_ON", await hak("Z-TF-2026-006").getAttribute("data-ledelse"));
  await shot("tf-ledelse-on");

  const share = page.locator('[data-testid="sag-list-sheet"] li', { hasText: target }).getByRole("button", { name: /Kopiér link/i });
  if (await share.count()) {
    await share.click();
    await page.waitForTimeout(500);
    const url = await share.getAttribute("data-share-url");
    console.log("COPY_URL", url);
    console.log("COPY_LIVE", /zenkodanmark\.github\.io/.test(url || ""));
    console.log("COPY_NOT_PREVIEW", !/preview|grok\.me|localhost|127\.0\.0\.1/.test(url || ""));
  } else {
    console.log("COPY_LIVE", false);
  }

  await page.reload({ waitUntil: "networkidle" });
  await openHillTfList();
  console.log("HAK_AFTER_RELOAD", await hak(target).getAttribute("data-ledelse"));
  console.log("HAK_006_AFTER_RELOAD", await hak("Z-TF-2026-006").getAttribute("data-ledelse"));
  await shot("tf-ledelse-after-reload");

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const home = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("UDF_COUNTER", (home.match(/\d+\s+åben(?:e)?/) || [])[0] || "");
  console.log("UDF_HAS_SECTION", home.includes("Tekniske forespørgsler"));
  await shot("tf-ledelse-udfoersel");

  await page.getByRole("link", { name: /Tekniske forespørgsler/i }).click();
  await page.waitForTimeout(800);
  const tfList = await page.locator("body").innerText();
  console.log("UDF_LIST_TARGET", tfList.includes(target));
  console.log("UDF_LIST_006", tfList.includes("Z-TF-2026-006"));
  await shot("tf-ledelse-udfoersel-tf");

  await openHillTfList();
  await hak(target).click();
  await page.waitForTimeout(2000);
  console.log("HAK_OFF", await hak(target).getAttribute("data-ledelse"));
  console.log("HAK_006_STILL", await hak("Z-TF-2026-006").getAttribute("data-ledelse"));
  const offClass = await hak(target).getAttribute("class");
  console.log("HAK_WHITE", /bg-paper/.test(offClass || ""));
  await shot("tf-ledelse-off");

  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm/tf", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const afterOff = await page.locator("body").innerText();
  console.log("UDF_GONE_AFTER_OFF", !afterOff.includes(target));
  console.log("UDF_006_STILL_ON_LIST", afterOff.includes("Z-TF-2026-006"));
  await page.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const homeOff = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("UDF_COUNTER_AFTER_OFF", (homeOff.match(/\d+\s+åben(?:e)?/) || [])[0] || "");
  await shot("tf-ledelse-udfoersel-off");
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("tf-ledelse-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  try {
    await openHillTfList();
    const btn = hak(target);
    if ((await btn.count()) && (await btn.getAttribute("data-ledelse")) === "on" && target !== "Z-TF-2026-006") {
      await btn.click();
      await page.waitForTimeout(400);
      console.log("CLEANUP_OFF", await btn.getAttribute("data-ledelse"));
    }
  } catch (e) {
    console.log("CLEANUP_SKIP", String(e).slice(0, 120));
  }
  await browser.close();
}
