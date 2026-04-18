import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoPackage = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));

const packRoot = path.join(repoRoot, "packages", "guy-pi-pack");
const packAssetsRoot = path.join(packRoot, "assets");
const packAgentRoot = path.join(packAssetsRoot, ".pi", "agent");

const targetProfileRoot = path.join(repoRoot, "profiles", "power-user");
const targetProfileAssetsRoot = path.join(targetProfileRoot, "assets");

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

const DIRECTORIES_TO_SYNC = ["agents", "prompts", "skills"];
const FILES_TO_SYNC = [];
const EXCLUDED_RELATIVE_PATHS = [path.join("skills", "linear")];
const REPO_OWNED_FILE_PATHS = [path.join("skills", "team-debate", "SKILL.md")];
const EXTENSIONS_TO_SYNC = [
  path.join("extensions", "_shared"),
  path.join("extensions", "context-awareness.ts"),
  path.join("extensions", "session-browser"),
  path.join("extensions", "subagent")
];
const FILTERED_DIRECTORY_NAMES = new Set(["node_modules", ".git", "dist"]);

function copyPath(relativePath, destinationRoot) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);

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

function snapshotRepoOwnedFiles(rootDirectory) {
  return new Map(
    REPO_OWNED_FILE_PATHS.flatMap((relativePath) => {
      const absolutePath = path.join(rootDirectory, relativePath);
      if (!existsSync(absolutePath)) {
        return [];
      }

      return [[relativePath, readFileSync(absolutePath, "utf8")]];
    })
  );
}

function restoreRepoOwnedFiles(rootDirectory, snapshots) {
  for (const [relativePath, contents] of snapshots) {
    const absolutePath = path.join(rootDirectory, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }
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

function buildManagedAssets(manifestRoot, assetsRoot) {
  const files = walkFiles(assetsRoot).sort((left, right) => left.localeCompare(right));
  const usedIds = new Set();

  return files.map((filePath) => {
    const source = `./${path.relative(manifestRoot, filePath).split(path.sep).join("/")}`;
    const destination = `~/${path.relative(assetsRoot, filePath).split(path.sep).join("/")}`;

    let id = destination
      .replace(/^~\//u, "")
      .replace(/[^a-zA-Z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
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
}

function synchronizeVersionReferences() {
  const packPackageJsonPath = path.join(packRoot, "package.json");
  const packPackage = JSON.parse(readFileSync(packPackageJsonPath, "utf8"));
  const profileManifestPath = path.join(targetProfileRoot, "profile.json");
  const profileManifest = JSON.parse(readFileSync(profileManifestPath, "utf8"));

  packPackage.version = repoPackage.version;
  profileManifest.piPack = {
    ...(profileManifest.piPack ?? {}),
    id: "pi-pack",
    version: repoPackage.version
  };

  writeFileSync(packPackageJsonPath, `${JSON.stringify(packPackage, null, 2)}\n`);
  writeFileSync(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`);
}

function regeneratePackManifest() {
  const assets = buildManagedAssets(packRoot, packAssetsRoot);
  const packManifest = {
    version: "0.1",
    id: "pi-pack",
    displayName: "The Guy Pi Pack",
    packageName: "@the-guy/pi-pack",
    packVersion: repoPackage.version,
    minimumRuntimeVersion: "0.1.0",
    maximumTestedRuntimeVersion: "0.1.x",
    assets
  };

  writeFileSync(path.join(packRoot, "pack.json"), `${JSON.stringify(packManifest, null, 2)}\n`);
  return assets.length;
}

function mirrorPackIntoProfile() {
  rmSync(targetProfileAssetsRoot, { force: true, recursive: true });
  mkdirSync(path.dirname(targetProfileAssetsRoot), { recursive: true });
  cpSync(packAssetsRoot, targetProfileAssetsRoot, {
    recursive: true,
    filter: (itemPath) => !FILTERED_DIRECTORY_NAMES.has(path.basename(itemPath))
  });
}

function regenerateProfileAssetManifest() {
  const assets = buildManagedAssets(targetProfileRoot, targetProfileAssetsRoot);

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

  mkdirSync(packAgentRoot, { recursive: true });
  const repoOwnedSnapshots = snapshotRepoOwnedFiles(packAgentRoot);

  for (const relativePath of FILES_TO_SYNC) {
    copyPath(relativePath, packAgentRoot);
  }

  for (const relativePath of DIRECTORIES_TO_SYNC) {
    copyPath(relativePath, packAgentRoot);
  }

  for (const relativePath of EXTENSIONS_TO_SYNC) {
    copyPath(relativePath, packAgentRoot);
  }

  for (const relativePath of EXCLUDED_RELATIVE_PATHS) {
    rmSync(path.join(packAgentRoot, relativePath), { force: true, recursive: true });
  }

  restoreRepoOwnedFiles(packAgentRoot, repoOwnedSnapshots);
  synchronizeVersionReferences();

  const packAssetCount = regeneratePackManifest();
  mirrorPackIntoProfile();
  const profileAssetCount = regenerateProfileAssetManifest();

  console.log(`Synced power-user Pi payload from ${sourceRoot}`);
  console.log(`Regenerated packages/guy-pi-pack/pack.json with ${packAssetCount} assets`);
  console.log(`Mirrored canonical pack assets into profiles/power-user/assets/`);
  console.log(`Regenerated profiles/power-user/assets.json with ${profileAssetCount} assets`);
}

main();
