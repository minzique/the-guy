import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const targetRoot = path.join(repoRoot, "profiles", "power-user", "assets", ".pi", "agent");
const targetProfileRoot = path.join(repoRoot, "profiles", "power-user");

function resolveSourceRoot() {
  if (process.env.THE_GUY_PI_SOURCE) {
    return process.env.THE_GUY_PI_SOURCE;
  }

  const siblingDotfiles = path.resolve(repoRoot, "..", "dotfiles-agents", "home", ".pi", "agent");
  if (existsSync(siblingDotfiles)) {
    return siblingDotfiles;
  }

  throw new Error(
    "Could not locate the upstream Pi payload source. Set THE_GUY_PI_SOURCE or check out dotfiles-agents beside the-guy."
  );
}

const sourceRoot = resolveSourceRoot();

const DIRECTORIES_TO_SYNC = [
  "agents",
  "prompts",
  "skills"
];

const FILES_TO_SYNC = [];
const EXCLUDED_RELATIVE_PATHS = [
  path.join("skills", "linear")
];

const EXTENSIONS_TO_SYNC = [
  path.join("extensions", "_shared"),
  path.join("extensions", "context-awareness.ts"),
  path.join("extensions", "session-browser"),
  path.join("extensions", "subagent")
];

const FILTERED_DIRECTORY_NAMES = new Set(["node_modules", ".git", "dist"]);

function copyPath(relativePath) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const destinationPath = path.join(targetRoot, relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source path: ${sourcePath}`);
  }

  rmSync(destinationPath, { force: true, recursive: true });
  mkdirSync(path.dirname(destinationPath), { recursive: true });

  cpSync(sourcePath, destinationPath, {
    recursive: true,
    filter: (itemPath) => !FILTERED_DIRECTORY_NAMES.has(path.basename(itemPath))
  });
}

function walkFiles(directoryPath) {
  const files = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (FILTERED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function regenerateAssetManifest() {
  const assetsRoot = path.join(targetProfileRoot, "assets");
  const files = walkFiles(assetsRoot).sort((left, right) => left.localeCompare(right));
  const usedIds = new Set();

  const assets = files.map((filePath) => {
    const source = `./${path.relative(targetProfileRoot, filePath).split(path.sep).join("/")}`;
    const destination = `~/${path.relative(assetsRoot, filePath).split(path.sep).join("/")}`;

    let id = destination
      .replace(/^~\//, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    const baseId = id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix++}`;
    }
    usedIds.add(id);

    return {
      id,
      source,
      destination,
      strategy: "copy",
      required: true
    };
  });

  writeFileSync(
    path.join(targetProfileRoot, "assets.json"),
    `${JSON.stringify({ version: "0.1", profileId: "power-user", assets }, null, 2)}\n`
  );

  return assets.length;
}

function main() {
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(`Source root not found: ${sourceRoot}`);
  }

  mkdirSync(targetRoot, { recursive: true });

  for (const relativePath of FILES_TO_SYNC) {
    copyPath(relativePath);
  }

  for (const relativePath of DIRECTORIES_TO_SYNC) {
    copyPath(relativePath);
  }

  for (const relativePath of EXTENSIONS_TO_SYNC) {
    copyPath(relativePath);
  }

  for (const relativePath of EXCLUDED_RELATIVE_PATHS) {
    rmSync(path.join(targetRoot, relativePath), { force: true, recursive: true });
  }

  const assetCount = regenerateAssetManifest();
  console.log(`Synced power-user Pi payload from ${sourceRoot}`);
  console.log(`Regenerated profiles/power-user/assets.json with ${assetCount} assets`);
}

main();
