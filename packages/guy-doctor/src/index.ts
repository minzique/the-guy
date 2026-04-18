import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { getClaudeAuthContract } from "@the-guy/auth-claude";
import { getCodexAuthContract } from "@the-guy/auth-codex";
import {
  detectSupportedPlatform,
  getRuntimeContract,
  inspectPiPackages,
  loadResolvedProfileManifest,
  resolveGuyPaths,
  resolveHomeDirectory,
  tryReadInstallState
} from "@the-guy/core";
import type { BinaryRequirement, GuyProfileManifest } from "@the-guy/profile-schema";

export const DOCTOR_SEVERITIES = ["error", "warning", "info"] as const;
export type DoctorSeverity = (typeof DOCTOR_SEVERITIES)[number];
export type DoctorStatus = "pass" | "fail" | "warn";

export interface DoctorCheck {
  id: string;
  title: string;
  severity: DoctorSeverity;
  target: string;
  remediation: string;
}

export interface DoctorCheckResult extends DoctorCheck {
  status: DoctorStatus;
  detail: string;
}

interface RenderedAssetMetadata {
  assets: Array<{
    destinationPath: string;
  }>;
}

function commandExists(binaryName: string): boolean {
  const result = spawnSync("which", [binaryName], {
    stdio: "pipe"
  });

  return (result.status ?? 1) === 0;
}

function runVerifyCommand(command: string): { ok: boolean; output: string } {
  const result = spawnSync("sh", ["-c", command], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 10_000
  });
  const output = (result.stdout || result.stderr || "").trim();

  return {
    ok: (result.status ?? 1) === 0,
    output
  };
}

function trimOutput(output: string | Buffer | null | undefined): string {
  if (typeof output === "string") {
    return output.trim();
  }

  if (output instanceof Buffer) {
    return output.toString("utf8").trim();
  }

  return "";
}

