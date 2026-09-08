import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(25000);
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function tapNav(label) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label) }).click();
  await page.waitForTimeout(400);
}

async function fresh() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

try {
  await fresh();
  await page.getByRole("button", { name: /Ole/ }).first().click();
  await page.getByText("Live tavle").waitFor({ timeout: 15000 });

  // --- Chat ---
  await tapNav("Chat");
  const chat = await page.locator("body").innerText();
  console.log("CHAT_EMPTY_HINT", /Tryk navne|starter tom/.test(chat));
  console.log("CHAT_FEDERICO_CHIP", /Federico/.test(chat));
  console.log("CHAT_NO_MESTER_CHIP", (await page.locator("button", { hasText: /^Mester$/ }).count()) === 0);
  console.log("CHAT_NO_ALLE", (await page.locator("button", { hasText: /Alle på sagen|Alle ansatte/ }).count()) === 0);
  const fedeBtn = page.getByRole("button", { name: /^Federico$/ });
  const fedeClass = (await fedeBtn.first().getAttribute("class")) || "";
  console.log("CHAT_FEDERICO_UNSELECTED", !/bg-navy/.test(fedeClass));
  await shot("rett-chat-empty");

  await fedeBtn.first().click();
  await page.getByPlaceholder(/husk|regntøj|tråden/i).fill("Svar i tråden med foto");
  await page.locator('button[aria-label="Send"]').click();
  await page.waitForTimeout(800);
  const afterSend = await page.locator("body").innerText();
  console.log("CHAT_THREAD", /Svar i tråden med foto/.test(afterSend));
  console.log("CHAT_BACK", /Alle beskeder/.test(afterSend));
  console.log("CHAT_REPLY_PH", (await page.getByPlaceholder(/Svar i tråden/i).count()) > 0);
  await shot("rett-chat-thread");

  // --- Plan ---
  await tapNav("Planlægning");
  const plan = await page.locator("body").innerText();
  const ugeIdx = plan.toLowerCase().indexOf("uge 36");
  const nyIdx = plan.toLowerCase().indexOf("personer");
  console.log("PLAN_UGE_TOP", ugeIdx >= 0 && (nyIdx < 0 || nyIdx > ugeIdx));
  console.log("PLAN_PERSONER", /personer/i.test(plan));
  console.log("PLAN_SWIPE_HINT", /Stryg hen over ugen/.test(plan));
  console.log("PLAN_NO_DATE", (await page.locator("input[type=date]").count()) === 0);
  console.log("PLAN_LAGER", /Lager/.test(plan) && /Kørsel/.test(plan));
  await shot("rett-plan-top");

  const swipe = page.locator(".snap-x").first();
  const before = await page.locator("body").innerText();
  await swipe.evaluate((el) => {
    const mid = el.children[1];
    const next = el.children[2];
    if (next) el.scrollLeft = next.offsetLeft;
  });
  await page.waitForTimeout(700);
  const afterSwipe = await page.locator("body").innerText();
  console.log("PLAN_SWIPE_TO_37", /UGE 37|Uge 37|NÆSTE UGE|Næste uge/.test(afterSwipe));
  console.log("PLAN_SWIPE_CHANGED", afterSwipe.slice(0, 400) !== before.slice(0, 400));

  await page.getByRole("button", { name: "Alex", exact: true }).last().click();
  await page.getByRole("button", { name: /^Ion/ }).last().click();
  await page.getByRole("button", { name: /^Marius/ }).last().click();
  await page.getByRole("button", { name: /man/i }).last().click();
  await page.getByRole("button", { name: "Lager", exact: true }).click();
  await page.getByPlaceholder("Hvad skal udføres").fill("ryd lager");
  await page.getByRole("button", { name: "Læg i ugeplan" }).click();
  await page.waitForTimeout(800);
  const store = await page.evaluate(() => {
    const raw = localStorage.getItem("zenko-plads-v31");
    if (!raw) return null;
    const plans = JSON.parse(raw)?.state?.plans ?? [];
    const hit = plans.find((p) => /ryd lager/i.test(p.title));
    const same = plans.filter((p) => /ryd lager/i.test(p.title));
    return hit ? { rows: same.length, ids: hit.employeeIds, id: hit.employeeId } : { rows: 0 };
  });
  console.log("PLAN_STORE", JSON.stringify(store));
  await shot("rett-plan-multi");

  // --- Sager ---
  await tapNav("Sager");
  const sag = await page.locator("body").innerText();
  console.log("SAG_MATERIALE_ROW", sag.includes("Materiale"));
  await shot("rett-sag-home");
  await page.getByRole("button", { name: "Materiale" }).first().click();
  await page.waitForTimeout(400);
  console.log("SAG_MAT_OPEN", /Bestilling|behov|Materiale|Ingen material/.test(await page.locator("body").innerText()));
  await shot("rett-sag-materiale");
  if (await page.getByRole("button", { name: /Luk/i }).count()) {
    await page.getByRole("button", { name: /Luk/i }).first().click();
    await page.waitForTimeout(250);
  }
  if (!(await page.getByRole("button", { name: "Opret ny" }).count())) await tapNav("Sager");
  await page.getByRole("button", { name: "Opret ny" }).first().click();
  await page.waitForTimeout(400);
  const sagVal = (await page.locator("select").count()) ? await page.locator("select").first().inputValue() : "";
  console.log("TODO_SAG_FIELD", /Vælg sag/.test(await page.locator("body").innerText()));
  console.log("TODO_SAG_VALUE", sagVal);
  console.log("TODO_SAG_NONEMPTY", sagVal.startsWith("job-"));
  await shot("rett-todo-sag");
  await page.getByRole("button", { name: /Tilbage/i }).first().click().catch(() => {});

  // --- GPS on seed todo ---
  await tapNav("Sager");
  await page.getByRole("button", { name: "To-do" }).first().click();
  await page.waitForTimeout(400);
  await page.getByText(/Ryd bag skuret/).first().click();
  await page.waitForTimeout(400);
  const maps = await page.locator('a[href*="maps.google.com/?q="]').count();
  const href = maps ? await page.locator('a[href*="maps.google.com/?q="]').first().getAttribute("href") : "";
  console.log("GPS_MAPS_LINKS", maps);
  console.log("GPS_HREF", href);
  await shot("rett-todo-gps");

  console.log("QA_DONE");
} catch (e) {
  console.log("QA_FAIL", e.message);
  await page.screenshot({ path: "/workspace/screenshots/rett-fail.png" });
} finally {
  await browser.close();
}
