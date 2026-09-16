import assert from "node:assert/strict";
import test from "node:test";
import { copyDiffersFromOriginal, mergeTodoTranslations, translateTodoCopyLocal } from "./todo-translate.ts";

test("rigtig oversættelse slår dansk kopi", () => {
  const original = { title: "Ryd op bag skuret", body: "Ryd op bag skuret. Send foto." };
  assert.equal(copyDiffersFromOriginal({ title: "Ryd op bag skuret", body: "Ryd op bag skuret. Send foto." }, original), false);
  assert.equal(
    copyDiffersFromOriginal({ title: "Curăță în spatele șopronului", body: "Curăță în spatele șopronului. Trimite foto." }, original),
    true,
  );
  const merged = mergeTodoTranslations(
    { da: original, ro: original },
    { ro: { title: "Curăță în spatele șopronului", body: "Curăță în spatele șopronului. Trimite foto." } },
    original,
  );
  assert.equal((merged.ro as { body?: string }).body?.includes("Trimite"), true);
  assert.equal((merged.da as { body?: string }).body, original.body);
});

test("lokal oversættelse skriver title+body pr. sprog", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const ro = decodeURIComponent(url).includes("|ro");
    const q = decodeURIComponent(url.split("q=")[1] || "").split("&")[0] || "";
    const text = ro
      ? q.includes("Send foto")
        ? "Curăță în spatele șopronului. Trimite foto."
        : "Curăță în spatele șopronului"
      : q;
    return new Response(JSON.stringify({ responseData: { translatedText: text } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const got = await translateTodoCopyLocal({
      title: "Ryd op bag skuret",
      body: "Ryd op bag skuret. Send foto.",
      from: "da",
      langs: ["da", "ro"],
    });
    assert.equal((got.da as { title?: string }).title, "Ryd op bag skuret");
    assert.equal((got.da as { body?: string }).body, "Ryd op bag skuret. Send foto.");
    assert.equal((got.ro as { title?: string }).title, "Curăță în spatele șopronului");
    assert.match((got.ro as { body?: string }).body || "", /Trimite foto/);
  } finally {
    globalThis.fetch = prev;
  }
});
