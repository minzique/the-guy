import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BinaryRequirement,
  Channel,
  GuyAssetManifest,
  GuyInstallState,
  GuyPackManifest,
  GuyPiPackReference,
  GuyProfileManifest,
  HealthState,
  PostInstallTask,
  ManagedAsset,
  SupportedPlatform
} from "@the-guy/profile-schema";
import { loadPiPackManifest, resolvePiPackAssetSourcePath } from "@the-guy/pi-pack";

export const GUY_DIRECTORY_NAME = ".guy";
export const V0_SUPPORTED_COMMANDS = ["install", "auth", "status", "doctor", "repair"] as const;
export type V0SupportedCommand = (typeof V0_SUPPORTED_COMMANDS)[number];
export type ProviderId = "claude" | "codex";

export interface GuyPaths {
  homeDirectory: string;
  rootDir: string;
  stateDir: string;
  installStateFile: string;
  logsDir: string;
  doctorLogFile: string;
  cacheDir: string;
  bundlesDir: string;
  renderedDir: string;
  backupsDir: string;
}

export interface RuntimeContract {
  version: string;
  defaultProfileId: string;
  defaultChannel: Channel;
  supportedPlatforms: readonly SupportedPlatform[];
  supportedCommands: readonly V0SupportedCommand[];
  stateFile: string;
}

export interface ProviderAuthContract {
  providerId: ProviderId;
  binaryName: string;
  loginCommand: readonly string[];
  statusCommand?: readonly string[];
  installManagedByGuy: boolean;
  installHint: string;
  supportedPlatforms: readonly SupportedPlatform[];
}

export interface CreateInstallStateOptions {
  version: string;
  profileId: string;
  channel?: Channel;
  health?: HealthState;
  installedAt?: Date;
  platform?: SupportedPlatform;
  managedAssetHash?: string;
}

export interface ResolvedManagedAsset extends ManagedAsset {
  sourcePath: string;
  destinationPath: string;
}

export interface InstallProfileResult {
  profile: GuyProfileManifest;
  assets: ResolvedManagedAsset[];
  paths: GuyPaths;
  state: GuyInstallState;
}

export interface InstallStateReadResult {
  state: GuyInstallState | null;
  error?: string;
}

export interface PiSettingsPackage {
  kind: "remote" | "local";
  source: string;
  resolvedPath?: string;
}

export interface PiPackageStatus {
  settingsPath: string;
  settingsExists: boolean;
  packages: PiSettingsPackage[];
  packageListOk: boolean;
  packageListOutput: string;
  missingRemotePackages: string[];
  missingLocalPackages: string[];
  skippedReason?: string;
}

interface RenderedAssetMetadata {
  generatedAt: string;
  profileId: string;
  assets: Array<{
    id: string;
    sourcePath: string;
    destinationPath: string;
    strategy: ResolvedManagedAsset["strategy"];
    required: boolean;
  }>;
}

export function resolveHomeDirectory(explicitHomeDirectory?: string): string {
  return explicitHomeDirectory ?? process.env.GUY_HOME ?? os.homedir();
}

function isWslEnvironment(environment: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(environment.WSL_DISTRO_NAME || environment.WSL_INTEROP);
}

export function detectSupportedPlatform(
  nodePlatform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env
): SupportedPlatform | null {
  if (nodePlatform === "darwin") {
    return "darwin";
  }

  if (nodePlatform === "linux" && isWslEnvironment(environment)) {
    return "linux-wsl";
  }

  return null;
}

export function resolveGuyPaths(explicitHomeDirectory?: string): GuyPaths {
  const homeDirectory = resolveHomeDirectory(explicitHomeDirectory);
  const rootDir = path.join(homeDirectory, GUY_DIRECTORY_NAME);
  const stateDir = path.join(rootDir, "state");
  const logsDir = path.join(rootDir, "logs");
  const cacheDir = path.join(rootDir, "cache");
  const bundlesDir = path.join(cacheDir, "bundles");
  const renderedDir = path.join(rootDir, "rendered");
  const backupsDir = path.join(rootDir, "backups");

  return {
    homeDirectory,
    rootDir,
    stateDir,
    installStateFile: path.join(stateDir, "install.json"),
    logsDir,
    doctorLogFile: path.join(logsDir, "doctor.log"),
    cacheDir,
    bundlesDir,
    renderedDir,
    backupsDir
  };
}

