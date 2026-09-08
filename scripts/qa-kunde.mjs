import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
}

async function open(path) {
  await page.goto(`http://127.0.0.1:8080${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  return body.replace(/\s+/g, " ").trim();
}

try {
  const home = await open("/kunde/hilleroedsholm");
  console.log("HOME", {
    pin: /Pinkode|Mød ind/.test(home),
    zenko: home.includes("ZENKO DANMARK"),
    sag: home.includes("Hillerødsholm"),
    book: home.includes("Kvalitetssikringshåndbog"),
    p100203: home.includes("10.02.03"),
    p100204: home.includes("10.02.04"),
    hours: /timer/i.test(home),
  });
  await shot("kunde-home");

  const book = await open("/kunde/hilleroedsholm/haandbog");
  console.log("BOOK", {
    purpose: book.includes("Formål"),
    duty: book.includes("Ansvar"),
    control: book.includes("Proceskontrol"),
    docs: book.includes("Dokumentation"),
    fax: /fax/i.test(book),
  });
  await shot("kunde-haandbog");

  const punkt = await open("/kunde/hilleroedsholm/10.02.03");
  console.log("PUNKT", {
    title: punkt.includes("Iboring"),
    rapport: /Rapport 02/.test(punkt) && punkt.includes("Federico"),
    hours: /timer/i.test(punkt),
  });
  await shot("kunde-punkt");

  const rap = await open("/kunde/hilleroedsholm/10.02.03/02");
  console.log("RAPPORT", {
    header: /PROCESKONTROL/.test(rap) && rap.includes("RAPPORT 02"),
    ingen: rap.includes("Ingen"),
    filename: rap.includes("20260413_105019"),
    hours: /timer/i.test(rap),
  });
  await shot("kunde-rapport");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://127.0.0.1:8080/kunde/hilleroedsholm", { waitUntil: "networkidle" });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/kunde-home-mobile.png" });
  console.log("shot kunde-home-mobile");
  await mobile.close();

  const kaer = await open("/kunde/kaerhuset");
  console.log("KAER", {
    sag: kaer.includes("Kærhuset"),
    p118: kaer.includes("1.1.8"),
    p116: kaer.includes("1.1.6"),
    book: kaer.includes("Kvalitetssikringshåndbog"),
    hours: /timer/i.test(kaer),
  });
  await shot("kunde-kaerhuset");

  const prov = await open("/kunde/proevestenen");
  console.log("PROV", {
    sag: /Prøvestenen/.test(prov),
    empty: !/10\.02\.|1\.1\.\d/.test(prov),
    book: prov.includes("Kvalitetssikringshåndbog"),
  });
  await shot("kunde-provestenen");

  // master hak
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ole/ }).first().click();
  for (const d of "7777") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByText(/Åbn kundeside/i).waitFor({ timeout: 10000 });
  await shot("kunde-sager-bar");
  const sag = await page.locator("body").innerText();
  console.log("SAG", {
    bar: sag.includes("Åbn kundeside"),
    path: sag.includes("/kunde/hilleroedsholm"),
  });
  console.log("OK");
} catch (err) {
  console.error("FAIL", err);
  await shot("kunde-fail");
  const t = await page.locator("body").innerText().catch(() => "");
  console.log("BODY", t.slice(0, 2000));
  process.exitCode = 1;
} finally {
  await browser.close();
}
