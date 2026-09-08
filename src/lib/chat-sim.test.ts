import assert from "node:assert/strict";
import test from "node:test";
import { chatVisible, completeTranslations, driveOnlyPhotos, mergeLangMap, shownText } from "./chat.ts";
import { slimChat } from "./yard-slim.ts";
import { EMPLOYEES } from "./seed.ts";
import type { Assignment, ChatMessage, Employee, Lang } from "./types.ts";

const people = EMPLOYEES;
const masters = people.filter((e) => e.role === "mester");
const crew = people.filter((e) => e.role !== "mester");
const assignments: Assignment[] = people
  .filter((e) => e.role !== "mester")
  .map((e) => ({ employeeId: e.id, projectId: "job-hillerodsholm" }));

const LANGS: Lang[] = ["da", "ro", "pl", "uk", "de", "en", "es"];

function line(from: Employee, to: Employee, translations: Partial<Record<Lang, string>>, original: string): ChatMessage {
  return {
    id: `ch-${from.id}-${to.id}`,
    at: "2026-09-06T10:00:00.000Z",
    fromId: from.id,
    to: { kind: "employee", id: to.id },
    projectId: "job-hillerodsholm",
    sourceLang: from.language,
    original,
    translations: completeTranslations(original, from.language, translations),
  };
}

test("simulation: polsk original fylder ikke dansk før oversættelse", () => {
  const original = "Jutro zaprawa na Hillerødsholm";
  const got = completeTranslations(original, "pl", { pl: original });
  assert.equal(got.pl, original);
  assert.equal(got.da, undefined);
});

test("simulation: synk må ikke overskrive dansk med original", () => {
  const original = "Jutro zaprawa";
  const stub = completeTranslations(original, "pl", { pl: original });
  const done = completeTranslations(original, "pl", { pl: original, da: "I morgen mørtel" });
  const merged = mergeLangMap(original, stub, done);
  assert.equal(merged.da, "I morgen mørtel");
  assert.equal(merged.pl, original);
});

test("simulation: alle sprog-nøgler sættes", () => {
  const got = completeTranslations("Mørtel i morgen på Hillerødsholm", "da", { da: "Mørtel i morgen på Hillerødsholm", ro: "Mortar mâine la Hillerødsholm" });
  assert.equal(got.da, "Mørtel i morgen på Hillerødsholm");
  assert.equal(got.ro, "Mortar mâine la Hillerødsholm");
  assert.equal(got.pl, undefined);
});

test("simulation: mester ser altid dansk, ansat sit sprog", () => {
  const original = "Ryd bag skuret";
  const translations = completeTranslations(original, "da", {
    da: "Ryd bag skuret",
    ro: "Curăță în spatele șopronului",
    pl: "Posprzątaj za szopą",
    es: "Limpia detrás del cobertizo",
    uk: "Прибери за сараєм",
    de: "Räum hinter dem Schuppen",
    en: "Clear behind the shed",
  });
  for (const from of people) {
    for (const to of people) {
      if (from.id === to.id) continue;
      const msg = line(from, to, translations, original);
      const view = shownText(msg, to.language, to.role);
      if (to.role === "mester") {
        assert.equal(view, translations.da, `${to.name} (mester) skal se dansk`);
      } else {
        assert.equal(view, translations[to.language], `${to.name} skal se ${to.language}`);
      }
    }
  }
});

test("simulation: synlighed mellem alle ansatte og mestre", () => {
  for (const from of people) {
    for (const to of people) {
      if (from.id === to.id) continue;
      const msg = line(from, to, { da: "Hej", [from.language]: "Hej" }, "Hej");
      assert.equal(chatVisible(msg, from, assignments), true, `${from.name} ser egen besked`);
      assert.equal(chatVisible(msg, to, assignments), true, `${to.name} ser besked fra ${from.name}`);
      for (const other of people) {
        if (other.id === from.id || other.id === to.id) continue;
        assert.equal(chatVisible(msg, other, assignments), false, `${other.name} skal ikke se privat ${from.name}→${to.name}`);
      }
    }
  }
  for (const from of crew) {
    const toMasters: ChatMessage = {
      id: "ch-masters",
      at: "2026-09-06T10:00:00.000Z",
      fromId: from.id,
      to: { kind: "masters" },
      projectId: "job-hillerodsholm",
      sourceLang: from.language,
      original: "Brug for mester",
      translations: { da: "Brug for mester", [from.language]: "Brug for mester" },
    };
    for (const m of masters) assert.equal(chatVisible(toMasters, m, assignments), true, `${m.name} ser masters-chat`);
    for (const c of crew) {
      if (c.id === from.id) continue;
      assert.equal(chatVisible(toMasters, c, assignments), false);
    }
  }
});

test("simulation: billeder gemmes kun som Drive file_id — ingen dataUrl", () => {
  const fat: ChatMessage = {
    id: "ch-pic",
    at: "2026-09-06T10:00:00.000Z",
    fromId: "emp-federico",
    to: { kind: "employee", id: "emp-ole" },
    projectId: "job-hillerodsholm",
    sourceLang: "es",
    original: "foto",
    translations: completeTranslations("foto", "es"),
    photos: [
      { id: "ph-1", name: "mur.jpg", dataUrl: "data:image/jpeg;base64,AAAA", driveFileId: "drv-abc123" },
    ],
  };
  const slim = slimChat(fat);
  assert.equal(slim.photos?.[0]?.driveFileId, "drv-abc123");
  assert.equal(slim.photos?.[0]?.dataUrl, "");
  const only = driveOnlyPhotos(fat.photos);
  assert.equal(only?.[0]?.driveFileId, "drv-abc123");
  assert.equal(only?.[0]?.dataUrl, undefined);
});

test("simulation: Hillerødsholm oversættes ikke væk i completeTranslations-kilde", () => {
  const original = "Mørtel i morgen på Hillerødsholm";
  const got = completeTranslations(original, "da", { da: original, ro: "Mortar mâine la Hillerødsholm" });
  assert.match(got.da ?? "", /Hillerødsholm/);
  assert.match(got.ro ?? "", /Hillerødsholm/);
});
