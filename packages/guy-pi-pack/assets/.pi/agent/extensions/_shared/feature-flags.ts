import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const FEATURE_IDS = [
	"btw",
	"context-awareness",
	"custom-compaction",
	"dcg",
	"session-browser",
	"subagent",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];
export type FeatureFlags = Partial<Record<Exclude<FeatureId, "btw">, boolean>>;

type SettingsShape = {
	packages?: unknown[];
	[key: string]: unknown;
};

const BTW_PACKAGE_PATH = "../../Developer/dotfiles-agents/packages/pi-btw";

export const FEATURE_LABELS: Record<FeatureId, string> = {
	btw: "Side questions (/btw package)",
	"context-awareness": "Context awareness + todos",
	"custom-compaction": "Custom compaction",
	dcg: "Destructive command guard",
	"session-browser": "Session browser (/sessions)",
	subagent: "Subagents + background tasks",
};

export function getFeaturesPath(): string {
	return path.join(os.homedir(), ".pi", "agent", "extensions", "features.json");
}

export function getSettingsPath(): string {
	return path.join(os.homedir(), ".pi", "agent", "settings.json");
}

export function getBtwPackagePath(): string {
	return BTW_PACKAGE_PATH;
}

export function readFeatureFlags(): FeatureFlags {
	try {
		const raw = fs.readFileSync(getFeaturesPath(), "utf-8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const flags: FeatureFlags = {};
		for (const id of FEATURE_IDS) {
			if (id === "btw") continue;
			if (typeof parsed[id] === "boolean") flags[id] = parsed[id];
		}
		return flags;
	} catch {
		return {};
	}
}

export function writeFeatureFlags(flags: FeatureFlags): void {
	const filePath = getFeaturesPath();
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(flags, null, 2)}\n`, "utf-8");
}

function readSettings(): SettingsShape {
	try {
		return JSON.parse(fs.readFileSync(getSettingsPath(), "utf-8")) as SettingsShape;
	} catch {
		return {};
	}
}

function writeSettings(settings: SettingsShape): void {
	const filePath = getSettingsPath();
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

function packageList(settings: SettingsShape): string[] {
	return (settings.packages ?? []).filter((item): item is string => typeof item === "string");
}

export function isBtwPackageEnabled(): boolean {
	return packageList(readSettings()).includes(BTW_PACKAGE_PATH);
}

export function setBtwPackageEnabled(enabled: boolean): boolean {
	const settings = readSettings();
	const packages = packageList(settings).filter((item) => item !== BTW_PACKAGE_PATH);
	if (enabled) packages.push(BTW_PACKAGE_PATH);
	settings.packages = packages;
	writeSettings(settings);
	return enabled;
}

export function isFeatureEnabled(id: FeatureId): boolean {
	if (id === "btw") return isBtwPackageEnabled();
	return readFeatureFlags()[id] !== false;
}

export function setFeatureEnabled(id: FeatureId, enabled: boolean): boolean {
	if (id === "btw") return setBtwPackageEnabled(enabled);
	const flags = readFeatureFlags();
	flags[id] = enabled;
	writeFeatureFlags(flags);
	return enabled;
}

export function toggleFeature(id: FeatureId): boolean {
	return setFeatureEnabled(id, !isFeatureEnabled(id));
}

export function parseFeatureId(value: string): FeatureId | null {
	const normalized = value.trim().toLowerCase();
	for (const id of FEATURE_IDS) {
		if (normalized === id) return id;
	}
	return null;
}

export function renderFeatureLines(flags: FeatureFlags = readFeatureFlags()): string[] {
	return FEATURE_IDS.map((id) => {
		const enabled = id === "btw" ? isBtwPackageEnabled() : flags[id] !== false;
		return `${enabled ? "on " : "off"} ${id} — ${FEATURE_LABELS[id]}`;
	});
}
