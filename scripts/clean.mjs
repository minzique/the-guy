import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const scanRoots = ["apps", "packages"];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules") {
      continue;
    }

    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      if (entry === "dist") {
        rmSync(entryPath, { force: true, recursive: true });
        continue;
      }
      walk(entryPath);
      continue;
    }

    if (entry === "tsconfig.tsbuildinfo") {
      rmSync(entryPath, { force: true });
    }
  }
}

for (const scanRoot of scanRoots) {
  const absoluteRoot = path.join(rootDir, scanRoot);
  if (existsSync(absoluteRoot)) {
    walk(absoluteRoot);
  }
}
