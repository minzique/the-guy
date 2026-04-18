import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getRuntimeContract, resolveBundleRoot, resolveGuyPaths } from "@the-guy/core";

export const DEFAULT_SANDBOX_NAME = "default";
export const DEFAULT_SANDBOX_DRIVER_ID = "docker-local" as const;
export const SANDBOX_STATE_VERSION = "0.1" as const;
export const DEFAULT_WORKSPACE_CONTAINER_PATH = "/workspace";
export const DEFAULT_SANDBOX_HOME_CONTAINER_PATH = "/home/guy";

export type GuySandboxDriverId = typeof DEFAULT_SANDBOX_DRIVER_ID;
export type GuySandboxDoctorStatus = "pass" | "warn" | "fail";

export interface GuySandboxFilesystemGrant {
  label: "workspace" | "sandbox-home";
  containerPath: string;
  readOnly: boolean;
  hostPath?: string;
  volumeName?: string;
}

export interface GuySandboxCapabilityGrant {
  network: "default";
  credentials: "none";
  filesystem: GuySandboxFilesystemGrant[];
}

export interface GuySandboxState {
  version: typeof SANDBOX_STATE_VERSION;
  name: string;
  driverId: GuySandboxDriverId;
  imageTag: string;
  buildContextPath: string;
  dockerfilePath: string;
  containerName: string;
  volumeName: string;
  workspaceHostPath: string;
  workspaceContainerPath: string;
  sandboxHomeContainerPath: string;
  capabilities: GuySandboxCapabilityGrant;
  createdAt: string;
  updatedAt: string;
}

export interface GuySandboxPaths {
  sandboxesDir: string;
  sandboxDir: string;
  stateFile: string;
  bootstrapLogFile: string;
}

export interface GuySandboxRuntimeContext {
  buildContextPath: string;
  dockerfilePath: string;
  buildContextReady: boolean;
}

export interface GuySandboxStartOptions {
  explicitHomeDirectory?: string;
  workspaceHostPath?: string;
}

export interface GuySandboxStopOptions {
  explicitHomeDirectory?: string;
  force?: boolean;
}

export interface GuySandboxStatus {
  state: GuySandboxState | null;
  runtimeContext: GuySandboxRuntimeContext;
  dockerCliAvailable: boolean;
  dockerDaemonAvailable: boolean;
  imageAvailable: boolean;
  containerExists: boolean;
  running: boolean;
  containerStatus?: string;
  containerId?: string;
  workspaceMatchesCurrent: boolean;
  runtimeStatusOutput?: string;
  runtimeStatusExitCode?: number;
}

export interface GuySandboxDoctorCheck {
  id: string;
  status: GuySandboxDoctorStatus;
  detail: string;
}

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
  error?: Error;
}

interface DockerContainerInspect {
  Id: string;
  State?: {
    Running?: boolean;
    Status?: string;
  };
}

function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function runCommand(
  binary: string,
  args: readonly string[],
  options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {}
): CommandResult {
  const result = spawnSync(binary, [...args], {
    encoding: "utf8",
    ...options
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {})
  };
}

function commandExists(binary: string): boolean {
  return runCommand("which", [binary], { stdio: "pipe" }).status === 0;
}

function runDocker(args: readonly string[], options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {}): CommandResult {
  return runCommand("docker", args, options);
}

function trimCommandOutput(result: CommandResult): string {
  return `${result.stdout}${result.stderr}`.trim();
}

function printCapturedOutput(result: CommandResult): void {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function sanitizeSandboxName(name: string): string {
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    throw new Error(`Invalid sandbox name: ${name}`);
  }

  return trimmed;
}

