#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getClaudeAuthContract } from "@the-guy/auth-claude";
import { getCodexAuthContract } from "@the-guy/auth-codex";
import {
  detectSupportedPlatform,
  formatStateSummary,
  getRuntimeContract,
  installProfile,
  repairInstalledProfile,
  resolveGuyPaths,
  resolveHomeDirectory,
  tryReadInstallState,
  type ProviderAuthContract
} from "@the-guy/core";
import { formatDoctorResults, runDoctor } from "@the-guy/doctor";
import {
  execInSandbox,
  formatSandboxDoctorReport,
  formatSandboxStatus,
  getSandboxStatus,
  openSandboxShell,
  runSandboxDoctor,
  startSandbox,
  stopSandbox
} from "@the-guy/sandbox";

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

function printError(line: string): void {
  process.stderr.write(`${line}\n`);
}

function printHelp(): void {
  print("The Guy v0.1 CLI");
  print("");
  print("Commands:");
  print("  guy install");
  print("  guy auth claude");
  print("  guy auth codex");
  print("  guy status");
  print("  guy doctor [--fix]");
  print("  guy repair");
  print("  guy sandbox start");
  print("  guy sandbox status");
  print("  guy sandbox shell");
  print("  guy sandbox exec -- <cmd>");
  print("  guy sandbox stop [--force]");
  print("  guy sandbox doctor");
}

function printAuthContract(contract: ProviderAuthContract): void {
  print(`provider: ${contract.providerId}`);
  print(`binary: ${contract.binaryName}`);
  print(`login: ${contract.loginCommand.join(" ")}`);
  print(`status: ${contract.statusCommand?.join(" ") ?? "n/a"}`);
  print(`managed by guy: ${contract.installManagedByGuy ? "yes" : "no"}`);
  print(`hint: ${contract.installHint}`);
}

