import assert from "node:assert/strict";
import test from "node:test";
import { fileHref, isGoogleUrl } from "./plads-file.ts";

test("fileHref never returns Google Drive", () => {
  assert.equal(isGoogleUrl("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(fileHref("https://drive.google.com/file/d/abc/view"), "");
  assert.equal(fileHref("https://drive.google.com/drive/folders/abc"), "");
  assert.equal(fileHref("https://lh3.googleusercontent.com/d/abc"), "");
  assert.equal(fileHref(""), "");
  const sb = fileHref("https://jauggqxhemjnbxoxkpeh.supabase.co/storage/v1/object/public/plads/job-x/ks/a.jpg");
  assert.match(sb, /supabase\.co/);
});
