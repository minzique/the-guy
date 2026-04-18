import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createInstallState,
  detectSupportedPlatform,
  installProfile,
  loadAssetManifest,
  resolveManagedAssets,
  loadProfileManifest,
  loadResolvedProfileManifest,
  readInstallState,
  repairInstalledProfile,
  resolveGuyPaths,
  resolveHomePath
} from "./index.js";

process.env.GUY_SKIP_MANAGED_INSTALLS = "1";
process.env.GUY_SKIP_PI_PACKAGE_SYNC = "1";

test("resolveGuyPaths respects an explicit home directory", () => {
  const paths = resolveGuyPaths("/tmp/the-guy-home");

  assert.equal(paths.rootDir, "/tmp/the-guy-home/.guy");
  assert.equal(paths.installStateFile, "/tmp/the-guy-home/.guy/state/install.json");
  assert.equal(paths.doctorLogFile, "/tmp/the-guy-home/.guy/logs/doctor.log");
});

test("detectSupportedPlatform recognizes WSL separately from generic linux", () => {
  assert.equal(detectSupportedPlatform("linux", {}), null);
  assert.equal(detectSupportedPlatform("linux", { WSL_DISTRO_NAME: "Ubuntu" }), "linux-wsl");
});

test("createInstallState fills the default dogfood state", () => {
  const state = createInstallState({
    version: "0.1.0",
    profileId: "power-user",
    platform: "darwin"
  });

  assert.equal(state.channel, "dogfood");
  assert.equal(state.platform, "darwin");
  assert.equal(state.health, "uninitialized");
});

test("profile manifests and asset manifests load from the bundled profile tree", () => {
  const profile = loadProfileManifest("power-user");
  const assets = loadAssetManifest("power-user", profile);

  assert.equal(profile.id, "power-user");
  assert.equal(profile.assetManifest, "./assets.json");
  assert.equal(assets.profileId, "power-user");
  assert.equal(assets.assets.length > 250, true);
});

test("power-user resolves managed assets from the canonical pi pack", () => {
  const assets = resolveManagedAssets("power-user", "/tmp/the-guy-home");
  const settingsAsset = assets.find((asset) => asset.destinationPath.endsWith("/.pi/agent/settings.json"));

  assert.ok(settingsAsset);
  assert.match(settingsAsset.sourcePath, /guy-pi-pack[\\/]assets[\\/]\.pi[\\/]agent[\\/]settings\.json$/);
});

test("resolveHomePath expands tilde destinations against the explicit home", () => {
  assert.equal(resolveHomePath("~/test.txt", "/tmp/guy-home"), "/tmp/guy-home/test.txt");
  assert.equal(resolveHomePath("/tmp/already-absolute"), "/tmp/already-absolute");
});

test("loadResolvedProfileManifest merges inherited base metadata", () => {
  const profile = loadResolvedProfileManifest("power-user");

  assert.equal(profile.id, "power-user");
  assert.equal(profile.binaryRequirements.some((requirement) => requirement.id === "pi"), true);
  assert.equal(profile.doctorChecks.includes("platform"), true);
});

test("installProfile copies bundled assets and writes install state", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-core-"));
  const result = installProfile("power-user", tempHome);
  const state = readInstallState(tempHome);

  assert.equal(result.state.profileId, "power-user");
  assert.match(result.state.health, /^(ready|degraded)$/);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "settings.json")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "AGENTS.md")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "agents", "scout.md")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "extensions", "context-awareness.ts")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "skills", "think", "SKILL.md")), true);
  assert.equal(
    existsSync(path.join(tempHome, ".guy", "rendered", "power-user", "assets.json")),
    true
  );
  assert.notEqual(state, null);
  assert.equal(state?.managedAssetHash.length, 64);
});

test("repairInstalledProfile re-copies a missing managed asset", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-repair-"));
  const scoutDestination = path.join(tempHome, ".pi", "agent", "agents", "scout.md");

  installProfile("power-user", tempHome);
  rmSync(scoutDestination);
  assert.equal(existsSync(scoutDestination), false);

  repairInstalledProfile(tempHome);
  assert.equal(existsSync(scoutDestination), true);
});

test("repairInstalledProfile fails cleanly when there is no prior install", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-repair-empty-"));

  assert.throws(() => repairInstalledProfile(tempHome), /No install state found/);
});