function handleInstall(): number {
  try {
    const result = installProfile("power-user");
    const doctorResults = runDoctor();
    const doctorOutput = formatDoctorResults(doctorResults).join("\n");
    writeFileSync(result.paths.doctorLogFile, `${doctorOutput}\n`);

    print("Installed The Guy power-user profile");
    print(`profile: ${result.profile.id}`);
    print(`assets copied: ${result.assets.length}`);
    print(`health: ${result.state.health}`);
    print(`state file: ${result.paths.installStateFile}`);
    print(`doctor log: ${result.paths.doctorLogFile}`);
    return doctorResults.some((check) => check.status === "fail") ? 1 : 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleStatus(): number {
  const runtime = getRuntimeContract();
  const paths = resolveGuyPaths();
  const stateResult = tryReadInstallState();

  if (stateResult.error) {
    printError(stateResult.error);
    return 1;
  }

  if (stateResult.state) {
    print("Installed status");
    for (const line of formatStateSummary(stateResult.state)) {
      print(line);
    }
    print(`state file: ${runtime.stateFile}`);
    if (existsSync(paths.doctorLogFile)) {
      print(`last doctor update: ${statSync(paths.doctorLogFile).mtime.toISOString()}`);
      print(`doctor log: ${paths.doctorLogFile}`);
    }
    return 0;
  }

  const platform = detectSupportedPlatform();
  if (!platform) {
    printError("Unsupported platform for native install. macOS is the only supported native host. On Linux, use: guy sandbox start");
    return 1;
  }

  print("No install state found.");
  print(`default profile: ${runtime.defaultProfileId}`);
  print(`state file: ${runtime.stateFile}`);
  print("next: run guy install");
  return 0;
}

function handleDoctor(fix = false): number {
  if (fix) {
    const stateResult = tryReadInstallState();
    if (stateResult.state) {
      return handleRepair();
    }

    return handleInstall();
  }

  const results = runDoctor();

  print("Doctor results");
  for (const line of formatDoctorResults(results)) {
    print(line);
  }

  return results.some((result) => result.status === "fail") ? 1 : 0;
}

function handleRepair(): number {
  try {
    const result = repairInstalledProfile();
    const doctorResults = runDoctor();
    const doctorOutput = formatDoctorResults(doctorResults).join("\n");
    writeFileSync(result.paths.doctorLogFile, `${doctorOutput}\n`);

    print("Repair complete");
    print(`profile: ${result.profile.id}`);
    print(`assets recopied: ${result.assets.length}`);
    print(`health: ${result.state.health}`);
    print(`state file: ${result.paths.installStateFile}`);
    print(`doctor log: ${result.paths.doctorLogFile}`);
    return doctorResults.some((check) => check.status === "fail") ? 1 : 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function runAuthCommand(contract: ProviderAuthContract): number {
  printAuthContract(contract);

  if (contract.providerId === "codex") {
    const authFile = path.join(resolveHomeDirectory(), ".codex", "auth.json");
    if (existsSync(authFile)) {
      print(`Codex already authenticated via ${authFile}`);
      return 0;
    }
  }

  if (contract.statusCommand) {
    const [statusBinary, ...statusArgs] = contract.statusCommand;
    if (statusBinary) {
      const statusResult = spawnSync(statusBinary, statusArgs, {
        stdio: "pipe",
        encoding: "utf8",
        timeout: 10_000
      });

      if ((statusResult.status ?? 1) === 0) {
        print(`${contract.providerId} is already authenticated.`);
        return 0;
      }
    }
  }

  const [binaryName, ...args] = contract.loginCommand;
  if (!binaryName) {
    printError(`No login command configured for ${contract.providerId}`);
    return 1;
  }

  const result = spawnSync(binaryName, args, {
    stdio: "inherit"
  });

  if (result.error) {
    printError(contract.installHint);
    return 1;
  }

  return result.status ?? 1;
}

function handleAuth(provider: string | undefined): number {
  if (provider === "claude") {
    print("Claude auth handoff");
    return runAuthCommand(getClaudeAuthContract());
  }

  if (provider === "codex") {
    print("Codex auth handoff");
    return runAuthCommand(getCodexAuthContract());
  }

  printError("Usage: guy auth <claude|codex>");
  return 1;
}

function printSandboxUsage(): void {
  print("Usage: guy sandbox <start|status|shell|exec|stop|doctor>");
}

function handleSandboxStart(): number {
  try {
    startSandbox();
    const status = getSandboxStatus();
    print("Sandbox ready");
    for (const line of formatSandboxStatus(status)) {
      print(line);
    }
    return 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandboxStatus(): number {
  try {
    const status = getSandboxStatus();
    for (const line of formatSandboxStatus(status)) {
      print(line);
    }
    return 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandboxShell(): number {
  try {
    return openSandboxShell();
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandboxExec(argv: string[]): number {
  const command = argv[0] === "--" ? argv.slice(1) : argv;
  if (command.length === 0) {
    printError("Usage: guy sandbox exec -- <cmd>");
    return 1;
  }

  try {
    return execInSandbox(command);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandboxStop(argv: string[]): number {
  try {
    const force = argv.includes("--force");
    stopSandbox({ force });
    print(force ? "Sandbox container removed" : "Sandbox stopped");
    return 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandboxDoctor(): number {
  try {
    const checks = runSandboxDoctor();
    print("Sandbox doctor");
    for (const line of formatSandboxDoctorReport(checks)) {
      print(line);
    }
    return checks.some((check) => check.status === "fail") ? 1 : 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function handleSandbox(argv: string[]): number {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printSandboxUsage();
    return 0;
  }

  switch (subcommand) {
    case "start":
      return handleSandboxStart();
    case "status":
      return handleSandboxStatus();
    case "shell":
      return handleSandboxShell();
    case "exec":
      return handleSandboxExec(rest);
    case "stop":
      return handleSandboxStop(rest);
    case "doctor":
      return handleSandboxDoctor();
    default:
      printError(`Unknown sandbox command: ${subcommand}`);
      printSandboxUsage();
      return 1;
  }
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "install":
      return handleInstall();
    case "auth":
      return handleAuth(rest[0]);
    case "status":
      return handleStatus();
    case "doctor":
      return handleDoctor(rest[0] === "--fix");
    case "repair":
      return handleRepair();
    case "sandbox":
      return handleSandbox(rest);
    default:
      printError(`Unknown command: ${command}`);
      printHelp();
      return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
