import { fileURLToPath } from "node:url";

export const CHANNELS = ["dogfood", "beta", "stable"] as const;
export type Channel = (typeof CHANNELS)[number];

export const UI_MODES = ["standard", "terminal-first", "guided"] as const;
export type UiMode = (typeof UI_MODES)[number];

export const PROFILE_STATUSES = ["internal", "shipping", "deferred"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const SUPPORTED_PLATFORMS = ["darwin", "linux-wsl", "linux-container"] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const MANAGED_TOOLS = ["claude", "codex", "pi", "gh"] as const;
export type ManagedTool = (typeof MANAGED_TOOLS)[number];

export const DOCTOR_CHECK_IDS = [
  "runtime-state",
  "managed-assets",
  "pi",
  "claude-auth",
  "codex-auth",
  "platform"
] as const;
export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];

export const HEALTH_STATES = ["uninitialized", "ready", "degraded", "broken"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export const ASSET_STRATEGIES = ["copy"] as const;
export type AssetStrategy = (typeof ASSET_STRATEGIES)[number];

export interface BinaryRequirement {
  id: string;
  displayName: string;
  required: boolean;
  managedByGuy: boolean;
  verifyCommand?: string;
  installCommand?: string;
  installHint?: string;
}

export interface PostInstallTask {
  id: string;
  cwd: string;
  run: string;
  optional?: boolean;
}

export interface ManagedAsset {
  id: string;
  source: string;
  destination: string;
  strategy: AssetStrategy;
  required: boolean;
  templateContext?: string[];
}

export interface GuyAssetManifest {
  version: "0.1";
  profileId: string;
  assets: ManagedAsset[];
}

export interface GuyPiPackReference {
  id: string;
  version: string;
}

export interface GuyPackManifest {
  version: "0.1";
  id: string;
  displayName: string;
  packageName: string;
  packVersion: string;
  minimumRuntimeVersion: string;
  maximumTestedRuntimeVersion: string;
  assets: ManagedAsset[];
}

export interface GuyProfileManifest {
  version: "0.1";
  id: string;
  displayName: string;
  description: string;
  status: ProfileStatus;
  inherits?: string[];
  supportedPlatforms: SupportedPlatform[];
  uiMode: UiMode;
  channel: Channel;
  selectable: boolean;
  managedTools: ManagedTool[];
  binaryRequirements: BinaryRequirement[];
  piPack?: GuyPiPackReference;
  assetManifest?: string;
  doctorChecks: DoctorCheckId[];
  postInstall?: PostInstallTask[];
}

export interface GuyInstallState {
  version: string;
  profileId: string;
  channel: Channel;
  platform: SupportedPlatform;
  installedAt: string;
  updatedAt: string;
  managedAssetHash: string;
  health: HealthState;
}

export function getProfileSchemaPath(): string {
  return fileURLToPath(new URL("../schema/profile.schema.json", import.meta.url));
}

export function getAssetsSchemaPath(): string {
  return fileURLToPath(new URL("../schema/assets.schema.json", import.meta.url));
}

export function getPackSchemaPath(): string {
  return fileURLToPath(new URL("../schema/pack.schema.json", import.meta.url));
}

export function isSelectableProfile(profile: Pick<GuyProfileManifest, "selectable" | "status">): boolean {
  return profile.selectable && profile.status === "shipping";
}
