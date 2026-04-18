import type { ProviderAuthContract } from "@the-guy/core";

export function getCodexAuthContract(): ProviderAuthContract {
  return {
    providerId: "codex",
    binaryName: "codex",
    loginCommand: ["codex", "login"],
    installManagedByGuy: false,
    installHint: "Install Codex before running guy auth codex.",
    supportedPlatforms: ["darwin"]
  };
}

export function describeCodexAuthFlow(): string[] {
  const contract = getCodexAuthContract();

  return [
    `provider: ${contract.providerId}`,
    `binary: ${contract.binaryName}`,
    `login command: ${contract.loginCommand.join(" ")}`,
    `status command: ${contract.statusCommand?.join(" ") ?? "n/a"}`,
    `install managed by guy: ${contract.installManagedByGuy ? "yes" : "no"}`,
    `install hint: ${contract.installHint}`
  ];
}
