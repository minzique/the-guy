import assert from "node:assert/strict";
import test from "node:test";

import { getPiPackAssetsRoot, getPiPackManifestPath, getPiPackRootPath, loadPiPackManifest } from "./index.js";

test("pi pack helpers resolve pack paths", () => {
  assert.match(getPiPackRootPath(), /packages\/guy-pi-pack$/);
  assert.match(getPiPackManifestPath(), /packages\/guy-pi-pack\/pack\.json$/);
  assert.match(getPiPackAssetsRoot(), /packages\/guy-pi-pack\/assets$/);
});

test("pi pack manifest loads the shipped asset set", () => {
  const manifest = loadPiPackManifest();

  assert.equal(manifest.id, "pi-pack");
  assert.equal(manifest.packageName, "@the-guy/pi-pack");
  assert.equal(manifest.assets.length > 250, true);
});