function resolveWorkspaceHostPath(workspaceHostPath?: string): string {
  const resolvedPath = path.resolve(workspaceHostPath ?? process.cwd());
  if (!existsSync(resolvedPath)) {
    throw new Error(`Sandbox workspace path does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}

function getSandboxContainerName(name = DEFAULT_SANDBOX_NAME): string {
  return `the-guy-sandbox-${sanitizeSandboxName(name)}`;
}

function getSandboxVolumeName(name = DEFAULT_SANDBOX_NAME): string {
  return `${getSandboxContainerName(name)}-home`;
}

function getSandboxImageTag(explicitHomeDirectory?: string): string {
  return `the-guy-sandbox:${getRuntimeContract(explicitHomeDirectory).version}`;
}

function isRuntimeImageContext(directory: string): boolean {
  return [
    path.join(directory, "docker", "guy-sandbox", "Dockerfile"),
    path.join(directory, "bin", "guy"),
    path.join(directory, "apps", "guy-installer", "dist", "cli.js"),
    path.join(directory, "node_modules", "@the-guy", "core", "package.json")
  ].every((candidatePath) => existsSync(candidatePath));
}

export function resolveSandboxPaths(
  name = DEFAULT_SANDBOX_NAME,
  explicitHomeDirectory?: string
): GuySandboxPaths {
  const guyPaths = resolveGuyPaths(explicitHomeDirectory);
  const sandboxesDir = path.join(guyPaths.rootDir, "sandboxes");
  const sandboxDir = path.join(sandboxesDir, sanitizeSandboxName(name));

  return {
    sandboxesDir,
    sandboxDir,
    stateFile: path.join(sandboxDir, "sandbox.json"),
    bootstrapLogFile: path.join(sandboxDir, "bootstrap.log")
  };
}

function ensureSandboxDirectories(paths: GuySandboxPaths): void {
  mkdirSync(paths.sandboxDir, { recursive: true });
}

export function resolveSandboxRuntimeContext(
  explicitHomeDirectory?: string,
  ensureBuildContext = false
): GuySandboxRuntimeContext {
  const bundleRoot = resolveBundleRoot();
  if (isRuntimeImageContext(bundleRoot)) {
    return {
      buildContextPath: bundleRoot,
      dockerfilePath: path.join(bundleRoot, "docker", "guy-sandbox", "Dockerfile"),
      buildContextReady: true
    };
  }

  const runtime = getRuntimeContract(explicitHomeDirectory);
  const artifactBundleDir = path.join(bundleRoot, ".artifacts", `the-guy-${runtime.version}`);

  if (ensureBuildContext) {
    const buildScriptPath = path.join(bundleRoot, "scripts", "build-release-bundle.mjs");
    if (!existsSync(buildScriptPath)) {
      throw new Error("Unable to resolve a sandbox image build context. Build a release bundle first.");
    }

    const buildResult = runCommand(process.execPath, [buildScriptPath], {
      cwd: bundleRoot,
      stdio: "inherit"
    });

    if (buildResult.status !== 0) {
      throw new Error("Failed to build the local The Guy release bundle for sandbox image assembly.");
    }
  }

  return {
    buildContextPath: artifactBundleDir,
    dockerfilePath: path.join(artifactBundleDir, "docker", "guy-sandbox", "Dockerfile"),
    buildContextReady: isRuntimeImageContext(artifactBundleDir)
  };
}

export function createSandboxState(
  workspaceHostPath: string,
  runtimeContext: GuySandboxRuntimeContext,
  explicitHomeDirectory?: string,
  previousState?: GuySandboxState | null
): GuySandboxState {
  const now = new Date().toISOString();
  const imageTag = getSandboxImageTag(explicitHomeDirectory);
  const containerName = getSandboxContainerName();
  const volumeName = getSandboxVolumeName();

  return {
    version: SANDBOX_STATE_VERSION,
    name: DEFAULT_SANDBOX_NAME,
    driverId: DEFAULT_SANDBOX_DRIVER_ID,
    imageTag,
    buildContextPath: runtimeContext.buildContextPath,
    dockerfilePath: runtimeContext.dockerfilePath,
    containerName,
    volumeName,
    workspaceHostPath,
    workspaceContainerPath: DEFAULT_WORKSPACE_CONTAINER_PATH,
    sandboxHomeContainerPath: DEFAULT_SANDBOX_HOME_CONTAINER_PATH,
    capabilities: {
      network: "default",
      credentials: "none",
      filesystem: [
        {
          label: "workspace",
          hostPath: workspaceHostPath,
          containerPath: DEFAULT_WORKSPACE_CONTAINER_PATH,
          readOnly: false
        },
        {
          label: "sandbox-home",
          volumeName,
          containerPath: DEFAULT_SANDBOX_HOME_CONTAINER_PATH,
          readOnly: false
        }
      ]
    },
    createdAt: previousState?.createdAt ?? now,
    updatedAt: now
  };
}

export function readSandboxState(explicitHomeDirectory?: string): GuySandboxState | null {
  const paths = resolveSandboxPaths(DEFAULT_SANDBOX_NAME, explicitHomeDirectory);
  if (!existsSync(paths.stateFile)) {
    return null;
  }

  return readJsonFile<GuySandboxState>(paths.stateFile);
}

function writeSandboxState(state: GuySandboxState, explicitHomeDirectory?: string): void {
  const paths = resolveSandboxPaths(state.name, explicitHomeDirectory);
  ensureSandboxDirectories(paths);
  writeJsonFile(paths.stateFile, state);
}

export function buildDockerImageArguments(
  state: GuySandboxState,
  explicitHomeDirectory?: string
): string[] {
  const uid = typeof process.getuid === "function" ? String(process.getuid()) : "1000";

  return [
    "build",
    "--file",
    state.dockerfilePath,
    "--tag",
    state.imageTag,
    "--build-arg",
    `HOST_UID=${uid}`,
    "--build-arg",
    `THE_GUY_VERSION=${getRuntimeContract(explicitHomeDirectory).version}`,
    state.buildContextPath
  ];
}

export function buildDockerRunArguments(state: GuySandboxState): string[] {
  return [
    "run",
    "--detach",
    "--init",
    "--name",
    state.containerName,
    "--hostname",
    state.containerName,
    "--label",
    "ai.the-guy.sandbox=default",
    "--env",
    `HOME=${state.sandboxHomeContainerPath}`,
    "--env",
    `GUY_HOME=${state.sandboxHomeContainerPath}`,
    "--env",
    "GUY_SANDBOX=1",
    "--mount",
    `type=volume,source=${state.volumeName},target=${state.sandboxHomeContainerPath}`,
    "--mount",
    `type=bind,source=${state.workspaceHostPath},target=${state.workspaceContainerPath}`,
    "--workdir",
    state.workspaceContainerPath,
    state.imageTag
  ];
}

export function buildDockerExecArguments(
  state: GuySandboxState,
  command: readonly string[],
  options: { interactive?: boolean } = {}
): string[] {
  if (command.length === 0) {
    throw new Error("Sandbox exec requires a command");
  }

  const args = ["exec"];
  if (options.interactive) {
    args.push("--interactive", "--tty");
  }

  args.push("--workdir", state.workspaceContainerPath, state.containerName, ...command);
  return args;
}

function inspectDockerContainer(containerName: string): DockerContainerInspect | null {
  const result = runDocker(["inspect", "--type", "container", containerName], {
    stdio: "pipe"
  });

  if (result.status !== 0) {
    return null;
  }

  const parsed = JSON.parse(result.stdout) as DockerContainerInspect[];
  return parsed[0] ?? null;
}

function dockerImageExists(imageTag: string): boolean {
  return runDocker(["image", "inspect", imageTag], { stdio: "pipe" }).status === 0;
}

function ensureDockerCli(): void {
  if (!commandExists("docker")) {
    throw new Error("Docker CLI is not installed. Install Docker or Colima first.");
  }
}

function ensureDockerDaemon(): void {
  const result = runDocker(["info"], { stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(trimCommandOutput(result) || "Docker daemon is not reachable.");
  }
}

function stopAndRemoveContainer(containerName: string): void {
  const inspect = inspectDockerContainer(containerName);
  if (!inspect) {
    return;
  }

  const result = runDocker(["rm", "--force", containerName], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Failed to remove sandbox container: ${containerName}`);
  }
}

