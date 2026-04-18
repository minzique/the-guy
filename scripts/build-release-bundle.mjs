import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const artifactRoot = path.join(rootDir, ".artifacts");
const bundleName = `the-guy-${packageJson.version}`;
const bundleDir = path.join(artifactRoot, bundleName);
const archivePath = path.join(artifactRoot, `${bundleName}.tar.gz`);

const appDist = path.join(rootDir, "apps", "guy-installer", "dist");
const workspacePackages = [
  "guy-core",
  "guy-doctor",
  "guy-profile-schema",
  "guy-auth-claude",
  "guy-auth-codex"
];

function shouldIncludeDistEntry(sourcePath) {
  return !sourcePath.endsWith(".map") && !sourcePath.includes(".test.");
}

function copyFiltered(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    filter: shouldIncludeDistEntry
  });
}

if (!existsSync(appDist)) {
  throw new Error(`Build output missing: ${appDist}`);
}

for (const packageName of workspacePackages) {
  const distPath = path.join(rootDir, "packages", packageName, "dist");
  if (!existsSync(distPath)) {
    throw new Error(`Build output missing: ${distPath}`);
  }
}

rmSync(bundleDir, { force: true, recursive: true });
mkdirSync(artifactRoot, { recursive: true });
mkdirSync(bundleDir, { recursive: true });

for (const relativePath of ["README.md", "package.json", "install.sh", "apps/guy-installer/package.json", "profiles"]) {
  const source = path.join(rootDir, relativePath);
  if (!existsSync(source)) {
    continue;
  }

  const destination = path.join(bundleDir, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

copyFiltered(path.join(rootDir, "apps", "guy-installer", "dist"), path.join(bundleDir, "apps", "guy-installer", "dist"));

const nodeModulesScopeDir = path.join(bundleDir, "node_modules", "@the-guy");
mkdirSync(nodeModulesScopeDir, { recursive: true });

for (const packageName of workspacePackages) {
  const sourceDir = path.join(rootDir, "packages", packageName);
  const packageJsonPath = path.join(sourceDir, "package.json");
  const destinationDir = path.join(nodeModulesScopeDir, packageName.replace(/^guy-/, ""));

  mkdirSync(destinationDir, { recursive: true });
  copyFiltered(path.join(sourceDir, "dist"), path.join(destinationDir, "dist"));
  cpSync(packageJsonPath, path.join(destinationDir, "package.json"));

  if (packageName === "guy-profile-schema") {
    cpSync(path.join(sourceDir, "schema"), path.join(destinationDir, "schema"), { recursive: true });
  }
}

const binDir = path.join(bundleDir, "bin");
mkdirSync(binDir, { recursive: true });
const launcherPath = path.join(binDir, "guy");
writeFileSync(
  launcherPath,
  "#!/usr/bin/env bash\nset -euo pipefail\nDIR=\"$(cd \"$(dirname \"$0\")/..\" && pwd)\"\nexec node \"$DIR/apps/guy-installer/dist/cli.js\" \"$@\"\n"
);
chmodSync(launcherPath, 0o755);

const tarResult = spawnSync("tar", ["-czf", archivePath, "-C", artifactRoot, bundleName], {
  cwd: rootDir,
  stdio: "inherit"
});

if ((tarResult.status ?? 1) !== 0) {
  process.exit(tarResult.status ?? 1);
}

console.log(`Created ${archivePath}`);
