import assert from "node:assert/strict";
import test from "node:test";

import { getAssetsSchemaPath, getPackSchemaPath, getProfileSchemaPath, isSelectableProfile } from "./index.js";

test("schema helpers return json paths", () => {
  assert.match(getProfileSchemaPath(), /profile\.schema\.json$/);
  assert.match(getAssetsSchemaPath(), /assets\.schema\.json$/);
  assert.match(getPackSchemaPath(), /pack\.schema\.json$/);
});

test("only shipping selectable profiles are user visible", () => {
  assert.equal(isSelectableProfile({ selectable: true, status: "shipping" }), true);
  assert.equal(isSelectableProfile({ selectable: false, status: "shipping" }), false);
  assert.equal(isSelectableProfile({ selectable: true, status: "deferred" }), false);
});