function tryReadRenderedAssetMetadata(filePath: string): { metadata: RenderedAssetMetadata | null; error?: string } {
  if (!existsSync(filePath)) {
    return { metadata: null };
  }

  try {
    return {
      metadata: JSON.parse(readFileSync(filePath, "utf8")) as RenderedAssetMetadata
    };
  } catch (error) {
    return {
      metadata: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getRequirementMap(profile: GuyProfileManifest): Map<string, BinaryRequirement> {
  return new Map(profile.binaryRequirements.map((requirement) => [requirement.id, requirement]));
}

function getProfileForDoctor(explicitHomeDirectory?: string): GuyProfileManifest {
  const runtime = getRuntimeContract(explicitHomeDirectory);
  const stateResult = tryReadInstallState(explicitHomeDirectory);
  const profileId = stateResult.state?.profileId ?? runtime.defaultProfileId;
  return loadResolvedProfileManifest(profileId);
}

export function getDefaultDoctorChecks(explicitHomeDirectory?: string): DoctorCheck[] {
  const paths = resolveGuyPaths(explicitHomeDirectory);
  const profile = getProfileForDoctor(explicitHomeDirectory);
  const stateResult = tryReadInstallState(explicitHomeDirectory);
  const profileId = stateResult.state?.profileId ?? profile.id;
  const renderedAssetPath = path.join(paths.renderedDir, profileId, "assets.json");
  const claude = getClaudeAuthContract();
  const codex = getCodexAuthContract();

  const allChecks: DoctorCheck[] = [
    {
      id: "runtime-state",
      title: "Runtime state file exists",
      severity: "error",
      target: paths.installStateFile,
      remediation: `Run guy install to create ${paths.installStateFile}`
    },
    {
      id: "managed-assets",
      title: "Managed assets render metadata exists",
      severity: "error",
      target: renderedAssetPath,
      remediation: "Run guy install or guy repair to restore managed assets"
    },
    {
      id: "pi",
      title: "Pi runtime is installed and package-ready",
      severity: "error",
      target: profile.binaryRequirements.find((requirement) => requirement.id === "pi")?.verifyCommand ?? "pi --version",
      remediation: "Run guy doctor --fix or guy repair to install Pi, sync packages, and restore the managed runtime"
    },
    {
      id: "claude-auth",
      title: "Claude auth is ready",
      severity: "warning",
      target: claude.statusCommand?.join(" ") ?? claude.loginCommand.join(" "),
      remediation: "Install Claude Code, then run guy auth claude"
    },
    {
      id: "codex-auth",
      title: "Codex auth is ready",
      severity: "warning",
      target: codex.loginCommand.join(" "),
      remediation: "Install Codex, then run guy auth codex"
    },
    {
      id: "platform",
      title: "Current platform is supported",
      severity: "info",
      target: profile.supportedPlatforms.join(", "),
      remediation: "Use The Guy v0.1 on macOS"
    }
  ];

  const configuredChecks = new Set(profile.doctorChecks);
  return allChecks.filter((check) => configuredChecks.has(check.id as GuyProfileManifest["doctorChecks"][number]));
}

export function runDoctor(explicitHomeDirectory?: string): DoctorCheckResult[] {
  const runtime = getRuntimeContract(explicitHomeDirectory);
  const profile = getProfileForDoctor(explicitHomeDirectory);
  const requirementMap = getRequirementMap(profile);
  const stateResult = tryReadInstallState(explicitHomeDirectory);
  const checks = getDefaultDoctorChecks(explicitHomeDirectory);
  const profileId = stateResult.state?.profileId ?? runtime.defaultProfileId;
  const renderedAssetPath = path.join(resolveGuyPaths(explicitHomeDirectory).renderedDir, profileId, "assets.json");
  const renderedAssetsResult = tryReadRenderedAssetMetadata(renderedAssetPath);
  const platform = detectSupportedPlatform();
  const claude = getClaudeAuthContract();
  const codex = getCodexAuthContract();

  return checks.map((check) => {
    switch (check.id) {
      case "runtime-state": {
        if (stateResult.error) {
          return {
            ...check,
            status: "fail",
            detail: stateResult.error
          };
        }

        return {
          ...check,
          status: stateResult.state ? "pass" : "fail",
          detail: stateResult.state
            ? `Loaded profile ${stateResult.state.profileId}`
            : "install.json is missing"
        };
      }
      case "managed-assets": {
        if (stateResult.error) {
          return {
            ...check,
            status: "fail",
            detail: "Install state is unreadable, so rendered assets cannot be verified"
          };
        }

        if (!stateResult.state) {
          return {
            ...check,
            status: "fail",
            detail: "No install state found, so rendered assets cannot be verified"
          };
        }

        if (renderedAssetsResult.error) {
          return {
            ...check,
            status: "fail",
            detail: renderedAssetsResult.error
          };
        }

        if (!renderedAssetsResult.metadata) {
          return {
            ...check,
            status: "fail",
            detail: `Rendered asset metadata missing: ${renderedAssetPath}`
          };
        }

        const missingDestinations = renderedAssetsResult.metadata.assets
          .map((asset) => asset.destinationPath)
          .filter((destinationPath) => !existsSync(destinationPath));

        return {
          ...check,
          status: missingDestinations.length === 0 ? "pass" : "fail",
          detail:
            missingDestinations.length === 0
              ? `${renderedAssetsResult.metadata.assets.length} managed assets accounted for`
              : `Missing managed destinations: ${missingDestinations.join(", ")}`
        };
      }
      case "pi": {
        const requirement = requirementMap.get("pi");
        const result = requirement?.verifyCommand
          ? runVerifyCommand(requirement.verifyCommand)
          : { ok: commandExists("pi"), output: "" };

        if (!result.ok) {
          return {
            ...check,
            status: "fail",
            detail: result.output || "Pi CLI check failed"
          };
        }

        const packageStatus = inspectPiPackages(explicitHomeDirectory);
        if (!packageStatus.settingsExists) {
          return {
            ...check,
            status: "fail",
            detail: packageStatus.skippedReason ?? "Pi settings file is missing"
          };
        }

        if (packageStatus.missingLocalPackages.length > 0) {
          return {
            ...check,
            status: "fail",
            detail: `Missing Pi local packages: ${packageStatus.missingLocalPackages.join(", ")}`
          };
        }

        if (packageStatus.missingRemotePackages.length > 0) {
          return {
            ...check,
            status: "fail",
            detail: `Missing Pi remote packages: ${packageStatus.missingRemotePackages.join(", ")}`
          };
        }

        if (!packageStatus.packageListOk) {
          return {
            ...check,
            status: "fail",
            detail: packageStatus.skippedReason ?? "Pi package verification failed"
          };
        }

        return {
          ...check,
          status: "pass",
          detail: `Pi CLI passed verification with ${packageStatus.packages.length} configured package${packageStatus.packages.length === 1 ? "" : "s"}`
        };
      }
      case "claude-auth": {
        const requirement = requirementMap.get("claude");
        if (!commandExists(claude.binaryName)) {
          return {
            ...check,
            status: requirement?.required ? "fail" : "warn",
            detail: "Claude CLI not found"
          };
        }

        if (!claude.statusCommand) {
          return {
            ...check,
            status: "warn",
            detail: "Claude CLI found, but no auth status command is configured"
          };
        }

        const [binaryName, ...args] = claude.statusCommand;
        if (!binaryName) {
          return {
            ...check,
            status: "warn",
            detail: "Claude auth status command is not configured"
          };
        }

        const result = spawnSync(binaryName, args, {
          stdio: "pipe",
          encoding: "utf8",
          timeout: 10_000
        });
        const output = trimOutput(result.stdout) || trimOutput(result.stderr) || "Claude auth status unavailable";

        return {
          ...check,
          status: (result.status ?? 1) === 0 ? "pass" : "warn",
          detail: output
        };
      }
      case "codex-auth": {
        const requirement = requirementMap.get("codex");
        if (!commandExists(codex.binaryName)) {
          return {
            ...check,
            status: requirement?.required ? "fail" : "warn",
            detail: "Codex CLI not found"
          };
        }

        const authFile = path.join(resolveHomeDirectory(explicitHomeDirectory), ".codex", "auth.json");
        return {
          ...check,
          status: existsSync(authFile) ? "pass" : "warn",
          detail: existsSync(authFile)
            ? `Found Codex auth file at ${authFile}`
            : `Codex CLI found, but ${authFile} is missing`
        };
      }
      case "platform": {
        const supported = platform !== null && profile.supportedPlatforms.includes(platform);
        return {
          ...check,
          status: supported ? "pass" : "fail",
          detail: supported ? `Detected ${platform}` : "Unsupported platform"
        };
      }
      default: {
        return {
          ...check,
          status: "warn",
          detail: "No evaluator registered"
        };
      }
    }
  });
}

export function formatDoctorResults(results: readonly DoctorCheckResult[]): string[] {
  return results.flatMap((result) => {
    const lines = [
      `- [${result.status}] ${result.title}`,
      `  target: ${result.target}`,
      `  detail: ${result.detail}`
    ];

    if (result.status !== "pass") {
      lines.push(`  fix: ${result.remediation}`);
    }

    return lines;
  });
}