export function getRuntimeContract(explicitHomeDirectory?: string): RuntimeContract {
  const paths = resolveGuyPaths(explicitHomeDirectory);

  return {
    version: "0.1.0",
    defaultProfileId: "power-user",
    defaultChannel: "dogfood",
    supportedPlatforms: ["darwin"],
    supportedCommands: V0_SUPPORTED_COMMANDS,
    stateFile: paths.installStateFile
  };
}

export function createInstallState(options: CreateInstallStateOptions): GuyInstallState {
  const platform = options.platform ?? detectSupportedPlatform();

  if (!platform) {
    throw new Error("Unsupported platform");
  }

  const timestamp = (options.installedAt ?? new Date()).toISOString();

  return {
    version: options.version,
    profileId: options.profileId,
    channel: options.channel ?? "dogfood",
    platform,
    installedAt: timestamp,
    updatedAt: new Date().toISOString(),
    managedAssetHash: options.managedAssetHash ?? "uncomputed",
    health: options.health ?? "uninitialized"
  };
}

export function formatStateSummary(state: GuyInstallState): string[] {
  return [
    `version: ${state.version}`,
    `profile: ${state.profileId}`,
    `channel: ${state.channel}`,
    `platform: ${state.platform}`,
    `health: ${state.health}`,
    `managed asset hash: ${state.managedAssetHash}`,
    `installed at: ${state.installedAt}`,
    `updated at: ${state.updatedAt}`
  ];
}

