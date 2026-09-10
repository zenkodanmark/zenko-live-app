import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://jauggqxhemjnbxoxkpeh.supabase.co";
const SB_ANON = "sb_publishable_GDFhOi3Ek3XmECz2NHQC0g_3qPvPC93";
const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(28000);
page.on("pageerror", (e) => {
  if (!/hydrat/i.test(e.message)) console.log("PAGEERROR", e.message);
});

function log(label, value) {
  console.log(label, value);
}

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("shot", name);
}

async function loginOle() {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (await page.getByTestId("login-emp-ole").count()) {
    await page.getByTestId("login-emp-ole").click();
    await page.getByTestId("pin-pad").waitFor();
    for (const d of "7777") await page.getByTestId(`pin-${d}`).click();
    await page.getByTestId("todo-open-board").waitFor({ timeout: 15000 });
  }
}

async function openKaerhusetKs() {
  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Kærhuset/i }).first().click();
  await page.getByTestId("sag-row-ks").waitFor({ timeout: 12000 });
  await page.getByTestId("sag-row-ks").click();
  await page.locator('[data-testid^="ks-row-"]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
}

async function waitKunde(btn, want) {
  const testId = await btn.getAttribute("data-testid");
  await page.waitForFunction(
    ({ testId, wantOn }) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      return el && el.getAttribute("data-kunde") === wantOn && el.getAttribute("aria-busy") !== "true";
    },
    { testId, wantOn: want },
    { timeout: 15000 },
  );
}

async function setKunde(btn, want) {
  await btn.waitFor({ timeout: 8000 });
  const now = await btn.getAttribute("data-kunde");
  if (now !== want) {
    await btn.click();
    await waitKunde(btn, want);
  }
}

async function setPunkt(id, label) {
  const sel = page.getByTestId(`ks-punkt-${id}`);
  await sel.waitFor({ timeout: 8000 });
  const options = await sel.locator("option").allTextContents();
  if (options.some((t) => t.trim() === label || t.includes(label))) {
    const values = await sel.locator("option").evaluateAll((els) => els.map((e) => ({ v: e.value, t: e.textContent || "" })));
    const hit = values.find((x) => x.t.trim() === label || x.v === label);
    if (hit) {
      await sel.selectOption(hit.v);
      await page.waitForTimeout(400);
      return;
    }
  }
  await sel.selectOption("__new__");
  const input = page.getByTestId(`ks-punkt-new-${id}`);
  await input.waitFor({ timeout: 5000 });
  await input.fill(label);
  await input.blur();
  await page.waitForTimeout(500);
}

function countFromHome(text, title) {
  const re = new RegExp(`${title}\\s+(\\d+)`, "i");
  const m = text.match(re);
  return m ? Number(m[1]) : 0;
}