function buildSandboxImage(state: GuySandboxState, explicitHomeDirectory?: string): void {
  if (!existsSync(state.dockerfilePath)) {
    throw new Error(`Sandbox Dockerfile is missing: ${state.dockerfilePath}`);
  }

  const result = runDocker(buildDockerImageArguments(state, explicitHomeDirectory), {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Failed to build sandbox image ${state.imageTag}`);
  }
}

function createSandboxContainer(state: GuySandboxState): void {
  const result = runDocker(buildDockerRunArguments(state), {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Failed to create sandbox container ${state.containerName}`);
  }
}

function startExistingContainer(state: GuySandboxState): void {
  const result = runDocker(["start", state.containerName], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Failed to start sandbox container ${state.containerName}`);
  }
}

function runBootstrapCommand(state: GuySandboxState, command: readonly string[], explicitHomeDirectory?: string): void {
  const paths = resolveSandboxPaths(state.name, explicitHomeDirectory);
  ensureSandboxDirectories(paths);

  const result = runDocker(buildDockerExecArguments(state, command), {
    stdio: "pipe"
  });

  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(paths.bootstrapLogFile, output);
  printCapturedOutput(result);

  if (result.status !== 0) {
    throw new Error(`Sandbox bootstrap failed while running: ${command.join(" ")}`);
  }
}

function bootstrapSandboxRuntime(state: GuySandboxState, explicitHomeDirectory?: string): void {
  const installStatePath = path.posix.join(state.sandboxHomeContainerPath, ".guy", "state", "install.json");
  const hasInstallState = runDocker(
    buildDockerExecArguments(state, ["test", "-f", installStatePath]),
    { stdio: "pipe" }
  ).status === 0;

  runBootstrapCommand(state, ["guy", hasInstallState ? "repair" : "install"], explicitHomeDirectory);
}

export function startSandbox(options: GuySandboxStartOptions = {}): GuySandboxState {
  const workspaceHostPath = resolveWorkspaceHostPath(options.workspaceHostPath);
  const runtimeContext = resolveSandboxRuntimeContext(options.explicitHomeDirectory, true);

  if (!runtimeContext.buildContextReady) {
    throw new Error(
      `Sandbox build context is not ready at ${runtimeContext.buildContextPath}. Build a release bundle first.`
    );
  }

  ensureDockerCli();
  ensureDockerDaemon();

  const previousState = readSandboxState(options.explicitHomeDirectory);
  const state = createSandboxState(
    workspaceHostPath,
    runtimeContext,
    options.explicitHomeDirectory,
    previousState
  );

  buildSandboxImage(state, options.explicitHomeDirectory);
  stopAndRemoveContainer(state.containerName);
  createSandboxContainer(state);
  bootstrapSandboxRuntime(state, options.explicitHomeDirectory);
  writeSandboxState(state, options.explicitHomeDirectory);
  return state;
}

function ensureSandboxRunning(options: GuySandboxStartOptions = {}): GuySandboxState {
  const workspaceHostPath = resolveWorkspaceHostPath(options.workspaceHostPath);
  const state = readSandboxState(options.explicitHomeDirectory);

  if (!state || state.workspaceHostPath !== workspaceHostPath) {
    return startSandbox(options);
  }

  ensureDockerCli();
  ensureDockerDaemon();

  const inspect = inspectDockerContainer(state.containerName);
  if (!inspect) {
    return startSandbox(options);
  }

  if (!inspect.State?.Running) {
    startExistingContainer(state);
  }

  return state;
}

export function openSandboxShell(options: GuySandboxStartOptions = {}): number {
  const state = ensureSandboxRunning(options);
  const result = runDocker(buildDockerExecArguments(state, ["bash"], { interactive: true }), {
    stdio: "inherit"
  });

  return result.status;
}

export function execInSandbox(command: readonly string[], options: GuySandboxStartOptions = {}): number {
  const state = ensureSandboxRunning(options);
  const result = runDocker(buildDockerExecArguments(state, command), {
    stdio: "inherit"
  });

  return result.status;
}

export function stopSandbox(options: GuySandboxStopOptions = {}): void {
  const state = readSandboxState(options.explicitHomeDirectory);
  if (!state) {
    return;
  }

  ensureDockerCli();
  ensureDockerDaemon();

  const inspect = inspectDockerContainer(state.containerName);
  if (!inspect) {
    return;
  }

  if (options.force) {
    stopAndRemoveContainer(state.containerName);
    return;
  }

  if (inspect.State?.Running) {
    const result = runDocker(["stop", state.containerName], {
      stdio: "inherit"
    });

    if (result.status !== 0) {
      throw new Error(`Failed to stop sandbox container ${state.containerName}`);
    }
  }
}

function tryReadRuntimeStatus(state: GuySandboxState): { output: string; exitCode: number } {
  const result = runDocker(buildDockerExecArguments(state, ["guy", "status"]), {
    stdio: "pipe"
  });

  return {
    output: trimCommandOutput(result),
    exitCode: result.status
  };
}

export function getSandboxStatus(options: GuySandboxStartOptions = {}): GuySandboxStatus {
  const desiredWorkspaceHostPath = resolveWorkspaceHostPath(options.workspaceHostPath);
  const state = readSandboxState(options.explicitHomeDirectory);
  const runtimeContext = resolveSandboxRuntimeContext(options.explicitHomeDirectory, false);
  const dockerCliAvailable = commandExists("docker");
  const dockerDaemonAvailable = dockerCliAvailable && runDocker(["info"], { stdio: "pipe" }).status === 0;
  const imageTag = state?.imageTag ?? getSandboxImageTag(options.explicitHomeDirectory);
  const imageAvailable = dockerDaemonAvailable ? dockerImageExists(imageTag) : false;
  const inspect = dockerDaemonAvailable ? inspectDockerContainer(state?.containerName ?? getSandboxContainerName()) : null;
  const running = Boolean(inspect?.State?.Running);
  const runtimeStatus = state && running ? tryReadRuntimeStatus(state) : null;

  return {
    state,
    runtimeContext,
    dockerCliAvailable,
    dockerDaemonAvailable,
    imageAvailable,
    containerExists: Boolean(inspect),
    running,
    ...(inspect?.State?.Status ? { containerStatus: inspect.State.Status } : {}),
    ...(inspect?.Id ? { containerId: inspect.Id } : {}),
    workspaceMatchesCurrent: state ? state.workspaceHostPath === desiredWorkspaceHostPath : true,
    ...(runtimeStatus?.output ? { runtimeStatusOutput: runtimeStatus.output } : {}),
    ...(runtimeStatus ? { runtimeStatusExitCode: runtimeStatus.exitCode } : {})
  };
}

export function formatSandboxStatus(status: GuySandboxStatus): string[] {
  const lines = [
    `sandbox: ${status.state?.name ?? DEFAULT_SANDBOX_NAME}`,
    `driver: ${status.state?.driverId ?? DEFAULT_SANDBOX_DRIVER_ID}`,
    `docker cli: ${status.dockerCliAvailable ? "ready" : "missing"}`,
    `docker daemon: ${status.dockerDaemonAvailable ? "ready" : "unavailable"}`,
    `build context: ${status.runtimeContext.buildContextPath}`,
    `build context ready: ${status.runtimeContext.buildContextReady ? "yes" : "no"}`,
    `dockerfile: ${status.runtimeContext.dockerfilePath}`,
    `image: ${status.state?.imageTag ?? getSandboxImageTag()} (${status.imageAvailable ? "present" : "missing"})`,
    `container: ${status.state?.containerName ?? getSandboxContainerName()} (${status.containerExists ? (status.running ? "running" : status.containerStatus ?? "stopped") : "missing"})`,
    `workspace: ${status.state?.workspaceHostPath ?? process.cwd()} -> ${status.state?.workspaceContainerPath ?? DEFAULT_WORKSPACE_CONTAINER_PATH}`,
    `workspace matches current cwd: ${status.workspaceMatchesCurrent ? "yes" : "no"}`,
    `sandbox home: ${status.state?.volumeName ?? getSandboxVolumeName()} -> ${status.state?.sandboxHomeContainerPath ?? DEFAULT_SANDBOX_HOME_CONTAINER_PATH}`
  ];

  if (status.runtimeStatusOutput) {
    lines.push("runtime status:");
    for (const line of status.runtimeStatusOutput.split(/\r?\n/)) {
      lines.push(`  ${line}`);
    }
  }

  return lines;
}

export function runSandboxDoctor(options: GuySandboxStartOptions = {}): GuySandboxDoctorCheck[] {
  const status = getSandboxStatus(options);
  const checks: GuySandboxDoctorCheck[] = [
    {
      id: "docker-cli",
      status: status.dockerCliAvailable ? "pass" : "fail",
      detail: status.dockerCliAvailable ? "Docker CLI is available" : "Install Docker or Colima first"
    },
    {
      id: "docker-daemon",
      status: status.dockerDaemonAvailable ? "pass" : "fail",
      detail: status.dockerDaemonAvailable ? "Docker daemon is reachable" : "Start Docker Desktop or Colima"
    },
    {
      id: "build-context",
      status: status.runtimeContext.buildContextReady ? "pass" : "fail",
      detail: status.runtimeContext.buildContextReady
        ? `Runtime image context ready at ${status.runtimeContext.buildContextPath}`
        : `Runtime image context missing at ${status.runtimeContext.buildContextPath}`
    },
    {
      id: "image",
      status: status.imageAvailable ? "pass" : "warn",
      detail: status.imageAvailable
        ? `Image present: ${status.state?.imageTag ?? getSandboxImageTag()}`
        : `Run guy sandbox start to build ${status.state?.imageTag ?? getSandboxImageTag()}`
    },
    {
      id: "container",
      status: status.containerExists ? (status.running ? "pass" : "warn") : "warn",
      detail: status.containerExists
        ? `Container ${status.state?.containerName ?? getSandboxContainerName()} is ${status.containerStatus ?? (status.running ? "running" : "stopped")}`
        : `Run guy sandbox start to create ${status.state?.containerName ?? getSandboxContainerName()}`
    },
    {
      id: "workspace-match",
      status: status.workspaceMatchesCurrent ? "pass" : "warn",
      detail: status.workspaceMatchesCurrent
        ? "Sandbox workspace matches the current working directory"
        : "Current working directory differs from the recorded sandbox workspace; rerun guy sandbox start to remount it"
    }
  ];

  if (status.runtimeStatusOutput) {
    checks.push({
      id: "runtime-status",
      status: (status.runtimeStatusExitCode ?? 1) === 0 ? "pass" : "fail",
      detail: status.runtimeStatusOutput
    });
  } else {
    checks.push({
      id: "runtime-status",
      status: status.running ? "warn" : "warn",
      detail: status.running
        ? "Sandbox container is running but runtime status output was empty"
        : "Sandbox runtime is unavailable because the container is not running"
    });
  }

  return checks;
}

export function formatSandboxDoctorReport(checks: readonly GuySandboxDoctorCheck[]): string[] {
  return checks.flatMap((check) => {
    const prefix = check.status === "pass" ? "[pass]" : check.status === "warn" ? "[warn]" : "[fail]";
    const lines = check.detail.split(/\r?\n/);
    return [`${prefix} ${check.id}: ${lines[0] ?? ""}`, ...lines.slice(1).map((line) => `       ${line}`)];
  });
}

export function removeSandboxState(explicitHomeDirectory?: string): void {
  const paths = resolveSandboxPaths(DEFAULT_SANDBOX_NAME, explicitHomeDirectory);
  rmSync(paths.sandboxDir, { force: true, recursive: true });
}
