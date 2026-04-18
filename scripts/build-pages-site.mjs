import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stackOverview } from "../site/content/stack-overview.mjs";
import { renderMarkdownBlocks, renderStackPage } from "../site/templates/render-stack-page.mjs";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const siteDir = path.join(rootDir, "site");
const outputPath = path.join(siteDir, "index.html");

function parseChangelog(markdown) {
  const sections = markdown
    .split(/\n(?=## \[)/g)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## ["));

  return sections.map((section) => {
    const [headingLine, ...bodyLines] = section.split(/\r?\n/);
    const headingMatch = headingLine.match(/^## \[([^\]]+)\]\(([^)]+)\) - (.+)$/);
    if (!headingMatch) {
      throw new Error(`Unparseable changelog heading: ${headingLine}`);
    }

    const [, tag, url, date] = headingMatch;
    let fullChangelogUrl = url;
    const filteredBodyLines = [];

    for (const line of bodyLines) {
      const fullChangelogMatch = line.match(/^\*\*Full Changelog\*\*: (.+)$/);
      if (fullChangelogMatch) {
        fullChangelogUrl = fullChangelogMatch[1].trim();
        continue;
      }
      filteredBodyLines.push(line);
    }

    const cleanedBody = filteredBodyLines.join("\n").trim();

    return {
      tag,
      url,
      date,
      fullChangelogUrl,
      body: cleanedBody,
      htmlBody: cleanedBody ? renderMarkdownBlocks(cleanedBody) : ""
    };
  });
}

function buildSite() {
  const changelog = readFileSync(changelogPath, "utf8");
  const releases = parseChangelog(changelog);
  const html = renderStackPage(stackOverview, releases, {
    generatedAtLabel: new Date().toISOString().replace("T", " ").replace(/\..+$/, " UTC")
  });

  mkdirSync(siteDir, { recursive: true });
  writeFileSync(outputPath, `${html}\n`);
  console.log(`Built ${outputPath}`);
}

buildSite();
