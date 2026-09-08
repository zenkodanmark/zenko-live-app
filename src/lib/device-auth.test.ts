import assert from "node:assert/strict";
import test from "node:test";
import { pathForRole } from "./device-auth.ts";

test("mester går til mester-tavlen, ansat til felt", () => {
  assert.equal(pathForRole("mester"), "/mester");
  assert.equal(pathForRole("svend"), "/svend");
  assert.equal(pathForRole("laerling"), "/svend");
});