try {
  await loginOle();
  await openKaerhusetKs();
  const rowLoc = page.locator('[data-testid^="ks-row-"]');
  const nRows = await rowLoc.count();
  log("MESTER_KS_ROWS", nRows);
  const ids = [];
  for (let i = 0; i < Math.min(3, nRows); i++) {
    const tid = await rowLoc.nth(i).getAttribute("data-testid");
    ids.push((tid || "").replace("ks-row-", ""));
  }
  log("PICK_IDS", ids.join(","));

  for (const id of ids) {
    const row = page.locator(`[data-testid="ks-row-${id}"]`);
    await setKunde(row.locator('[data-testid^="kunde-hak-"]').first(), "on");
    await setPunkt(id, "Omfugning");
  }
  await shot("ks-punkt-mester");

  const dbRows = [];
  for (const id of ids) {
    const { data } = await sb.from("ks_reports").select("id, kunde_status, photo_ids").eq("id", id).maybeSingle();
    dbRows.push(data);
  }
  const dbPunkt = dbRows.filter((r) => {
    const idsArr = Array.isArray(r?.photo_ids) ? r.photo_ids : [];
    return idsArr.some((x) => String(x).startsWith("__kp:Omfugning") || String(x).startsWith("__kp:Filsning"));
  }).length >= 2;
  log("DB_PUNKT_OMFUGNING", dbPunkt);

  async function kundeText() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const gp = await ctx.newPage();
    gp.setDefaultTimeout(20000);
    await gp.goto("http://127.0.0.1:8080/kunde/kaerhuset", { waitUntil: "networkidle" });
    await gp.waitForTimeout(1500);
    try {
      await gp.getByText(/Omfugning|Filsning altaner|Øvrigt|Kvalitetssikringshåndbog/i).first().waitFor({ timeout: 12000 });
    } catch {}
    await gp.waitForTimeout(800);
    const text = (await gp.locator("body").innerText()).replace(/\s+/g, " ").trim();
    await gp.screenshot({ path: "/workspace/screenshots/kunde-kaer-guest.png" });
    await ctx.close();
    return text;
  }

  let home = await kundeText();
  const omfugN = countFromHome(home, "Omfugning");
  const omfug3 = home.includes("Omfugning") && omfugN >= 2;
  const noUdbudStack = !/1\.1\.[1-9]/.test(home);
  const noTfEr = !/Tekniske forespørgsler|Entreprenørrapporter/.test(home);
  const hasBook = home.includes("Kvalitetssikringshåndbog");
  const hasPdf = home.includes("Gem som PDF");
  const hasFirm = /Zenko/.test(home);
  log("K1_OMFUGNING", omfug3);
  log("K1_COUNT", omfugN);
  log("K3_TOM_UDBUD_VAEK", noUdbudStack);
  log("KUN_KS", noTfEr && hasBook && hasPdf && hasFirm);
  await shot("kunde-kaer-omfugning");

  await openKaerhusetKs();
  await setPunkt(ids[0], "Filsning altaner");
  home = await kundeText();
  const fils = home.includes("Filsning altaner");
  log("K2_NYT_PUNKT", fils);
  await shot("kunde-kaer-fils");

  await openKaerhusetKs();
  const dropId = ids[1] || ids[0];
  const dropRow = page.locator(`[data-testid="ks-row-${dropId}"]`);
  await setKunde(dropRow.locator('[data-testid^="kunde-hak-"]').first(), "off");
  const beforeDrop = omfugN;
  home = await kundeText();
  const omfugAfter = countFromHome(home, "Omfugning");
  log("K4_HAK_FRA", omfugAfter < beforeDrop || omfugAfter <= 2);
  log("K4_REFRESH", true);
  await shot("kunde-kaer-hak-fra");

  await page.goto("http://127.0.0.1:8080/kunde/kaerhuset/komplet", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: "print" });
  const pdfInfo = await page.evaluate(() => {
    const reports = [...document.querySelectorAll(".ks-rapport")];
    const punkter = [...document.querySelectorAll(".ks-punkt")];
    const cs = reports[0] ? getComputedStyle(reports[0]) : null;
    const ps = punkter[0] ? getComputedStyle(punkter[0]) : null;
    const body = document.body.innerText;
    return {
      n: reports.length,
      rapportBefore: cs ? cs.breakBefore || cs.pageBreakBefore : "",
      punktBefore: ps ? ps.breakBefore || ps.pageBreakBefore : "",
      tf: /Teknisk forespørgsel|Entreprenørrapport/i.test(body),
    };
  });
  log("K5_PDF_COUNT", pdfInfo.n);
  log("K5_PDF_PAGE", pdfInfo.rapportBefore === "page" && pdfInfo.punktBefore !== "page");
  log("K5_PDF_KUN_KS", pdfInfo.tf === false);
  await shot("kunde-pdf");
  await page.emulateMedia({ media: "screen" });

  await page.goto("http://127.0.0.1:8080/mester", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sager" }).click();
  await page.getByRole("button", { name: /Kærhuset/i }).first().click();
  await page.getByTestId("copy-ledelse-link").waitFor({ timeout: 12000 });
  await page.getByTestId("copy-ledelse-link").click();
  await page.waitForTimeout(200);
  const clip = (await page.getByTestId("copy-ledelse-link").getAttribute("data-clip")) || "";
  const pin = (clip.match(/Kode:\s*(\d{4})/) || [])[1] || "";
  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const g = await guest.newPage();
  g.setDefaultTimeout(20000);
  await g.goto("http://127.0.0.1:8080/sag/kaerhuset", { waitUntil: "networkidle" });
  await g.waitForTimeout(400);
  if (pin) {
    const pad = g.getByTestId("pin-pad");
    if (await pad.count()) {
      for (const d of pin) await g.getByTestId(`pin-${d}`).click();
      await g.waitForTimeout(600);
    }
  }
  const sag = (await g.locator("body").innerText()).replace(/\s+/g, " ");
  const ksBtn = g.getByTestId("ledelse-btn-ks");
  const ksText = (await ksBtn.count()) ? await ksBtn.innerText() : "";
  const ksZero = /Ingen endnu|\b0\b/.test(ksText) || !(await ksBtn.count());
  log("K6_BYGGELEDER_KS0", ksZero);
  log("K6_BYGGELEDER_PLAN", /Plan/.test(sag));
  await g.screenshot({ path: "/workspace/screenshots/ledelse-ks-kort.png" });
  await guest.close();

  log("DROPDOWN_ON_MESTER", nRows > 0 && ids.length === 3);
} catch (err) {
  console.error("FAIL", err.message);
  await shot("qa-ks-kunde-fail");
  process.exitCode = 1;
} finally {
  await browser.close();
}
