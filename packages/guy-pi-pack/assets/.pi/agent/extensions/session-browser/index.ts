/**
 * Session Browser Extension
 *
 * Registers /sessions command that opens a project-grouped session browser.
 * Groups sessions by working directory, supports expand/collapse, search,
 * and smart path shortening.
 *
 * Uses ctx.ui.custom() for full TUI takeover — no core changes needed.
 */

import * as os from "node:os";
import { type ExtensionAPI, SessionManager, type SessionInfo } from "@mariozechner/pi-coding-agent";
import { Container, Input, Text, type Component, type Focusable, getKeybindings } from "@mariozechner/pi-tui";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";

// ── Types ────────────────────────────────────────────────────────────

interface ProjectGroup {
	cwd: string;
	shortPath: string;
	sessions: SessionInfo[];
	collapsed: boolean;
	lastModified: Date;
	sessionCount: number;
}

type DisplayRow =
	| { type: "project"; group: ProjectGroup; index: number }
	| { type: "session"; session: SessionInfo; group: ProjectGroup; index: number };

// ── Helpers ──────────────────────────────────────────────────────────

function shortenHome(p: string): string {
	const home = os.homedir();
	return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

/**
 * Compute shortest unique path suffixes for a set of directories.
 * e.g. [~/Dev/a/foo, ~/Dev/b/foo, ~/Dev/c/bar] → [a/foo, b/foo, bar]
 */
function computeShortPaths(cwds: string[]): Map<string, string> {
	const result = new Map<string, string>();
	if (cwds.length === 0) return result;

	// Split all paths into segments
	const segmented = cwds.map((cwd) => {
		const clean = shortenHome(cwd);
		return { cwd, segments: clean.split("/").filter(Boolean) };
	});

	for (const { cwd, segments } of segmented) {
		// Try increasingly long suffixes until unique
		for (let len = 1; len <= segments.length; len++) {
			const suffix = segments.slice(-len).join("/");
			const isUnique = segmented.every(
				(other) => other.cwd === cwd || !other.segments.slice(-len).join("/").endsWith(suffix) || other.segments.slice(-len).join("/") !== suffix,
			);
			if (isUnique || len === segments.length) {
				result.set(cwd, suffix);
				break;
			}
		}
	}
	return result;
}

function formatAge(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(diffMs / 3600000);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(diffMs / 86400000);
	if (days < 7) return `${days}d`;
	if (days < 30) return `${Math.floor(days / 7)}w`;
	if (days < 365) return `${Math.floor(days / 30)}mo`;
	return `${Math.floor(days / 365)}y`;
}

function groupByProject(sessions: SessionInfo[]): ProjectGroup[] {
	const byCwd = new Map<string, SessionInfo[]>();
	for (const s of sessions) {
		const cwd = s.cwd || "(unknown)";
		if (!byCwd.has(cwd)) byCwd.set(cwd, []);
		byCwd.get(cwd)!.push(s);
	}

	const shortPaths = computeShortPaths(Array.from(byCwd.keys()));

	const groups: ProjectGroup[] = [];
	for (const [cwd, groupSessions] of byCwd) {
		// Sort sessions by modified date descending
		groupSessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
		groups.push({
			cwd,
			shortPath: shortPaths.get(cwd) || shortenHome(cwd),
			sessions: groupSessions,
			collapsed: true, // Start collapsed
			lastModified: groupSessions[0]?.modified ?? new Date(0),
			sessionCount: groupSessions.length,
		});
	}

	// Sort groups by last modified descending
	groups.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

	// Auto-expand the first group
	if (groups.length > 0) groups[0].collapsed = false;

	return groups;
}

function buildDisplayRows(groups: ProjectGroup[], searchQuery: string): DisplayRow[] {
	const rows: DisplayRow[] = [];
	const query = searchQuery.toLowerCase().trim();
	let idx = 0;

	for (const group of groups) {
		const matchingSessions = query
			? group.sessions.filter((s) => {
					const text = `${s.name || ""} ${s.firstMessage} ${s.cwd}`.toLowerCase();
					return text.includes(query);
				})
			: group.sessions;

		// Skip groups with no matching sessions when searching
		if (query && matchingSessions.length === 0) continue;

		rows.push({ type: "project", group, index: idx++ });

		// When searching, force-expand groups with matches
		const isExpanded = query ? true : !group.collapsed;

		if (isExpanded) {
			for (const session of matchingSessions) {
				rows.push({ type: "session", session, group, index: idx++ });
			}
		}
	}
	return rows;
}

// ── Browser Component ────────────────────────────────────────────────

class SessionBrowser implements Component, Focusable {
	private groups: ProjectGroup[] = [];
	private displayRows: DisplayRow[] = [];
	private selectedIndex = 0;
	private searchInput: Input;
	private maxVisible = 18;
	private loading = true;
	private loadProgress: { loaded: number; total: number } | null = null;
	private onSelectSession: (path: string) => void;
	private onCancel: () => void;

	_focused = false;
	get focused() { return this._focused; }
	set focused(v) {
		this._focused = v;
		this.searchInput.focused = v;
	}

	constructor(onSelect: (path: string) => void, onCancel: () => void) {
		this.onSelectSession = onSelect;
		this.onCancel = onCancel;
		this.searchInput = new Input();
		this.searchInput.onSubmit = () => this.selectCurrent();
	}

	setSessions(sessions: SessionInfo[]) {
		this.loading = false;
		this.groups = groupByProject(sessions);
		this.rebuildRows();
	}

	setProgress(loaded: number, total: number) {
		this.loadProgress = { loaded, total };
	}

	private rebuildRows() {
		this.displayRows = buildDisplayRows(this.groups, this.searchInput.getValue());
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.displayRows.length - 1));
	}

	private selectCurrent() {
		const row = this.displayRows[this.selectedIndex];
		if (!row) return;
		if (row.type === "project") {
			row.group.collapsed = !row.group.collapsed;
			this.rebuildRows();
		} else {
			this.onSelectSession(row.session.path);
		}
	}

	invalidate() {}

	render(width: number): string[] {
		const lines: string[] = [];

		// Header
		lines.push("  \x1b[1mSessions by Project\x1b[0m");
		lines.push("");

		// Search
		lines.push(...this.searchInput.render(width));
		lines.push("");

		if (this.loading) {
			const progress = this.loadProgress ? ` (${this.loadProgress.loaded}/${this.loadProgress.total})` : "";
			lines.push(`  \x1b[2mLoading sessions${progress}...\x1b[0m`);
			return lines;
		}

		if (this.displayRows.length === 0) {
			lines.push("  \x1b[2mNo sessions found.\x1b[0m");
			return lines;
		}

		// Calculate visible window
		const start = Math.max(0, Math.min(
			this.selectedIndex - Math.floor(this.maxVisible / 2),
			this.displayRows.length - this.maxVisible,
		));
		const end = Math.min(start + this.maxVisible, this.displayRows.length);

		for (let i = start; i < end; i++) {
			const row = this.displayRows[i];
			const isSelected = i === this.selectedIndex;
			const cursor = isSelected ? "\x1b[36m› \x1b[0m" : "  ";

			if (row.type === "project") {
				const g = row.group;
				const arrow = g.collapsed ? "▸" : "▼";
				const count = `${g.sessionCount} session${g.sessionCount !== 1 ? "s" : ""}`;
				const age = formatAge(g.lastModified);
				let line = `${cursor}\x1b[1m${arrow} ${g.shortPath}\x1b[0m  \x1b[2m${count} · ${age}\x1b[0m`;
				if (isSelected) line = `\x1b[46m\x1b[30m${line}\x1b[0m`;
				lines.push(truncate(line, width));
			} else {
				const s = row.session;
				const name = s.name ?? s.firstMessage.replace(/[\x00-\x1f\x7f]/g, " ").trim();
				const age = formatAge(s.modified);
				const msgs = String(s.messageCount);
				const nameStyle = s.name ? "\x1b[33m" : "";
				const nameEnd = s.name ? "\x1b[0m" : "";

				// Right side
				const rightPart = `${msgs} ${age}`;
				const rightWidth = rightPart.length + 2;
				const availableForName = Math.max(10, width - 6 - rightWidth);
				const truncatedName = name.length > availableForName
					? name.slice(0, availableForName - 1) + "…"
					: name;

				let line = `${cursor}  ${nameStyle}${truncatedName}${nameEnd}`;
				const lineVisWidth = visibleWidth(line);
				const spacing = Math.max(1, width - lineVisWidth - rightPart.length);
				line += " ".repeat(spacing) + `\x1b[2m${rightPart}\x1b[0m`;

				if (isSelected) {
					line = `\x1b[1m${line}\x1b[0m`;
				}
				lines.push(truncate(line, width));
			}
		}

		// Scroll indicator
		if (start > 0 || end < this.displayRows.length) {
			lines.push(`  \x1b[2m(${this.selectedIndex + 1}/${this.displayRows.length})\x1b[0m`);
		}

		// Hints
		lines.push("");
		lines.push("  \x1b[2mEnter: select/toggle · Esc: cancel · ←/→ or h/l: collapse/expand\x1b[0m");

		return lines;
	}

	handleInput(data: string): void {
		const kb = getKeybindings();

		if (kb.matches(data, "tui.select.up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
		} else if (kb.matches(data, "tui.select.down")) {
			this.selectedIndex = Math.min(this.displayRows.length - 1, this.selectedIndex + 1);
		} else if (kb.matches(data, "tui.select.pageUp")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
		} else if (kb.matches(data, "tui.select.pageDown")) {
			this.selectedIndex = Math.min(this.displayRows.length - 1, this.selectedIndex + this.maxVisible);
		} else if (kb.matches(data, "tui.select.confirm")) {
			this.selectCurrent();
		} else if (kb.matches(data, "tui.select.cancel")) {
			this.onCancel();
		} else if (data === "h" || data === "\x1b[D") {
			// Left / h — collapse current project
			const row = this.displayRows[this.selectedIndex];
			if (row?.type === "session") {
				row.group.collapsed = true;
				this.rebuildRows();
				// Move selection to the project row
				const projRow = this.displayRows.find((r) => r.type === "project" && r.group === row.group);
				if (projRow) this.selectedIndex = this.displayRows.indexOf(projRow);
			} else if (row?.type === "project" && !row.group.collapsed) {
				row.group.collapsed = true;
				this.rebuildRows();
			}
		} else if (data === "l" || data === "\x1b[C") {
			// Right / l — expand current project
			const row = this.displayRows[this.selectedIndex];
			if (row?.type === "project" && row.group.collapsed) {
				row.group.collapsed = false;
				this.rebuildRows();
			}
		} else {
			// Pass to search input
			this.searchInput.handleInput(data);
			this.rebuildRows();
		}
	}
}

