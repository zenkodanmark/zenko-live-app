#!/usr/bin/env node
/** Capture the prerendered SPA shell and write index.html + 404.html for GitHub Pages. */
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pub = ".output/public";
const prerender = resolve("node_modules/.nitro/prerender/index.mjs");
if (!existsSync(join(pub, "assets")) || !existsSync(prerender)) {
  console.error("[pages] missing client build or prerender bundle");
  process.exit(1);
}

const base = (process.env.ZENKO_PAGES_BASE || "/zenko-live-app/").replace(/\/?$/, "/");
const pageUrl = `http://127.0.0.1${base}`;

const mod = await import(pathToFileURL(prerender).href);
const res = await mod.default.fetch(new Request(pageUrl));
let html = await res.text();
await mod.default.close?.();
if (!html.includes("login-emp-ole") || html.length < 500) {
  console.error("[pages] prerender HTML looks empty", pageUrl, html.length);
  process.exit(1);
}

if (base !== "/") {
  html = html.replaceAll(/(href|src)="\/(?!zenko-live-app\/|https?:)/g, '$1="/zenko-live-app/');
}

writeFileSync(join(pub, "index.html"), html);
writeFileSync(join(pub, "404.html"), html);
try {
  rmSync(join(pub, "index"));
} catch {
  /* */
}
writeFileSync(join(pub, ".nojekyll"), "");
console.log("[pages] wrote index.html + 404.html", html.length, "bytes from", pageUrl);
