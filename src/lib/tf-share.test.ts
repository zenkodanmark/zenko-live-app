import assert from "node:assert/strict";
import test from "node:test";
import { buildTfSharePayload, isShareToken, photoSrc, tfMailCopy, tfSharePath } from "./tf-share.ts";
import type { FieldItem, Project, Tf } from "./types.ts";

test("kun uuid-tokens er gyldige", () => {
  assert.equal(isShareToken("8f14e45f-ea9d-4e3d-8c1a-2b3c4d5e6f70"), true);
  assert.equal(isShareToken("not-a-token"), false);
  assert.equal(isShareToken(""), false);
  assert.equal(isShareToken("../mester"), false);
});

test("photoSrc tager offentlige stier og dropper kæmpe data-urls", () => {
  assert.equal(photoSrc({ dataUrl: "/tf-grok/facade.jpg" }), "/tf-grok/facade.jpg");
  assert.equal(photoSrc({ driveUrl: "https://drive.google.com/file/d/abc/view" }), "https://lh3.googleusercontent.com/d/abc=w1600");
  assert.equal(photoSrc({ driveFileId: "abc" }), "https://lh3.googleusercontent.com/d/abc=w1600");
  assert.equal(photoSrc({ dataUrl: "https://drive.google.com/uc?export=view&id=abc" }), "https://lh3.googleusercontent.com/d/abc=w1600");
  assert.equal(photoSrc({ dataUrl: `data:image/jpeg;base64,${"a".repeat(2_000_000)}` }), null);
});

test("payload og mailtekst peger kun på rapporten", () => {
  const tf: Tf = {
    id: "tf-1",
    number: "Z-TF-2026-005",
    projectId: "job-hillerodsholm",
    title: "Pudset facade haveside",
    question: "Vil I gøre noget nu?",
    createdAt: "2026-09-03T10:35:00.000Z",
    status: "issued",
    answered: false,
    photoIds: ["fld-1"],
  };
  const job = { name: "Hillerødsholm", address: "Selskovvej 24", customer: "Ole Jepsen A/S" } as Project;
  const items = [{ id: "fld-1", name: "facade.jpg", dataUrl: "/tf-grok/facade.jpg" } as FieldItem];
  const payload = buildTfSharePayload(tf, job, items);
  assert.equal(payload.photos[0]?.src, "/tf-grok/facade.jpg");
  const url = `https://zenko.example${tfSharePath("8f14e45f-ea9d-4e3d-8c1a-2b3c4d5e6f70")}`;
  const mail = tfMailCopy(payload, url);
  assert.match(mail.subject, /Z-TF-2026-005/);
  assert.match(mail.body, /kun rapporten/);
  assert.match(mail.body, /\/tf\/8f14e45f-ea9d-4e3d-8c1a-2b3c4d5e6f70/);
  assert.doesNotMatch(mail.body, /\/mester/);
  assert.doesNotMatch(mail.body, /chatbot/i);
});
