import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const searchRoots = ["apps", "packages"];
const testFiles = new Set();

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules") {
      continue;
    }

    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (entry.endsWith(".test.js") && entryPath.includes(`${path.sep}dist${path.sep}`)) {
      testFiles.add(entryPath);
    }
  }
}

for (const searchRoot of searchRoots) {
  const absoluteRoot = path.join(rootDir, searchRoot);
  if (existsSync(absoluteRoot)) {
    walk(absoluteRoot);
  }
}

const files = Array.from(testFiles).sort();

if (files.length === 0) {
  console.log("No compiled test files found.");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