// ── Utilities ────────────────────────────────────────────────────────

/** Count visible characters (strip ANSI codes) */
function visibleWidth(s: string): number {
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Truncate a string (with ANSI) to fit terminal width */
function truncate(s: string, maxWidth: number): string {
	let visible = 0;
	let i = 0;
	while (i < s.length && visible < maxWidth) {
		if (s[i] === "\x1b") {
			const end = s.indexOf("m", i);
			if (end !== -1) { i = end + 1; continue; }
		}
		visible++;
		i++;
	}
	return i < s.length ? s.slice(0, i) + "\x1b[0m" : s;
}

// ── Extension Entry ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	if (!isFeatureEnabled("session-browser")) return;
	pi.registerCommand("sessions", {
		description: "Browse all sessions grouped by project",
		handler: async (_args, ctx) => {
			const selected = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) => {
				const browser = new SessionBrowser(
					(sessionPath) => done(sessionPath),
					() => done(null),
				);

				// Start loading
				SessionManager.listAll((loaded, total) => {
					browser.setProgress(loaded, total);
					tui.requestRender();
				}).then((sessions) => {
					browser.setSessions(sessions);
					tui.requestRender();
				}).catch(() => {
					browser.setSessions([]);
					tui.requestRender();
				});

				return browser;
			});

			if (selected) {
				await ctx.switchSession(selected);
			}
		},
	});
}
