import assert from "node:assert/strict";
import test from "node:test";
import { buildSagBrief } from "./sag-brief.ts";

test("info-skærm summerer mail, chat, to-do og møde", () => {
  const brief = buildSagBrief({
    projectName: "Hillerødsholm",
    mail: {
      count: 1,
      headline: "Sikkerhedsmøde 9 afholdt 2. sep. Næste 16. sep.",
      live: false,
      items: [{ id: "1", from: "Ole Jepsen", subject: "Byggemødereferat nr. 15", date: "31.08.2026", snippet: "Næste 2. sep." }],
    },
    chats: [{ at: "2026-09-03T08:12:00.000Z", from: "Marius", text: "Hvad med det gamle stål?" }],
    todos: [
      { title: "Opryd bag blok A", who: "Osvaldo", done: false, due: "2026-09-03" },
      { title: "Afdæk murkrone", who: "Alex", done: true, due: "2026-09-02" },
    ],
    slips: [{ number: "Z-AS-2026-005", title: "Udkradsning skorsten" }],
    tfs: [{ number: "Z-TF-2026-005", title: "Pudset facade", answered: false }],
    ents: [],
    ks: [{ number: "Z-KS-2026-004", point: "5.5" }],
    meetings: [{ name: "260826-267_BM15.pdf" }],
    cal: [{ title: "Byggemøde Hillerødsholm", at: "2026-09-09T07:30:00.000Z" }],
    crew: [
      { name: "Osvaldo", in: true },
      { name: "Ion", in: true },
      { name: "Alex", in: false },
    ],
  });
  assert.match(brief.headline, /Osvaldo/);
  assert.match(brief.headline, /1 åbne to-do/);
  assert.match(brief.headline, /16\. sep/);
  assert.match(brief.headline, /TF uden svar/);
  const titles = brief.sections.map((s) => s.title);
  assert.deepEqual(titles, ["Mail", "Chat", "To-do", "Møder og referater", "Rapporter"]);
  assert.ok(brief.pack.includes("Z-AS-2026-005"));
  assert.ok(!brief.pack.includes("Afdæk murkrone"));
});
