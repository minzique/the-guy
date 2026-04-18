import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { GuyPackManifest, GuyPiPackReference } from "@the-guy/profile-schema";

export function getPiPackRootPath(): string {
  return path.resolve(fileURLToPath(new URL("..", import.meta.url)));
}

export function getPiPackManifestPath(): string {
  return path.join(getPiPackRootPath(), "pack.json");
}

export function getPiPackAssetsRoot(): string {
  return path.join(getPiPackRootPath(), "assets");
}

export function loadPiPackManifest(expectedReference?: GuyPiPackReference): GuyPackManifest {
  const manifest = JSON.parse(readFileSync(getPiPackManifestPath(), "utf8")) as GuyPackManifest;

  if (expectedReference && manifest.id !== expectedReference.id) {
    throw new Error(`Pi pack id mismatch: expected ${expectedReference.id}, got ${manifest.id}`);
  }

  if (expectedReference && manifest.packVersion !== expectedReference.version) {
    throw new Error(
      `Pi pack version mismatch for ${manifest.id}: expected ${expectedReference.version}, got ${manifest.packVersion}`
    );
  }

  return manifest;
}

export function resolvePiPackAssetSourcePath(source: string): string {
  return path.join(getPiPackRootPath(), source.replace(/^\.\//u, ""));
}
