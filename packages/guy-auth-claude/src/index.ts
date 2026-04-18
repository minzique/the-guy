import type { ProviderAuthContract } from "@the-guy/core";

export function getClaudeAuthContract(): ProviderAuthContract {
  return {
    providerId: "claude",
    binaryName: "claude",
    loginCommand: ["claude", "auth", "login"],
    statusCommand: ["claude", "auth", "status"],
    installManagedByGuy: false,
    installHint: "Install Claude Code before running guy auth claude.",
    supportedPlatforms: ["darwin"]
  };
}

export function describeClaudeAuthFlow(): string[] {
  const contract = getClaudeAuthContract();

  return [
    `provider: ${contract.providerId}`,
    `binary: ${contract.binaryName}`,
    `login command: ${contract.loginCommand.join(" ")}`,
    `status command: ${contract.statusCommand?.join(" ") ?? "n/a"}`,
    `install managed by guy: ${contract.installManagedByGuy ? "yes" : "no"}`,
    `install hint: ${contract.installHint}`
  ];
}
