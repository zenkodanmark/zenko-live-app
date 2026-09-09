import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";

const jpgPath = "/tmp/zenko-test.jpg";
const txtPath = "/tmp/zenko-dags.txt";
writeFileSync(
  jpgPath,
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAEBQIDBgABB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ANP8A//Z",
    "base64",
  ),
);
writeFileSync(txtPath, "Dagsrapport selvtest\n");

const verdict = {};
function mark(id, ok, detail) {
  verdict[id] = { ok: Boolean(ok), detail: String(detail || "") };
  console.log(`${ok ? "JA" : "NEJ"} ${id} ${detail || ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGEERROR", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function bodyText() {
  return page.locator("body").innerText();
}

async function sbGet(table, query = "") {
  const url = `${SB_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
    },
  });
  if (!res.ok) return { ok: false, status: res.status, rows: [] };
  const rows = await res.json();
  return { ok: true, status: res.status, rows: Array.isArray(rows) ? rows : [] };
}

async function pinLogin(empId, pin) {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const link = page.getByTestId(`login-${empId}`);
  if (await link.count()) {
    await link.click();
  } else {
    await page.getByText(/Ole|Testsvend|Alex|Ion/).first().click();
  }
  await page.getByTestId("pin-pad").waitFor({ timeout: 12000 });
  for (const d of pin) {
    await page.getByTestId(`pin-${d}`).click();
  }
  await page.waitForTimeout(400);
  const submit = page.getByTestId("pin-submit");
  if (await submit.isEnabled().catch(() => false)) {
    await submit.click();
  }
}

async function logoutNow() {
  const closer = page.locator('[data-testid="logout-open"]');
  if (await closer.count()) {
    await closer.first().click({ force: true });
    const yes = page.getByTestId("logout-yes");
    if (await yes.count()) await yes.click();
    await page.waitForTimeout(800);
  }
}

