import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 240));
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
  await page.getByRole("button", { name: /Ole/ }).first().click();
  for (const d of "7777") {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByTestId("sag-row-todo").waitFor({ timeout: 10000 });
  await shot("sager-ud-rows");

  const body = await page.locator("body").innerText();
  const opretNyOnRows = await page.locator("button", { hasText: /^Opret ny$/ }).count();
  console.log(JSON.stringify({
    hasTodo: await page.getByTestId("sag-row-todo").count(),
    hasMa: await page.getByTestId("sag-row-material").count(),
    hasUd: await page.getByTestId("sag-row-ud").count(),
    hasKs: await page.getByTestId("sag-row-ks").count(),
    hasTf: await page.getByTestId("sag-row-tf").count(),
    hasAs: await page.getByTestId("sag-row-slip").count(),
    hasEr: await page.getByTestId("sag-row-ent").count(),
    plusTodo: await page.getByTestId("sag-plus-todo").count(),
    plusMa: await page.getByTestId("sag-plus-material").count(),
    plusUd: await page.getByTestId("sag-plus-ud").count(),
    plusAs: await page.getByTestId("sag-plus-slip").count(),
    plusEr: await page.getByTestId("sag-plus-ent").count(),
    opretNyVisible: body.includes("Opret ny"),
    opretNyButtons: opretNyOnRows,
    udLabel: /\bUD\b/.test(body),
    kundeOpenGone: !body.includes("Åbn kundeside"),
    copyGone: !body.includes("Kopiér links"),
    scanGone: !body.includes("Scan udbud"),
    aflevering: body.includes("Aflevering"),
    udfoersel: body.includes("Udførsel"),
    kundeAflevering: await page.getByTestId("kunde-aflevering").count(),
    kundeUdfoersel: await page.getByTestId("kunde-udfoersel").count(),
    kundeHref: await page.getByTestId("kunde-aflevering").getAttribute("href"),
    sagHref: await page.getByTestId("kunde-udfoersel").getAttribute("href"),
  }, null, 2));

  await page.getByTestId("sag-row-ud").click();
  await page.getByTestId("ud-folder-plads").waitFor({ timeout: 8000 });
  await shot("sager-ud-sheet");
  const sheet = await page.locator("body").innerText();
  console.log(JSON.stringify({
    plads: sheet.includes("Pladsfiler") && sheet.includes("11 Pladsfiler"),
    erfaring: sheet.includes("Erfaring") && sheet.includes("12 Erfaring"),
    dags: sheet.includes("Dagsrapport") && sheet.includes("13 Dagsrapport"),
    plusOnSheet: await page.getByTestId("sag-plus-ud-sheet").count(),
  }, null, 2));

  await page.getByTestId("sag-plus-ud-sheet").click();
  await page.getByTestId("ud-pick").waitFor({ timeout: 5000 });
  await shot("sager-ud-pick");
  const pick = await page.locator("[data-testid=ud-pick]").innerText();
  console.log(JSON.stringify({
    pickPlads: pick.includes("Pladsfiler"),
    pickErfaring: pick.includes("Erfaring"),
    pickDags: pick.includes("Dagsrapport"),
    three: (await page.getByTestId("ud-pick-plads").count()) + (await page.getByTestId("ud-pick-erfaring").count()) + (await page.getByTestId("ud-pick-dagsrapport").count()),
  }, null, 2));

  await page.getByTestId("ud-pick-erfaring").click();
  await shot("sager-ud-pick-erfaring");
  const types = await page.locator("[data-testid=ud-pick]").innerText();
  console.log(JSON.stringify({
    pladsregel: types.includes("Pladsregel"),
    genvej: types.includes("Genvej"),
    metode: types.includes("Godkendt metode"),
  }, null, 2));

  await page.getByRole("button", { name: "Luk" }).click();
  await page.getByRole("button", { name: "Luk" }).click();
  await page.getByTestId("sag-row-slip").waitFor();
  await shot("sager-ud-rows-again");
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("sager-ud-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
