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

const mod = await import(pathToFileURL(prerender).href);
const res = await mod.default.fetch(new Request("http://127.0.0.1/zenko-live-app/"));
let html = await res.text();
await mod.default.close?.();
if (!html.includes("login-emp-ole") || !html.includes("index-")) {
  console.error("[pages] prerender HTML looks empty");
  process.exit(1);
}

html = html.replaceAll(/(href|src)="\/(?!zenko-live-app\/|https?:)/g, '$1="/zenko-live-app/');

writeFileSync(join(pub, "index.html"), html);
writeFileSync(join(pub, "404.html"), html);
try {
  rmSync(join(pub, "index"));
} catch {
  /* */
}
writeFileSync(join(pub, ".nojekyll"), "");
console.log("[pages] wrote index.html + 404.html", html.length, "bytes");
