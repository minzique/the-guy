import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);

function readFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

const releaseJsonPath = readFlag("--release-json");
if (!releaseJsonPath) {
  console.error("Usage: node ./scripts/update-changelog-from-release.mjs --release-json <path> [--changelog <path>]");
  process.exit(1);
}

const changelogPath = path.resolve(repoRoot, readFlag("--changelog") ?? "CHANGELOG.md");
const release = JSON.parse(readFileSync(path.resolve(repoRoot, releaseJsonPath), "utf8"));

if (!release.tagName || !release.url || !release.publishedAt) {
  console.error("Release JSON must include tagName, url, and publishedAt.");
  process.exit(1);
}

const tag = String(release.tagName).trim();
const date = new Date(release.publishedAt).toISOString().slice(0, 10);
const header = `## [${tag}](${release.url}) - ${date}`;
const body = formatBody(release.body);
const nextEntry = `${header}\n\n${body}`;

const existing = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf8").replace(/\r\n/g, "\n")
  : defaultChangelog();

const updated = upsertEntry(existing, tag, nextEntry).trimEnd() + "\n";
writeFileSync(changelogPath, updated);

function defaultChangelog() {
  return [
    "# Changelog",
    "",
    "This file is updated automatically from GitHub release notes.",
    ""
  ].join("\n");
}

function formatBody(rawBody) {
  const trimmed = String(rawBody ?? "").trim();
  if (!trimmed) {
    return "- Release notes were empty for this tag.";
  }

  return trimmed
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .trim();
}

function upsertEntry(markdown, tagName, entryBody) {
  const normalized = markdown.replace(/\r\n/g, "\n").trimEnd();
  const introMatch = normalized.match(/^# Changelog\n\n(?:.*\n)*?(?=\n## |$)/u);
  const intro = introMatch?.[0]?.trimEnd() ?? defaultChangelog().trimEnd();
  const entriesStart = intro.length;
  const entriesBlock = normalized.slice(entriesStart).trim();
  const entries = entriesBlock ? entriesBlock.split(/\n(?=## )/u) : [];
  const filtered = entries.filter((entry) => {
    const firstLine = entry.split("\n", 1)[0]?.trim() ?? "";
    return !firstLine.startsWith(`## [${tagName}](`) && firstLine !== `## ${tagName}`;
  });

  return [intro, "", entryBody, ...(filtered.length > 0 ? ["", filtered.join("\n\n")] : [])].join("\n");
}
