import { chromium } from "playwright";

const url = "https://trey21664.softr.app/time-entries-details?recordId=6LLaGm0MYlqDNv";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const reqs = [];
page.on("request", (r) => {
  const u = r.url();
  if (/softr|airtable|supabase|googleapis|api/.test(u) && !/\.(js|css|woff|png|svg)(\?|$)/.test(u)) {
    reqs.push({ method: r.method(), url: u.slice(0, 300) });
  }
});
page.on("response", async (r) => {
  const u = r.url();
  if (/record|data|block|list|detail/i.test(u) && r.status() < 500) {
    const ct = r.headers()["content-type"] || "";
    if (ct.includes("json")) {
      const body = await r.text().catch(() => "");
      console.log("JSON", r.status(), u.slice(0, 220), body.slice(0, 400));
    }
  }
});
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(4000);
  const text = await page.locator("body").innerText().catch(() => "");
  console.log("TITLE", await page.title());
  console.log("URL", page.url());
  console.log("BODY\n", text.slice(0, 4000));
  await page.screenshot({ path: "/workspace/screenshots/softr-record.png", fullPage: true });
  console.log("REQS");
  for (const r of reqs.slice(0, 80)) console.log(r.method, r.url);
  const imgs = await page.locator("img").evaluateAll((els) => els.map((e) => ({ src: e.src, alt: e.alt, w: e.naturalWidth })));
  console.log("IMGS", JSON.stringify(imgs.slice(0, 30), null, 0));
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: "/workspace/screenshots/softr-fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
