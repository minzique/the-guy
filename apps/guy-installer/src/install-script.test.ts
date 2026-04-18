import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const installScriptPath = path.join(rootDir, "install.sh");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
  version: string;
};
const bundleName = `the-guy-${packageJson.version}.tar.gz`;
const bundlePath = path.join(rootDir, ".artifacts", bundleName);

function ensureBundle(): void {
  if (existsSync(bundlePath)) {
    return;
  }

  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts", "build-release-bundle.mjs")], {
    cwd: rootDir,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(bundlePath), true);
}

function runInstall(args: string[], homeDirectory: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync("bash", [installScriptPath, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeDirectory,
      ...extraEnv
    }
  });
}

function runGuyStatus(homeDirectory: string) {
  return spawnSync(path.join(homeDirectory, ".local", "bin", "guy"), ["status"], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeDirectory
    }
  });
}

async function withServer(
  mode: "url" | "release",
  run: (baseUrl: string) => Promise<void> | void
): Promise<void> {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
const http = require('node:http');
const fs = require('node:fs');
const bundle = fs.readFileSync(process.env.BUNDLE_PATH);
const bundleName = process.env.BUNDLE_NAME;
const version = process.env.BUNDLE_VERSION;
const mode = process.env.SERVER_MODE;
const server = http.createServer((request, response) => {
  if (
    mode === 'release' &&
    (
      request.url === '/api/repos/test-owner/the-guy/releases/latest' ||
      request.url === '/api/repos/test-owner/the-guy/releases/tags/v' + version
    )
  ) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      tag_name: 'v' + version,
      assets: [
        {
          name: bundleName,
          browser_download_url: 'http://127.0.0.1:' + server.address().port + '/' + bundleName,
        },
      ],
    }));
    return;
  }

  if (request.url === '/' + bundleName) {
    response.writeHead(200, { 'content-type': 'application/gzip' });
    response.end(bundle);
    return;
  }

  response.writeHead(404);
  response.end('not found');
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(String(server.address().port) + '\\n');
});
      `
    ],
    {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BUNDLE_PATH: bundlePath,
        BUNDLE_NAME: bundleName,
        BUNDLE_VERSION: packageJson.version,
        SERVER_MODE: mode
      }
    }
  );

  const port = await new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const line = stdout.split("\n")[0]?.trim();
      if (line) {
        resolve(line);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      reject(new Error(`test server exited early (${code}): ${stderr}`));
    });
    child.on("error", (error) => {
      reject(error);
    });
  });

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
}

test("install.sh installs from a local bundle path", () => {
  ensureBundle();
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-install-local-"));

  const install = runInstall(["--bundle", bundlePath, "--no-run"], tempHome);
  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stdout, /Installed launcher/);
  assert.equal(existsSync(path.join(tempHome, ".local", "bin", "guy")), true);
  assert.equal(existsSync(path.join(tempHome, ".guy", "current", "bin", "guy")), true);

  const status = runGuyStatus(tempHome);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /No install state found/);
});

test("install.sh installs from a bundle URL", async () => {
  ensureBundle();

  await withServer("url", async (baseUrl) => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-install-url-"));
    const install = runInstall(["--bundle", `${baseUrl}/${bundleName}`, "--no-run"], tempHome);
    assert.equal(install.status, 0, install.stderr);
    assert.equal(existsSync(path.join(tempHome, ".guy", "current", "bin", "guy")), true);
  });
});

test("install.sh resolves the latest release asset from the release API", async () => {
  ensureBundle();

  await withServer("release", async (baseUrl) => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-install-release-"));
    const install = runInstall(["--no-run"], tempHome, {
      THE_GUY_GITHUB_REPO: "test-owner/the-guy",
      THE_GUY_RELEASE_API_BASE: `${baseUrl}/api`,
      THE_GUY_SKIP_LOCAL_BUNDLE_LOOKUP: "1"
    });

    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stderr, /Resolving release asset/);
    assert.equal(existsSync(path.join(tempHome, ".guy", "current", "bin", "guy")), true);
  });
});

test("install.sh resolves a tagged release asset from the release API override", async () => {
  ensureBundle();

  await withServer("release", async (baseUrl) => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "the-guy-install-tagged-release-"));
    const install = runInstall(["--tag", `v${packageJson.version}`, "--no-run"], tempHome, {
      THE_GUY_GITHUB_REPO: "test-owner/the-guy",
      THE_GUY_RELEASE_API_BASE: `${baseUrl}/api`,
      THE_GUY_SKIP_LOCAL_BUNDLE_LOOKUP: "1"
    });

    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stderr, /Resolving release asset/);
    assert.equal(existsSync(path.join(tempHome, ".guy", "current", "bin", "guy")), true);
  });
});
