import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));

test("CLI install writes state and copies the first shipped assets", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-cli-"));
  const env = {
    ...process.env,
    GUY_HOME: tempHome,
    GUY_SKIP_MANAGED_INSTALLS: "1",
    GUY_SKIP_PI_PACKAGE_SYNC: "1"
  };

  const install = spawnSync(process.execPath, [cliPath, "install"], {
    env,
    encoding: "utf8"
  });

  assert.match(String(install.status), /^(0|1)$/);

  const statePath = path.join(tempHome, ".guy", "state", "install.json");
  const renderedAssetsPath = path.join(tempHome, ".guy", "rendered", "power-user", "assets.json");
  const piSettingsPath = path.join(tempHome, ".pi", "agent", "settings.json");
  const scoutAgentPath = path.join(tempHome, ".pi", "agent", "agents", "scout.md");

  assert.equal(existsSync(statePath), true);
  assert.equal(existsSync(renderedAssetsPath), true);
  assert.equal(existsSync(piSettingsPath), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "AGENTS.md")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "extensions", "context-awareness.ts")), true);
  assert.equal(existsSync(path.join(tempHome, ".pi", "agent", "skills", "think", "SKILL.md")), true);
  assert.equal(existsSync(scoutAgentPath), true);

  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    profileId: string;
    health: string;
  };

  assert.equal(state.profileId, "power-user");
  assert.match(state.health, /^(ready|degraded)$/);

  const status = spawnSync(process.execPath, [cliPath, "status"], {
    env,
    encoding: "utf8"
  });

  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /profile: power-user/);
  assert.match(status.stdout, /health: (ready|degraded)/);
});

test("CLI repair restores a deleted managed asset", () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-cli-repair-"));
  const env = {
    ...process.env,
    GUY_HOME: tempHome,
    GUY_SKIP_MANAGED_INSTALLS: "1",
    GUY_SKIP_PI_PACKAGE_SYNC: "1"
  };
  const scoutAgentPath = path.join(tempHome, ".pi", "agent", "agents", "scout.md");

  const install = spawnSync(process.execPath, [cliPath, "install"], {
    env,
    encoding: "utf8"
  });

  assert.match(String(install.status), /^(0|1)$/);
  rmSync(scoutAgentPath);
  assert.equal(existsSync(scoutAgentPath), false);

  const repair = spawnSync(process.execPath, [cliPath, "repair"], {
    env,
    encoding: "utf8"
  });

  assert.match(String(repair.status), /^(0|1)$/);
  assert.equal(existsSync(scoutAgentPath), true);
});
