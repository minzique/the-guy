import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { installProfile } from "@the-guy/core";

process.env.GUY_SKIP_MANAGED_INSTALLS = "1";
process.env.GUY_SKIP_PI_PACKAGE_SYNC = "1";
process.env.GUY_SKIP_POST_INSTALL = "1";

import { getDefaultDoctorChecks, runDoctor } from "./index.js";

test("doctor contract includes the core readiness checks", () => {
  const checks = getDefaultDoctorChecks("/tmp/the-guy-home");
  const ids = checks.map((check) => check.id);

  assert.deepEqual(ids, [
    "runtime-state",
    "managed-assets",
    "pi",
    "claude-auth",
    "codex-auth",
    "platform"
  ]);
});

test("runDoctor reports pass for runtime state and managed assets after install", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-doctor-"));

  installProfile("power-user", tempHome);
  const results = runDoctor(tempHome);

  const runtimeState = results.find((result) => result.id === "runtime-state");
  const managedAssets = results.find((result) => result.id === "managed-assets");

  assert.equal(runtimeState?.status, "pass");
  assert.equal(managedAssets?.status, "pass");
});
