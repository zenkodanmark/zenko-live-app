import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(28000);
page.on("pageerror", (e) => {
  if (!/hydrat/i.test(e.message)) console.log("PAGEERROR", e.message);
});

const marks = [];
function mark(id, ok, detail) {
  marks.push({ id, ok: Boolean(ok), detail: String(detail || "") });
  console.log(`${ok ? "OK" : "FAIL"} ${id}${detail ? " — " + detail : ""}`);
}

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.getByTestId("login-emp-ole").waitFor({ timeout: 15000 });
  await page.getByTestId("login-emp-ole").click();
  await page.getByTestId("pin-pad").waitFor();
  for (const d of "7777") await page.getByTestId(`pin-${d}`).click();
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 18000 });
}

async function openJobKs(jobName) {
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: new RegExp(jobName, "i") }).first().click();
  await page.getByTestId("sag-row-ks").waitFor({ timeout: 12000 });
  await page.getByTestId("sag-row-ks").click();
  await page.locator('[data-testid^="ks-row-"]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}

const { data: empRows, error: empErr } = await sb.from("employees").select("id,name,role,pin,language");
if (empErr) console.log("employees error", empErr.message);
const table = empRows ?? [];
console.log(
  "db employees",
  table.map((e) => `${e.id} ${e.name} ${e.role}`).join(" | "),
);

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
try {
  await page.getByTestId("login-emp-7d34f7").waitFor({ timeout: 12000 });
} catch {
  /* cloud slow */
}
await shot("login-crew");
const loginText = await page.locator("main").innerText();
const loginNames = await page.locator('[data-testid^="login-"]').allTextContents();
const loginBlob = loginNames.join(" | ");
mark("login-7", loginNames.length === 7, `${loginNames.length} kort: ${loginBlob.slice(0, 220)}`);
mark("login-liva-one", loginNames.filter((t) => /Liva/i.test(t)).length === 1, loginBlob.slice(0, 180));
mark("login-liva-mester", /Liva[\s\S]{0,80}Mester/i.test(loginBlob) || /Liva Lind[\s\S]{0,40}Mester/i.test(loginText), loginBlob.slice(0, 220));
mark("login-no-testsvend", !/Testsvend/i.test(loginText), loginText.slice(0, 160).replace(/\n/g, " | "));

await loginOle();
await openJobKs("Kærhuset");
await shot("kaer-ks");
const kaerIds = await page.locator('[data-testid^="ks-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") || ""));
const kaerNeed = ["8", "9", "82", "84", "85", "86", "87", "88"].map((n) => `ks-row-ksr-softr-${n}`);
const kaerMissing = kaerNeed.filter((id) => !kaerIds.includes(id));
mark("kaer-softr", kaerMissing.length === 0, kaerMissing.length ? `mangler ${kaerMissing.join(",")}` : `${kaerIds.length} rækker`);
mark("kaer-udfoersel", /UDFØRSEL/i.test(await page.locator("ul").first().innerText().catch(() => "")), "");

if (await page.getByTestId("sag-list-sheet").count()) {
  await page.getByTestId("sag-list-sheet").locator("button").first().click();
  await page.getByTestId("sag-list-sheet").waitFor({ state: "detached", timeout: 8000 });
}
await page.getByRole("button", { name: /Hillerødsholm/i }).first().click();
await page.getByTestId("sag-row-ks").waitFor({ timeout: 12000 });
await page.getByTestId("sag-row-ks").click();
await page.locator('[data-testid^="ks-row-"]').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
await shot("hill-ks");
const hillIds = await page.locator('[data-testid^="ks-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") || ""));
const hillText = await page.locator("main, body").first().innerText();
mark("hill-004", hillIds.some((id) => id.includes("ksr-grok-55-1sal")) || /Z-KS-2026-004/.test(hillText), hillIds.slice(0, 12).join(","));
mark("hill-97", hillIds.includes("ks-row-ksr-softr-97"), hillIds.filter((id) => id.includes("softr")).slice(0, 8).join(","));

if (await page.getByTestId("sag-list-sheet").count()) {
  await page.getByTestId("sag-list-sheet").locator("button").first().click();
  await page.getByTestId("sag-list-sheet").waitFor({ state: "detached", timeout: 8000 });
}
await page.getByRole("button", { name: "Folk" }).click();
await page.waitForTimeout(800);
await shot("folk");
const folkText = await page.locator("main, body").first().innerText();
const folkCards = await page.locator('[data-testid^="folk-person-"]').allTextContents();
mark("folk-7", folkCards.length === 7, `${folkCards.length}: ${folkCards.join(" | ")}`);
mark("folk-no-testsvend", !/Testsvend/i.test(folkText) && !folkCards.some((t) => /Testsvend/i.test(t)), folkCards.join(" | "));
mark("folk-liva-one", folkCards.filter((t) => /Liva/i.test(t)).length === 1, folkCards.join(" | "));
if (await page.getByTestId("folk-person-emp-7d34f7").count()) {
  await page.getByTestId("folk-person-emp-7d34f7").click();
  await page.waitForTimeout(400);
  await shot("folk-liva");
}

await browser.close();
const failed = marks.filter((m) => !m.ok);
console.log("\nSELVTEST");
for (const m of marks) console.log(`${m.ok ? "ja" : "nej"} ${m.id}${m.detail ? " (" + m.detail + ")" : ""}`);
console.log(failed.length ? `FAILED ${failed.length}` : "ALL OK");
process.exit(failed.length ? 1 : 0);
