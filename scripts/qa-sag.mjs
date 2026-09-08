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
  await page.waitForTimeout(600);
  const body = await page.locator("body").innerText();
  return body.replace(/\s+/g, " ").trim();
}

try {
  const home = await open("/sag/hilleroedsholm");
  console.log("HOME", {
    pin: /Pinkode|Mød ind/.test(home),
    zenko: home.includes("ZENKO DANMARK"),
    kicker: home.includes("BYGGELEDELSE"),
    sag: home.includes("Hillerødsholm"),
    three: home.includes("Tekniske forespørgsler") && home.includes("Aftalesedler") && home.includes("Entreprenørrapporter"),
    tf006: /Z-TF-2026-006/.test(home),
    as292: home.includes("AS-292"),
    er366: home.includes("ER-366"),
    book: home.includes("Kvalitetssikringshåndbog"),
  });
  await shot("sag-home");

  const tfList = await open("/sag/hilleroedsholm/tf");
  console.log("TF_LIST", {
    six: /Z-TF-2026-006/.test(tfList),
    five: /Z-TF-2026-005/.test(tfList),
    titles: /Hug af puds|Pudset facade/i.test(tfList),
    filter: tfList.includes("Søg") && tfList.includes("Åbne"),
  });
  await shot("sag-tf-list");

  const asList = await open("/sag/hilleroedsholm/as");
  console.log("AS_LIST", {
    as292: asList.includes("AS-292"),
    as36: /AS-36\b/.test(asList),
    pdf: asList.includes("Lav PDF-rapport") || asList.includes("Hak"),
    price: asList.includes("38.825"),
    titles: /STÅL|stålbindere/i.test(asList),
  });
  await shot("sag-as-list");

  const erList = await open("/sag/hilleroedsholm/er");
  console.log("ER_LIST", {
    er366: erList.includes("ER-366"),
    titles: /tagrender|inddækning/i.test(erList),
  });
  await shot("sag-er-list");

  const tf = await open("/sag/hilleroedsholm/tf/Z-TF-2026-006");
  console.log("TF", {
    title: /altan/i.test(tf),
    status: /ÅBEN|BESVARET/.test(tf),
    send: tf.includes("Send svar"),
    edit: /rediger jeres tekst/i.test(tf),
  });
  await shot("sag-tf");

  await page.fill("textarea", "Godkendt. Hug efter skitsen.");
  await page.getByRole("button", { name: "Send svar" }).click();
  await page.waitForTimeout(800);
  const after = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("TF_REPLY", {
    saved: after.includes("Godkendt. Hug efter skitsen."),
    status: after.includes("BESVARET"),
  });
  await shot("sag-tf-svar");

  const as = await open("/sag/hilleroedsholm/as/292");
  console.log("AS", {
    title: /STÅL|stål/i.test(as),
    price: as.includes("38.825"),
    moms: /ekskl/i.test(as),
    materials: /Stål/i.test(as),
  });
  await shot("sag-as-292");

  const er = await open("/sag/hilleroedsholm/er/366");
  console.log("ER", {
    number: er.includes("ER-366") || er.includes("366"),
    reply: er.includes("Send svar"),
  });
  await shot("sag-er-366");

  const pdf = await open("/sag/hilleroedsholm/samling?n=292,368,383,385,387,388");
  console.log("SAMLING", {
    kicker: pdf.includes("SAMLING"),
    table: pdf.includes("AS-292") && pdf.includes("AS-388"),
    sum: /90\.425|I alt/.test(pdf),
    as292: pdf.includes("38.825"),
    pages: /Side 1 af 7/.test(pdf),
  });
  await shot("sag-samling");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://127.0.0.1:8080/sag/hilleroedsholm", { waitUntil: "networkidle" });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/sag-home-mobile.png" });
  console.log("shot sag-home-mobile");
  await mobile.close();

  const kaer = await open("/sag/kaerhuset");
  console.log("KAER", {
    sag: kaer.includes("Kærhuset"),
    kicker: kaer.includes("BYGGELEDELSE"),
    book: kaer.includes("Kvalitetssikringshåndbog"),
  });
  await shot("sag-kaerhuset");

  const kunde = await open("/kunde/hilleroedsholm");
  console.log("KUNDE_STILL", {
    book: kunde.includes("Kvalitetssikringshåndbog"),
    sagKicker: kunde.includes("BYGGELEDELSE"),
  });
} catch (err) {
  console.error("QA_FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
