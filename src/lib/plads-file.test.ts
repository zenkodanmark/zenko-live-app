import assert from "node:assert/strict";
import test from "node:test";
import { fileHref, isGoogleUrl } from "./plads-file.ts";
import { UD_CAD_EXTS, UD_FILE_ACCEPT, mimeForUdFile, udFallbackName, udFileKind, udFilePreviewable } from "./ud-folders.ts";

test("fileHref never returns Google Drive", () => {
  assert.equal(isGoogleUrl("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(fileHref("https://drive.google.com/file/d/abc/view"), "");
  assert.equal(fileHref("https://drive.google.com/drive/folders/abc"), "");
  assert.equal(fileHref("https://lh3.googleusercontent.com/d/abc"), "");
  assert.equal(fileHref(""), "");
  const sb = fileHref("https://jauggqxhemjnbxoxkpeh.supabase.co/storage/v1/object/public/plads/job-x/ks/a.jpg");
  assert.match(sb, /supabase\.co/);
});

test("UD file-accept includes 3D and Scaniverse", () => {
  for (const ext of ["3dm", "skp", "obj", "fbx", "dwg", "dxf", "ifc", "step", "stl", "glb", "gltf"]) {
    assert.ok(UD_CAD_EXTS.includes(ext as (typeof UD_CAD_EXTS)[number]), ext);
    assert.ok(UD_FILE_ACCEPT.includes(`.${ext}`), ext);
  }
  assert.ok(UD_FILE_ACCEPT.includes("model/gltf-binary"));
  assert.ok(UD_FILE_ACCEPT.includes(".pdf"));
});

test("UD file kind: 3D gets model, not image", () => {
  assert.equal(udFileKind("scan.glb"), "model");
  assert.equal(udFileKind("scan.gltf"), "model");
  assert.equal(udFileKind("hus.3dm"), "model");
  assert.equal(udFileKind("facade.skp"), "model");
  assert.equal(udFileKind("mesh.obj"), "model");
  assert.equal(udFileKind("", "model/gltf-binary"), "model");
  assert.equal(udFileKind("mur.jpg"), "image");
  assert.equal(udFileKind("film.mp4"), "video");
  assert.equal(udFileKind("kontrakt.pdf"), "pdf");
  assert.equal(udFilePreviewable("image"), true);
  assert.equal(udFilePreviewable("model"), false);
  assert.equal(mimeForUdFile("scan.glb"), "model/gltf-binary");
  assert.equal(udFallbackName({ type: "model/gltf-binary" }), "scaniverse.glb");
});