export function resolveBundleRoot(): string {
  let currentDirectory = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
  let depth = 0;

  while (depth < 12) {
    if (existsSync(path.join(currentDirectory, "profiles"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
    depth += 1;
  }

  throw new Error("Unable to locate The Guy bundle root");
}

export function resolveProfileDirectory(profileId: string): string {
  return path.join(resolveBundleRoot(), "profiles", profileId);
}

export function resolveHomePath(targetPath: string, explicitHomeDirectory?: string): string {
  if (targetPath === "~") {
    return resolveHomeDirectory(explicitHomeDirectory);
  }

  if (targetPath.startsWith("~/")) {
    return path.join(resolveHomeDirectory(explicitHomeDirectory), targetPath.slice(2));
  }

  return targetPath;
}

function readJsonFile<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON at ${filePath}: ${message}`);
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function compareVersionStrings(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function matchesMaximumTestedRuntimeVersion(runtimeVersion: string, maximumTestedRuntimeVersion: string): boolean {
  if (maximumTestedRuntimeVersion.includes(".x")) {
    const runtimeParts = runtimeVersion.split(".");
    const maximumParts = maximumTestedRuntimeVersion.split(".");

    for (let index = 0; index < maximumParts.length; index += 1) {
      const maximumPart = maximumParts[index];
      if (maximumPart === "x") {
        return true;
      }

      if ((runtimeParts[index] ?? "") !== maximumPart) {
        return false;
      }
    }

    return runtimeParts.length <= maximumParts.length;
  }

  return compareVersionStrings(runtimeVersion, maximumTestedRuntimeVersion) <= 0;
}

function assertPackRuntimeCompatibility(pack: GuyPackManifest, runtimeVersion: string): void {
  if (compareVersionStrings(runtimeVersion, pack.minimumRuntimeVersion) < 0) {
    throw new Error(
      `Pi pack ${pack.id}@${pack.packVersion} requires runtime ${pack.minimumRuntimeVersion}+ (got ${runtimeVersion})`
    );
  }

  if (!matchesMaximumTestedRuntimeVersion(runtimeVersion, pack.maximumTestedRuntimeVersion)) {
    throw new Error(
      `Pi pack ${pack.id}@${pack.packVersion} is only tested through runtime ${pack.maximumTestedRuntimeVersion} (got ${runtimeVersion})`
    );
  }
}

function ensureRuntimeDirectories(paths: GuyPaths): void {
  for (const directory of [
    paths.rootDir,
    paths.stateDir,
    paths.logsDir,
    paths.cacheDir,
    paths.bundlesDir,
    paths.renderedDir,
    paths.backupsDir
  ]) {
    mkdirSync(directory, { recursive: true });
  }
}

function commandExists(binaryName: string): boolean {
  const result = spawnSync("which", [binaryName], {
    stdio: "pipe"
  });

  return (result.status ?? 1) === 0;
}

function verifyCommand(command: string): boolean {
  const result = spawnSync("sh", ["-c", command], {
    stdio: "pipe",
    timeout: 10_000
  });

  return (result.status ?? 1) === 0;
}

function checkBinaryRequirement(requirement: BinaryRequirement): boolean {
  if (requirement.verifyCommand) {
    return verifyCommand(requirement.verifyCommand);
  }

  return commandExists(requirement.id);
}

function runManagedShellCommand(command: string, cwd?: string): boolean {
  const result = spawnSync("sh", ["-lc", command], {
    cwd,
    stdio: "inherit"
  });

  return (result.status ?? 1) === 0;
}

function shouldSkipManagedInstalls(): boolean {
  return process.env.GUY_SKIP_MANAGED_INSTALLS === "1";
}

function shouldSkipPiPackageSync(): boolean {
  return process.env.GUY_SKIP_PI_PACKAGE_SYNC === "1";
}

function ensureManagedBinaryRequirements(profile: GuyProfileManifest): void {
  for (const requirement of profile.binaryRequirements) {
    if (!requirement.required || !requirement.managedByGuy || checkBinaryRequirement(requirement)) {
      continue;
    }

    if (shouldSkipManagedInstalls()) {
      continue;
    }

    if (!requirement.installCommand) {
      throw new Error(
        `Missing install command for managed requirement: ${requirement.id}`
      );
    }

    const ok = runManagedShellCommand(requirement.installCommand);
    if (!ok) {
      throw new Error(`Failed to install managed requirement: ${requirement.id}`);
    }
  }
}

function parsePackageSource(entry: unknown): string | null {
  if (typeof entry === "string") {
    return entry;
  }

  if (
    typeof entry === "object" &&
    entry !== null &&
    "source" in entry &&
    typeof entry.source === "string"
  ) {
    return entry.source;
  }

  return null;
}

function isRemotePackageSource(source: string): boolean {
  return ["npm:", "git:", "http://", "https://", "ssh://", "git://"].some((prefix) =>
    source.startsWith(prefix)
  );
}

export function getPiSettingsPath(explicitHomeDirectory?: string): string {
  return resolveHomePath("~/.pi/agent/settings.json", explicitHomeDirectory);
}

export function resolvePiSettingsPackages(explicitHomeDirectory?: string): PiSettingsPackage[] {
  const settingsPath = getPiSettingsPath(explicitHomeDirectory);

  if (!existsSync(settingsPath)) {
    return [];
  }

  const settings = readJsonFile<{ packages?: unknown[] }>(settingsPath);
  const packageEntries = settings.packages ?? [];

  return packageEntries
    .map((entry) => parsePackageSource(entry))
    .filter((source): source is string => Boolean(source))
    .map((source) => {
      if (isRemotePackageSource(source)) {
        return {
          kind: "remote" as const,
          source
        };
      }

      const resolvedPath = path.isAbsolute(source)
        ? source
        : path.resolve(path.dirname(settingsPath), source);

      return {
        kind: "local" as const,
        source,
        resolvedPath
      };
    });
}

export function inspectPiPackages(explicitHomeDirectory?: string): PiPackageStatus {
  const settingsPath = getPiSettingsPath(explicitHomeDirectory);
  const settingsExists = existsSync(settingsPath);
  const packages = settingsExists ? resolvePiSettingsPackages(explicitHomeDirectory) : [];

  if (!settingsExists) {
    return {
      settingsPath,
      settingsExists: false,
      packages,
      packageListOk: false,
      packageListOutput: "",
      missingRemotePackages: [],
      missingLocalPackages: [],
      skippedReason: `Settings file not found: ${settingsPath}`
    };
  }

  const missingLocalPackages = packages
    .filter((entry) => entry.kind === "local")
    .filter((entry) => !entry.resolvedPath || !existsSync(entry.resolvedPath))
    .map((entry) => entry.source);

  if (!commandExists("pi")) {
    return {
      settingsPath,
      settingsExists: true,
      packages,
      packageListOk: false,
      packageListOutput: "",
      missingRemotePackages: [],
      missingLocalPackages,
      skippedReason: "Pi CLI not found"
    };
  }

  const listResult = spawnSync("pi", ["list"], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 10_000
  });
  const packageListOutput = `${listResult.stdout ?? ""}${listResult.stderr ?? ""}`.trim();
  const packageListOk = (listResult.status ?? 1) === 0;

  if (!packageListOk) {
    return {
      settingsPath,
      settingsExists: true,
      packages,
      packageListOk,
      packageListOutput,
      missingRemotePackages: [],
      missingLocalPackages,
      skippedReason: packageListOutput || "pi list failed"
    };
  }

  const missingRemotePackages = packages
    .filter((entry) => entry.kind === "remote")
    .map((entry) => entry.source)
    .filter((source) => !packageListOutput.includes(source));

  return {
    settingsPath,
    settingsExists: true,
    packages,
    packageListOk,
    packageListOutput,
    missingRemotePackages,
    missingLocalPackages
  };
}

export function syncPiPackages(explicitHomeDirectory?: string): PiPackageStatus {
  const initialStatus = inspectPiPackages(explicitHomeDirectory);

  if (!initialStatus.settingsExists || !initialStatus.packageListOk) {
    return initialStatus;
  }

  if (initialStatus.missingLocalPackages.length > 0) {
    throw new Error(
      `Missing Pi local packages: ${initialStatus.missingLocalPackages.join(", ")}`
    );
  }

  if (initialStatus.missingRemotePackages.length === 0 || shouldSkipPiPackageSync()) {
    return initialStatus;
  }

  for (const source of initialStatus.missingRemotePackages) {
    const result = spawnSync("pi", ["install", source], {
      stdio: "inherit"
    });

    if ((result.status ?? 1) !== 0) {
      throw new Error(`Failed to install Pi package: ${source}`);
    }
  }

  return inspectPiPackages(explicitHomeDirectory);
}

function backupExistingAsset(asset: ResolvedManagedAsset, paths: GuyPaths): void {
  if (!existsSync(asset.destinationPath)) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(paths.backupsDir, `${timestamp}-${asset.id}.bak`);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  copyFileSync(asset.destinationPath, backupPath);
}

function computeManagedAssetHash(assets: readonly ResolvedManagedAsset[]): string {
  const hash = createHash("sha256");
  const sortedAssets = [...assets].sort((left, right) => left.id.localeCompare(right.id));

  for (const asset of sortedAssets) {
    hash.update(asset.id);
    hash.update(asset.destinationPath);
    hash.update(readFileSync(asset.sourcePath));
  }

  return hash.digest("hex");
}

export function loadProfileManifest(profileId: string): GuyProfileManifest {
  return readJsonFile<GuyProfileManifest>(path.join(resolveProfileDirectory(profileId), "profile.json"));
}

function loadProfileChain(profileId: string, seen = new Set<string>()): GuyProfileManifest[] {
  if (seen.has(profileId)) {
    throw new Error(`Circular profile inheritance detected at ${profileId}`);
  }

  seen.add(profileId);
  const profile = loadProfileManifest(profileId);
  const inheritedProfiles = (profile.inherits ?? []).flatMap((parentProfileId) =>
    loadProfileChain(parentProfileId, seen)
  );
  return [...inheritedProfiles, profile];
}

function mergeBinaryRequirements(requirements: readonly BinaryRequirement[]): BinaryRequirement[] {
  const merged = new Map<string, BinaryRequirement>();

  for (const requirement of requirements) {
    merged.set(requirement.id, requirement);
  }

  return Array.from(merged.values());
}

function mergePostInstallTasks(tasks: readonly PostInstallTask[]): PostInstallTask[] {
  const merged = new Map<string, PostInstallTask>();

  for (const task of tasks) {
    merged.set(task.id, task);
  }

  return Array.from(merged.values());
}

function mergeStringArray(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export function loadResolvedProfileManifest(profileId: string): GuyProfileManifest {
  const chain = loadProfileChain(profileId);
  const leafProfile = chain.at(-1);

  if (!leafProfile) {
    throw new Error(`Unable to resolve profile ${profileId}`);
  }

  return {
    ...leafProfile,
    supportedPlatforms: mergeStringArray(chain.flatMap((profile) => profile.supportedPlatforms)) as SupportedPlatform[],
    managedTools: mergeStringArray(chain.flatMap((profile) => profile.managedTools)) as GuyProfileManifest["managedTools"],
    binaryRequirements: mergeBinaryRequirements(chain.flatMap((profile) => profile.binaryRequirements)),
    doctorChecks: mergeStringArray(chain.flatMap((profile) => profile.doctorChecks)) as GuyProfileManifest["doctorChecks"],
    postInstall: mergePostInstallTasks(chain.flatMap((profile) => profile.postInstall ?? []))
  };
}

export function loadAssetManifest(
  profileId: string,
  profile: GuyProfileManifest = loadProfileManifest(profileId)
): GuyAssetManifest {
  if (!profile.assetManifest) {
    throw new Error(`Profile ${profileId} does not declare an assetManifest (it may be pack-backed only)`);
  }

  return readJsonFile<GuyAssetManifest>(
    path.join(resolveProfileDirectory(profileId), profile.assetManifest.replace(/^\.\//, ""))
  );
}

function loadPackManifest(reference: GuyPiPackReference, runtimeVersion: string): GuyPackManifest {
  const pack = loadPiPackManifest(reference);
  assertPackRuntimeCompatibility(pack, runtimeVersion);
  return pack;
}

function resolveManagedAssetsForProfile(
  profile: GuyProfileManifest,
  explicitHomeDirectory: string | undefined,
  runtimeVersion: string
): ResolvedManagedAsset[] {
  if (!profile.piPack && !profile.assetManifest) {
    throw new Error(`Profile ${profile.id} declares neither piPack nor assetManifest`);
  }

  if (profile.piPack) {
    const pack = loadPackManifest(profile.piPack, runtimeVersion);

    return pack.assets.map((asset) => ({
      ...asset,
      sourcePath: resolvePiPackAssetSourcePath(asset.source),
      destinationPath: resolveHomePath(asset.destination, explicitHomeDirectory)
    }));
  }

  const assetManifest = loadAssetManifest(profile.id, profile);

  if (assetManifest.profileId !== profile.id) {
    throw new Error(
      `Asset manifest profile mismatch for ${profile.id}: got ${assetManifest.profileId}`
    );
  }

  const profileDirectory = resolveProfileDirectory(profile.id);
  return assetManifest.assets.map((asset) => ({
    ...asset,
    sourcePath: path.join(profileDirectory, asset.source.replace(/^\.\//, "")),
    destinationPath: resolveHomePath(asset.destination, explicitHomeDirectory)
  }));
}

export function resolveManagedAssets(
  profileId: string,
  explicitHomeDirectory?: string,
  runtimeVersion: string = getRuntimeContract(explicitHomeDirectory).version
): ResolvedManagedAsset[] {
  const chain = loadProfileChain(profileId);
  const mergedAssets = new Map<string, ResolvedManagedAsset>();

  for (const profile of chain) {
    for (const asset of resolveManagedAssetsForProfile(profile, explicitHomeDirectory, runtimeVersion)) {
      mergedAssets.set(asset.id, asset);
    }
  }

  return Array.from(mergedAssets.values());
}

function runPostInstallTasks(tasks: readonly PostInstallTask[], explicitHomeDirectory?: string): void {
  for (const task of tasks) {
    const cwd = resolveHomePath(task.cwd, explicitHomeDirectory);
    mkdirSync(cwd, { recursive: true });

    const result = spawnSync("sh", ["-lc", task.run], {
      cwd,
      stdio: "inherit"
    });

    if ((result.status ?? 1) !== 0 && !task.optional) {
      throw new Error(`Post-install task failed: ${task.id}`);
    }
  }
}

function determineInstallHealth(profile: GuyProfileManifest, explicitHomeDirectory?: string): HealthState {
  const missingRequiredBinaries = profile.binaryRequirements.filter(
    (requirement) => requirement.required && !checkBinaryRequirement(requirement)
  );
  const piPackages = inspectPiPackages(explicitHomeDirectory);
  const hasPiPackageIssues =
    piPackages.settingsExists &&
    (piPackages.missingLocalPackages.length > 0 || piPackages.missingRemotePackages.length > 0);

  return missingRequiredBinaries.length === 0 && !hasPiPackageIssues ? "ready" : "degraded";
}

export function tryReadInstallState(explicitHomeDirectory?: string): InstallStateReadResult {
  const installStateFile = resolveGuyPaths(explicitHomeDirectory).installStateFile;

  if (!existsSync(installStateFile)) {
    return { state: null };
  }

  try {
    return {
      state: readJsonFile<GuyInstallState>(installStateFile)
    };
  } catch (error) {
    return {
      state: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function readInstallState(explicitHomeDirectory?: string): GuyInstallState | null {
  return tryReadInstallState(explicitHomeDirectory).state;
}

export function repairInstalledProfile(explicitHomeDirectory?: string): InstallProfileResult {
  const stateResult = tryReadInstallState(explicitHomeDirectory);

  if (!stateResult.state) {
    throw new Error(stateResult.error ?? "No install state found. Run guy install first.");
  }

  return installProfile(stateResult.state.profileId, explicitHomeDirectory, stateResult.state);
}

export function installProfile(
  profileId: string,
  explicitHomeDirectory?: string,
  previousState?: GuyInstallState | null
): InstallProfileResult {
  const runtime = getRuntimeContract(explicitHomeDirectory);
  const profile = loadResolvedProfileManifest(profileId);
  const platform = detectSupportedPlatform();

  if (!platform) {
    throw new Error("Unsupported platform for The Guy v0.1");
  }

  if (!profile.supportedPlatforms.includes(platform)) {
    throw new Error(`Profile ${profileId} does not support ${platform}`);
  }

  const paths = resolveGuyPaths(explicitHomeDirectory);
  ensureRuntimeDirectories(paths);
  ensureManagedBinaryRequirements(profile);

  const assets = resolveManagedAssets(profileId, explicitHomeDirectory, runtime.version);

  for (const asset of assets) {
    if (!existsSync(asset.sourcePath)) {
      throw new Error(`Missing bundled asset: ${asset.sourcePath}`);
    }

    if (asset.strategy !== "copy") {
      throw new Error(`Unsupported asset strategy in v0.1: ${asset.strategy}`);
    }

    backupExistingAsset(asset, paths);
    mkdirSync(path.dirname(asset.destinationPath), { recursive: true });
    copyFileSync(asset.sourcePath, asset.destinationPath);
  }

  runPostInstallTasks(profile.postInstall ?? [], explicitHomeDirectory);
  syncPiPackages(explicitHomeDirectory);

  const managedAssetHash = computeManagedAssetHash(assets);
  const renderedMetadata: RenderedAssetMetadata = {
    generatedAt: new Date().toISOString(),
    profileId,
    assets: assets.map((asset) => ({
      id: asset.id,
      sourcePath: asset.sourcePath,
      destinationPath: asset.destinationPath,
      strategy: asset.strategy,
      required: asset.required
    }))
  };

  writeJsonFile(path.join(paths.renderedDir, profileId, "assets.json"), renderedMetadata);

  const state = createInstallState({
    version: runtime.version,
    profileId,
    channel: profile.channel,
    platform,
    managedAssetHash,
    health: determineInstallHealth(profile, explicitHomeDirectory),
    ...(previousState ? { installedAt: new Date(previousState.installedAt) } : {})
  });

  writeJsonFile(paths.installStateFile, state);

  return {
    profile,
    assets,
    paths,
    state
  };
}
