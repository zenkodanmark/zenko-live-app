import assert from "node:assert/strict";
import test from "node:test";
import { isSpaShell, toSpaShell } from "./spa-shell.mjs";

const prerender = `<!DOCTYPE html><html lang="da" class="antialiased"><head><link rel="stylesheet" href="/assets/styles-x.css"/><link rel="modulepreload" href="/assets/index-abc.js"/></head><body class="min-h-dvh bg-sand"><main class="relative z-20 min-h-dvh bg-sand"><p>Mød ind på pladsen</p><a data-testid="login-emp-ole" href="/?e=emp-ole">Ole</a></main><script class="$tsr" id="$tsr-stream-barrier">self.$_TSR={router:{matches:[{i:"__root__\\u0000"},{i:"\\u0000\\u0000"}]}};$_TSR.e();document.currentScript.remove()</script><script type="module" async="" src="/assets/index-abc.js"></script></body></html>`;

test("404.html og index.html er samme SPA-skal uden login-liste", () => {
  const shell = toSpaShell(prerender);
  assert.equal(isSpaShell(shell), true);
  assert.match(shell, /data-spa-shell="1"/);
  assert.match(shell, /data-spa-shell-boot/);
  assert.match(shell, /\/assets\/index-abc\.js/);
  assert.doesNotMatch(shell, /login-emp-ole/);
  assert.doesNotMatch(shell, /Mød ind på pladsen/);
  assert.match(shell, /matches\.slice\(0,1\)/);
  const again = toSpaShell(shell);
  assert.equal(again, shell);
});

test("rå login-html er ikke en SPA-skal", () => {
  assert.equal(isSpaShell(prerender), false);
});
