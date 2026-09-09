#!/usr/bin/env node
/**
 * GitHub Pages production build.
 *
 * Nitro's github-pages preset prerenders the SPA, then Vite 8 tries to bundle
 * a server entry that does not exist and dies with:
 *   rolldownOptions.input should not be an html file when building for SSR
 * The client output is already complete at that point (nitrojs/nitro#4509).
 * Treat that known error as success when the prerendered public folder exists.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_STATIC_SSR =
  "rolldownOptions.input should not be an html file when building for SSR";

const env = {
  ...process.env,
  ZENKO_PAGES: process.env.ZENKO_PAGES || "1",
  NITRO_PRESET: process.env.NITRO_PRESET || "github-pages",
  ZENKO_PAGES_BASE: process.env.ZENKO_PAGES_BASE || "/",
  VITE_AUTH_ENABLED: process.env.VITE_AUTH_ENABLED || "false",
};

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (buf) => {
      const text = String(buf);
      out += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (buf) => {
      const text = String(buf);
      out += text;
      process.stderr.write(text);
    });
    child.on("error", (err) => {
      console.error(`[pages] failed to run ${command}:`, err?.message || err);
      resolve({ code: 127, out });
    });
    child.on("exit", (code) => resolve({ code: code ?? 1, out }));
  });
}

const pub = ".output/public";
const prerender = "node_modules/.nitro/prerender/index.mjs";
const wrapper = fileURLToPath(new URL("./with-app-env.mjs", import.meta.url));

const vite = await run(process.execPath, [wrapper, "vite", "build"]);
const complete = existsSync(join(pub, "assets")) && existsSync(prerender);

if (vite.code !== 0) {
  const known = vite.out.includes(KNOWN_STATIC_SSR);
  if (!known || !complete) {
    console.error("[pages] vite build failed");
    process.exit(vite.code);
  }
  console.warn("[pages] ignoring Nitro static-preset SSR bundle error — public output is complete");
}

const finish = await run(process.execPath, [fileURLToPath(new URL("./finish-pages.mjs", import.meta.url))]);
if (finish.code !== 0) process.exit(finish.code);

const index = join(pub, "index.html");
const notFound = join(pub, "404.html");
if (!existsSync(index) || !existsSync(notFound) || !existsSync(join(pub, ".nojekyll"))) {
  console.error("[pages] missing SPA shell after finish-pages");
  process.exit(1);
}
const html = readFileSync(index, "utf8");
if (!html.includes("login-emp-ole") || html.length < 500) {
  console.error("[pages] index.html looks empty");
  process.exit(1);
}
console.log("[pages] build ready", html.length, "bytes");