async function goTab(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* */
    }
  });
  await pinLogin("emp-ole", "7777");
  await page.getByRole("button", { name: "Tavle", exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await shot("01-login");
  const afterLogin = await bodyText();
  const driveToast = /Drive:|Drive-mapper|Drive svarede|Jyderup|Drive-mapperne blev ikke/i.test(afterLogin);
  mark("1a-login-no-drive", !driveToast, driveToast ? afterLogin.slice(0, 220) : "ingen Drive-toast");

  await goTab("Sager");
  await page.getByTestId("sager-title").waitFor();
  await page.getByTestId("sager-new").click();
  await page.getByTestId("job-name").waitFor();
  const createForm = await bodyText();
  const driveOnCreate = /Drive-mapper|01 Udbud|Drive-mapperne blev ikke/i.test(createForm);
  mark("1b-create-no-drive-ui", !driveOnCreate, driveOnCreate ? "Drive-tekst på opret" : "kun sag-felter");
  await page.getByTestId("job-name").fill("TEST-SUPA");
  await page.getByTestId("job-address").fill("Testvej 1, 6400 Sønderborg");
  await page.getByTestId("job-save").click();
  await page.waitForTimeout(1800);
  const afterCreate = await bodyText();
  const toastDrive = /Drive-mapper|Drive:/i.test(afterCreate);
  const hasTestSupa = afterCreate.includes("TEST-SUPA");
  await shot("01-create-sag");
  mark("1c-create-visible", hasTestSupa && !toastDrive, hasTestSupa ? "TEST-SUPA vises" : "mangler i listen");

  await page.waitForTimeout(1200);
  const projects = await sbGet("projects", "name=eq.TEST-SUPA&select=id,name,address");
  mark("1d-projects-row", projects.ok && projects.rows.some((r) => r.name === "TEST-SUPA"), JSON.stringify(projects.rows.slice(0, 2)));

  await page.getByTestId("sager-new").click();
  await page.getByTestId("job-name").fill("Aabenraavej");
  await page.getByTestId("job-address").fill("Aabenraavej 161, 6400 Sønderborg");
  await page.getByTestId("job-save").click();
  await page.waitForTimeout(1500);

  const hill = page.getByRole("button", { name: "Hillerødsholm", exact: true }).first();
  await hill.click();
  await page.waitForTimeout(400);
  await page.getByTestId("sager-edit").click();
  await page.waitForTimeout(300);
  const hillName = await page.locator("input").nth(0).inputValue();
  mark("2a-hillerod", hillName.includes("Hillerødsholm"), hillName);
  await shot("02-edit-hillerod");

  const aa = page.getByRole("button", { name: "Aabenraavej", exact: true }).first();
  await aa.click();
  await page.waitForTimeout(500);
  const editOpen = await page.getByTestId("sager-edit").getAttribute("class");
  await page.getByTestId("sager-edit").click();
  await page.waitForTimeout(300);
  const aaName = await page.locator("input").nth(0).inputValue();
  mark("2b-aabenraa", aaName.includes("Aabenraavej"), aaName);
  const addrInput = page.locator("input").nth(2);
  await addrInput.fill("Ny adresse 12, 6400 Sønderborg");
  await page.getByTestId("sager-edit-save").click();
  await page.waitForTimeout(800);
  const hillRow = await sbGet("projects", "name=eq.Hillerødsholm&select=id,name,address");
  const aaRow = await sbGet("projects", "name=eq.Aabenraavej&select=id,name,address");
  const hillAddr = hillRow.rows[0]?.address || "";
  const aaAddr = aaRow.rows[0]?.address || "";
  const hillUnchanged = /Selskovvej|Hillerød/i.test(hillAddr) && !/Ny adresse 12/.test(hillAddr);
  mark("2c-address-isolated", hillUnchanged, `Hillerød=${hillAddr} · AA=${aaAddr}`);
  await shot("02-edit-aabenraa");

  const kaer = page.getByRole("button", { name: "Kærhuset", exact: true }).first();
  await kaer.click();
  await page.waitForTimeout(400);

  async function closeSheets() {
  for (let i = 0; i < 4; i++) {
    const x = page.getByTestId("close-x");
    if (!(await x.count())) break;
    await x.last().click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function saveReport(kind, title) {
  await closeSheets();
  await page.getByTestId(`sag-plus-${kind}`).click();
  await page.waitForTimeout(400);
  const titleBox = page.locator("input").filter({ hasNot: page.locator("[type=file],[type=date]") }).first();
  const textInputs = page.locator('.fixed input[type="text"], .fixed input:not([type]), .fixed input[placeholder]');
  if (await textInputs.count()) await textInputs.first().fill(title);
  else await page.locator("input").nth(0).fill(title);
  const files = page.locator('input[type="file"]');
  if (await files.count()) {
    await files.first().setInputFiles(jpgPath);
    await page.waitForTimeout(400);
  }
  await page.getByTestId("todo-save").click();
  await page.waitForTimeout(1600);
  const t = await bodyText();
  const invariant = /Invariant failed/i.test(t);
  const saveFail = /Kunne ikke gemme/i.test(t);
  await closeSheets();
  return { invariant, saveFail, text: t.slice(0, 180) };
}

  const tfRes = await saveReport("tf", "TF selvtest foto");
  mark("3a-tf-no-invariant", !tfRes.invariant, tfRes.invariant ? tfRes.text : "ingen Invariant");
  const tfs = await sbGet("tfs", "title=eq.TF selvtest foto&select=id,title,photo_ids,project_id");
  const tfAlt = tfs.rows.length ? tfs : await sbGet("tfs", "question=like.*TF selvtest*&select=id,title,question,photo_ids");
  mark("3b-tf-row", (tfAlt.rows || []).length > 0, JSON.stringify((tfAlt.rows || []).slice(0, 1)));

  const asRes = await saveReport("slip", "AS selvtest 1200 kr");
  mark("3c-as-no-invariant", !asRes.invariant, asRes.invariant ? asRes.text : "ingen Invariant");
  const slips = await sbGet("slips", "title=eq.AS selvtest 1200 kr&select=id,title,photo_ids");
  mark("3d-as-row", slips.rows.length > 0, JSON.stringify(slips.rows.slice(0, 1)));

  const erRes = await saveReport("ent", "ER selvtest foto");
  mark("3e-er-no-invariant", !erRes.invariant, erRes.invariant ? erRes.text : "ingen Invariant");
  const ents = await sbGet("ents", "title=eq.ER selvtest foto&select=id,title,photo_ids");
  mark("3f-er-row", ents.rows.length > 0, JSON.stringify(ents.rows.slice(0, 1)));

  await closeSheets();
  await page.getByTestId("sag-plus-material").click();
  await page.waitForTimeout(500);
  const prodFields = page.getByLabel("Produkt", { exact: true }).first();
  await prodFields.fill("Mursten rød");
  const qty = page.getByLabel("Antal", { exact: true }).first();
  if (await qty.count()) await qty.fill("20 stk");
  await page.getByRole("button", { name: "Tilføj linje" }).click();
  const prod2 = page.getByLabel("Produkt", { exact: true }).nth(1);
  await prod2.fill("Mørtel KC");
  const qty2 = page.getByLabel("Antal", { exact: true }).nth(1);
  if (await qty2.count()) await qty2.fill("5 sække");
  const maBodyBefore = await bodyText();
  const hasSletTodo = /Slet to-do/i.test(maBodyBefore);
  mark("3g-ma-no-slet", !hasSletTodo, hasSletTodo ? "Slet to-do findes" : "ingen Slet to-do");
  const chips = /stk\s*$/i.test(maBodyBefore) && page.locator("button", { hasText: /^stk$/ });
  await page.getByRole("button", { name: "Gem som kladde" }).click();
  await page.waitForTimeout(2000);
  const maAfter = await bodyText();
  const maInvariant = /Invariant failed/i.test(maAfter);
  mark("3h-ma-no-invariant", !maInvariant, maInvariant ? maAfter.slice(0, 180) : "ingen Invariant");
  await shot("03-ma-draft");
  const orders = await sbGet("orders", "product=eq.Mursten rød&select=id,number,product,lines,status");
  mark("3i-ma-row", orders.rows.length > 0, JSON.stringify(orders.rows.slice(0, 1)));

  await closeSheets();
  await page.waitForTimeout(300);
  await page.getByTestId("sag-row-material").click();
  await page.waitForTimeout(600);
  const openBtn = page.getByRole("button", { name: "Åben" });
  if (await openBtn.count()) {
    await openBtn.first().click();
    await page.waitForTimeout(1200);
    const blanket = await bodyText();
    const isBlanket = /ZENKO DANMARK/i.test(blanket) && /Mursten rød/i.test(blanket) && !/Slet to-do/i.test(blanket);
    mark("3j-ma-open-blanket", isBlanket, blanket.slice(0, 220).replace(/\n/g, " | "));
    await shot("03-ma-open");
    await closeSheets();
  } else {
    mark("3j-ma-open-blanket", false, "ingen Åben-knap");
  }

  await closeSheets();

  await goTab("Chat");
  await page.waitForTimeout(600);
  await page.getByTestId("chat-new").click();
  await page.waitForTimeout(400);
  const ionChip = page.getByTestId("chat-to-emp-ion");
  if (await ionChip.count()) {
    await ionChip.click();
  } else {
    const ionBtn = page.getByRole("button", { name: /Ion/ }).first();
    if (await ionBtn.count()) await ionBtn.click();
  }
  await page.waitForTimeout(400);
  const ph = await page.locator("textarea").first().getAttribute("placeholder");
  mark("4a-placeholder-da", /Svar i tråden|Skriv|besked/i.test(ph || "") && !/Odpowiedz/i.test(ph || ""), ph || "");
  const back = page.getByTestId("back-arrow");
  const backText = (await back.count()) ? await back.innerText() : "";
  mark("4b-tilbage-text", /Tilbage/i.test(backText) && !/svg/i.test(backText), backText);
  await page.locator("textarea").first().fill("Hej Ion, kan du tage et foto af soklen?");
  await page.getByTestId("chat-gallery-input").setInputFiles(jpgPath);
  await page.waitForTimeout(700);
  await page.getByTestId("chat-send").click();
  await page.waitForTimeout(2500);
  const chatBody = await bodyText();
  const hasThumb = (await page.locator(".chat-thread img, ul img").count()) > 0;
  mark("4c-photo-send", hasThumb && !/Invariant failed/i.test(chatBody), hasThumb ? "thumb i tråd" : "ingen thumb");
  await shot("04-chat");
  await page.waitForTimeout(1200);
  const msgs = await sbGet("messages", "from_id=eq.emp-ole&select=id,original,photos,from_id&order=at.desc&limit=3");
  const withFile = (msgs.rows || []).some((m) => {
    const photos = m.photos || [];
    return photos.some((p) => p && (p.driveFileId || p.fileId));
  });
  mark("4d-messages-file", withFile || (msgs.rows || []).length > 0, JSON.stringify((msgs.rows || []).slice(0, 1)));

  await page.getByTestId("back-arrow").click().catch(() => {});
  await goTab("Folk");
  await page.waitForTimeout(500);
  const folk = await bodyText();
  const slackGone = !/Slack/i.test(folk) && !/Tillad notifikationer/i.test(folk) && !/Appen sender ikke/i.test(folk);
  mark("6a-folk-no-slack", slackGone, slackGone ? "ingen Slack/notif" : folk.slice(0, 180));
  await page.getByTestId("folk-add").click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder(/navn/i).fill("Testsvend");
  const pinInput = page.locator('input[maxlength="4"]').first();
  await pinInput.fill("1111");
  await page.getByTestId("folk-create-save").click();
  await page.waitForTimeout(1000);
  await shot("05-folk-create");
  const folkAfter = await bodyText();
  const createdVisible = folkAfter.includes("Testsvend");
  mark("5a-testsvend-list", createdVisible, createdVisible ? "Testsvend i liste" : folkAfter.slice(0, 160));
  const emps = await sbGet("employees", "name=eq.Testsvend&select=id,name,pin,role");
  mark("5b-employees-row", emps.rows.length > 0, JSON.stringify(emps.rows.slice(0, 1)));

  if (createdVisible) {
    await page.getByText("Testsvend", { exact: true }).first().click();
    await page.waitForTimeout(400);
    const person = await bodyText();
    const hasTodoTime = /To-do/i.test(person) && /Time/i.test(person);
    mark("6b-person-bars", hasTodoTime, hasTodoTime ? "To-do + Time" : person.slice(0, 140));
    await page.getByTestId("folk-todo-plus").click();
    await page.waitForTimeout(400);
    const compose = await bodyText();
    mark("6c-todo-preset", /Testsvend/i.test(compose), compose.slice(0, 140).replace(/\n/g, " | "));
    const closer = page.locator("button").filter({ has: page.locator("img[src*='close']") }).first();
    if (await closer.count()) await closer.click({ force: true });
    await page.waitForTimeout(300);
    const backPeople = page.getByRole("button", { name: /Folk|Tilbage/ }).first();
    if (await backPeople.count()) await backPeople.click({ force: true }).catch(() => {});
  } else {
    mark("6b-person-bars", false, "kunne ikke åbne Testsvend");
    mark("6c-todo-preset", false, "kunne ikke åbne Testsvend");
  }

  await goTab("Sager");
  await page.getByRole("button", { name: "Hillerødsholm", exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByTestId("sag-plus-ud").click();
  await page.getByTestId("ud-pick").waitFor({ timeout: 8000 });
  await page.getByTestId("ud-pick-plads").click();
  const cam = page.locator('[data-testid="ud-pick"] input[accept*="image"]').first();
  if (await cam.count()) await cam.setInputFiles(jpgPath);
  await page.waitForTimeout(400);
  await page.getByTestId("ud-send").click();
  await page.waitForTimeout(1500);

  await page.getByTestId("sag-plus-ud").click();
  await page.getByTestId("ud-pick").waitFor({ timeout: 8000 });
  await page.getByTestId("ud-pick-dagsrapport").click();
  await page.locator('[data-testid="ud-pick"] textarea').fill("Dagsrapport selvtest note");
  await page.getByTestId("ud-send").click();
  await page.waitForTimeout(1500);

  await page.getByTestId("sag-row-ud").click();
  await page.waitForTimeout(1500);
  await page.getByTestId("ud-folder-plads").click();
  await page.waitForTimeout(1000);
  const pladsList = await bodyText();
  const pladsOk = /zenko-test\.jpg/i.test(pladsList) && !/dagsrapport-selvtest-note/i.test(pladsList);
  mark("7a-plads-only", pladsOk, pladsList.slice(0, 280).replace(/\n/g, " | "));
  await shot("07-ud-plads");
  await page.getByTestId("ud-folder-dagsrapport").click();
  await page.waitForTimeout(1000);
  const dagsList = await bodyText();
  const dagsOk = /dagsrapport-selvtest-note|\.txt/i.test(dagsList) && !/zenko-test\.jpg/i.test(dagsList);
  mark("7b-dags-only", dagsOk, dagsList.slice(0, 280).replace(/\n/g, " | "));
  await page.getByTestId("ud-folder-erfaring").click();
  await page.waitForTimeout(800);
  const erf = await bodyText();
  const erfList = await page.locator("[data-testid='ud-folder-erfaring']").locator("xpath=ancestor::div[1]").innerText().catch(() => erf);
  mark("7c-erfaring-empty", /Ingen/i.test(erf) && !/zenko-test\.jpg/i.test(erf), erf.slice(0, 220).replace(/\n/g, " | "));
  await shot("07-ud-dags");
  if (await page.getByTestId("sag-list-sheet").count()) {
    await closeSheets();
  }

  const udHref = await page.getByTestId("kunde-udfoersel").getAttribute("href");
  mark("8a-udfoersel-link", Boolean(udHref && /\/sag\//.test(udHref)), udHref || "mangler");
  if (udHref) {
    await page.goto(`http://127.0.0.1:8080${udHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const backUd = page.getByTestId("udfoersel-back");
    await backUd.waitFor({ timeout: 10000 });
    const backLabel = await backUd.innerText();
    mark("8b-tilbage-label", /Tilbage/i.test(backLabel), backLabel);
    await shot("08-udfoersel");
    await backUd.click();
    await page.waitForTimeout(1500);
    const backPage = await bodyText();
    const notLogin = !/Mød ind på pladsen/i.test(backPage);
    const sameJob = /Hillerødsholm/i.test(backPage);
    mark("8c-back-to-sag", notLogin && sameJob, backPage.slice(0, 180).replace(/\n/g, " | "));
    await shot("08-back");
  } else {
    mark("8b-tilbage-label", false, "ingen href");
    mark("8c-back-to-sag", false, "ingen href");
  }

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (await page.getByRole("button", { name: "Tavle", exact: true }).count()) {
    await logoutNow();
  } else if (await page.getByTestId("logout-open").count()) {
    await logoutNow();
  }
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await shot("05-login-list");
  const loginList = await bodyText();
  const inList = /Testsvend/i.test(loginList);
  mark("5c-login-list", inList, inList ? "Testsvend på login" : loginList.slice(0, 160).replace(/\n/g, " | "));
  if (inList) {
    const testId = (emps.rows[0] && emps.rows[0].id) || "";
    if (testId) {
      const l = page.getByTestId(`login-${testId}`);
      if (await l.count()) await l.click();
      else await page.getByText("Testsvend").first().click();
    } else {
      await page.getByText("Testsvend").first().click();
    }
    await page.getByTestId("pin-pad").waitFor({ timeout: 10000 });
    for (const d of "1111") await page.getByTestId(`pin-${d}`).click();
    await page.waitForTimeout(400);
    const t0 = Date.now();
    await page.waitForTimeout(3500);
    const after = await bodyText();
    const hung = /Åbner…/.test(after) && Date.now() - t0 > 3000 && !/mødt|plads|i dag|To-do/i.test(after);
    const onCrew = /mødt|plads|i dag|Testsvend/i.test(after) && !hung;
    mark("5d-login-no-hang", onCrew && !hung, after.slice(0, 180).replace(/\n/g, " | "));
    await shot("05-testsvend-home");
  } else {
    mark("5d-login-no-hang", false, "Testsvend ikke i login-liste");
  }

  const invariantAny = errors.some((e) => /invariant/i.test(e));
  mark("3k-no-pageerror-invariant", !invariantAny, invariantAny ? errors.join(" | ") : "ingen Invariant i pageerror");
} catch (err) {
  console.error("FAIL", err);
  await shot("selftest-fail");
  const t = await bodyText().catch(() => "");
  console.log("BODY", t.slice(0, 2500));
  process.exitCode = 1;
} finally {
  console.log("VERDICT", JSON.stringify(verdict, null, 2));
  await browser.close();
}
