/**
 * Context Awareness Extension
 *
 * 1. Injects context usage + persistent todo lists into system prompt
 *    - Shared project board: .pi/todos.md (cross-session coordination)
 *    - Session-scoped todos: .pi/todos/<session-id>.md (private, no conflicts)
 * 2. Registers `self_compact` — writes handoff doc, validates todos, compacts
 * 3. Warns at thresholds but never blocks the orchestrator
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { isFeatureEnabled } from "./_shared/feature-flags.ts";

const WARN_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 70;
const URGENT_THRESHOLD = 85;

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(tokens: number): string {
	if (tokens < 1000) return `${tokens}`;
	if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
	return `${(tokens / 1_000_000).toFixed(2)}M`;
}

function bar(percent: number): string {
	const w = 20;
	const filled = Math.round((percent / 100) * w);
	const ch = percent >= URGENT_THRESHOLD ? "█" : percent >= CRITICAL_THRESHOLD ? "▓" : "░";
	return `[${ch.repeat(filled)}${"·".repeat(w - filled)}]`;
}

function contextStatus(tokens: number | null, window: number, percent: number | null): string {
	if (tokens === null || percent === null) {
		return `Context: unknown / ${fmt(window)} (post-compaction, awaiting next response)`;
	}
	let s = `Context: ${fmt(tokens)} / ${fmt(window)} (${percent.toFixed(1)}%) ${bar(percent)}`;
	if (percent >= URGENT_THRESHOLD) {
		s += `\n⚠️ URGENT: Context ${percent.toFixed(0)}% full. Compact NOW with self_compact or risk truncation.`;
	} else if (percent >= CRITICAL_THRESHOLD) {
		s += `\n⚠️ Context at ${percent.toFixed(0)}%. Compact soon if more work remains.`;
	} else if (percent >= WARN_THRESHOLD) {
		s += `\nℹ️ Context at ${percent.toFixed(0)}%. Be mindful of large file reads.`;
	}
	return s;
}

function findProjectRoot(cwd: string): string {
	let dir = cwd;
	while (true) {
		if (fs.existsSync(path.join(dir, ".git"))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return cwd;
		dir = parent;
	}
}

/**
 * Resolve the main worktree root (where .pi/ lives).
 * In a worktree, .git is a file with "gitdir: /main/.git/worktrees/<name>".
 * We follow that back to the main repo root.
 * In a normal repo, this returns the same as findProjectRoot.
 */
function findMainRoot(cwd: string): string {
	const root = findProjectRoot(cwd);
	try {
		const gitPath = path.join(root, ".git");
		const stat = fs.statSync(gitPath);
		if (stat.isFile()) {
			const content = fs.readFileSync(gitPath, "utf-8").trim();
			const match = content.match(/^gitdir:\s*(.+)$/);
			if (match) {
				// gitdir points to /main/.git/worktrees/<name>
				// Walk up to find the dir containing .git as a directory
				const resolved = path.resolve(root, match[1]);
				// .git/worktrees/<name> → .git → repo root
				const dotGit = resolved.replace(/\/worktrees\/[^/]+$/, "");
				const mainRoot = path.dirname(dotGit);
				if (fs.existsSync(path.join(mainRoot, ".pi"))) return mainRoot;
			}
		}
	} catch { /* not a worktree */ }
	return root;
}

// ── Todo Path Resolution ─────────────────────────────────────────────

/** Shared project board — always .pi/todos.md at main repo root */
function sharedTodosPath(cwd: string): string {
	return path.join(findMainRoot(cwd), ".pi", "todos.md");
}

/** Session-scoped todos — .pi/todos/<session-id>.md. Returns null if no session ID. */
function sessionTodosPath(cwd: string, sessionId: string | undefined): string | null {
	if (!sessionId) return null;
	return path.join(findMainRoot(cwd), ".pi", "todos", `${sessionId}.md`);
}

/** Get current git branch name, handling worktrees. Returns null for detached HEAD. */
function getCurrentBranch(cwd: string): string | null {
	try {
		const root = findProjectRoot(cwd);
		let gitPath = path.join(root, ".git");

		// Handle worktrees: .git is a file with "gitdir: <path>"
		const stat = fs.statSync(gitPath);
		if (stat.isFile()) {
			const content = fs.readFileSync(gitPath, "utf-8").trim();
			const match = content.match(/^gitdir:\s*(.+)$/);
			if (match) {
				gitPath = path.resolve(root, match[1]);
			}
		}

		const head = fs.readFileSync(path.join(gitPath, "HEAD"), "utf-8").trim();
		if (head.startsWith("ref: refs/heads/")) {
			return head.slice("ref: refs/heads/".length);
		}
		return null; // detached HEAD
	} catch {
		return null;
	}
}

/** Convert branch name to filesystem-safe slug: feat/foo-bar → feat-foo-bar */
function branchSlug(branch: string): string {
	return branch.replace(/\//g, "-");
}

/** Branch-scoped todos — .pi/todos/by-branch/<slug>.md */
function branchTodosPath(cwd: string, branch: string): string {
	return path.join(findMainRoot(cwd), ".pi", "todos", "by-branch", `${branchSlug(branch)}.md`);
}

/**
 * Resolve the active todo file for this session.
 * Priority: --todo-id flag > existing session-scoped > existing branch-scoped > shared board.
 * If no scoped todo exists yet, fall back to the shared board so agents still see pending work.
 */
function activeTodosPath(cwd: string, sessionId: string | undefined, todoId: string | undefined): string {
	if (todoId) {
		return path.join(findMainRoot(cwd), ".pi", "todos", `${todoId}.md`);
	}
	const sessionPath = sessionTodosPath(cwd, sessionId);
	if (sessionPath && fs.existsSync(sessionPath)) {
		return sessionPath;
	}
	const branch = getCurrentBranch(cwd);
	if (branch) {
		const branchPath = branchTodosPath(cwd, branch);
		if (fs.existsSync(branchPath)) {
			return branchPath;
		}
	}
	const shared = sharedTodosPath(cwd);
	if (fs.existsSync(shared)) {
		return shared;
	}
	return sessionPath ?? shared;
}

function readFile(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

function parseOpenTodos(content: string): string[] {
	const items: string[] = [];
	for (const line of content.split("\n")) {
		const m = line.match(/^[-*]\s+\[\s\]\s+(.+)/);
		if (m) items.push(m[1].trim());
	}
	return items;
}

function parseDoneTodos(content: string): string[] {
	const items: string[] = [];
	for (const line of content.split("\n")) {
		const m = line.match(/^[-*]\s+\[x\]\s+(.+)/i);
		if (m) items.push(m[1].trim());
	}
	return items;
}

function handoffsDir(cwd: string): string {
	return path.join(findMainRoot(cwd), ".pi", "handoffs");
}

function writeHandoff(cwd: string, content: string): string {
	const dir = handoffsDir(cwd);
	fs.mkdirSync(dir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const fp = path.join(dir, `${ts}.md`);
	fs.writeFileSync(fp, content, "utf-8");
	return fp;
}

function listHandoffs(cwd: string): string[] {
	const dir = handoffsDir(cwd);
	try {
		return fs.readdirSync(dir)
			.filter((name) => name.endsWith(".md"))
			.map((name) => path.join(dir, name))
			.sort((a, b) => b.localeCompare(a));
	} catch {
		return [];
	}
}

function resolveHandoffPath(cwd: string, raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed || trimmed === "latest") {
		return listHandoffs(cwd)[0] ?? null;
	}
	if (path.isAbsolute(trimmed)) {
		return fs.existsSync(trimmed) ? trimmed : null;
	}
	const candidates = [
		path.join(cwd, trimmed),
		path.join(findMainRoot(cwd), trimmed),
		path.join(handoffsDir(cwd), trimmed),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

function freshSessionMessage(handoffPath: string, todoPath: string): string {
	return [
		"Fresh-session restore. Previous chat history is intentionally unavailable.",
		"",
		"Canonical restore sources:",
		`1. read ${handoffPath}`,
		`2. read ${todoPath}`,
		"",
		"Rules:",
		"- Treat the handoff as canonical state.",
		"- Do not assume any earlier conversation is still present.",
		"- Continue from the documented next steps, blockers, and open todos.",
		"- If the todo file above is not the active session todo file, migrate relevant open items into the current active todo file before continuing.",
	].join("\n");
}

// ── Extension ────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	if (!isFeatureEnabled("context-awareness")) return;

	pi.registerCommand("fresh", {
		description: "Start a clean session from the latest or specified handoff",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();
			const handoffPath = resolveHandoffPath(ctx.cwd, args);
			if (!handoffPath) {
				ctx.ui.notify("No handoff found. Use /fresh latest or pass a handoff path.", "warning");
				return;
			}

			const todoPath = getActiveTodosPath(ctx);
			const restoreMessage = freshSessionMessage(handoffPath, todoPath);
			const result = await ctx.newSession({
				setup: async (sessionManager: SessionManager) => {
					sessionManager.appendMessage({
						role: "user",
						content: [{ type: "text", text: restoreMessage }],
						timestamp: Date.now(),
					});
				},
			});

			const cancelled = typeof result === "boolean" ? !result : result.cancelled;
			if (!cancelled) {
				ctx.ui.notify(`Fresh session started from ${path.basename(handoffPath)}`, "success");
			}
		},
	});
	pi.registerCommand("handoff", {
		description: "Ask the agent to write a handoff document, then optionally start a fresh session",
		handler: async (_args, ctx) => {
			const todoPath = getActiveTodosPath(ctx);
			const prompt = [
				"Write a handoff document now, then call self_compact.",
				"",
				"Requirements:",
				"- Distilled, not a transcript dump.",
				"- Include: Goal, Current State, Progress (done/in-progress/not-started with file paths),",
				"  Key Decisions (with rationale), Important Context (file paths, errors, gotchas),",
				"  Open Todos (address every unchecked item from the todo file),",
				"  Next Steps (specific, actionable), Files Modified, Files Read.",
				"- Assume the next session will only have the handoff file and the todo file.",
				"- Do not summarize the conversation. Write only durable state.",
				`- Todo file: ${todoPath}`,
				"",
				"After self_compact completes, tell the user they can run /fresh latest for a clean session.",
			].join("\n");
			await ctx.sendMessage(prompt);
		},
	});

	// Register --todo-id flag for explicit named todo lists
	pi.registerFlag("todo-id", {
		description: "Use a named todo list (.pi/todos/<name>.md) instead of session-scoped",
		type: "string",
		default: "",
	});

	/** Get the session ID from context, if available */
	function getSessionId(ctx: { sessionManager: { getSessionId(): string } }): string | undefined {
		try {
			return ctx.sessionManager.getSessionId();
		} catch {
			return undefined;
		}
	}

	/** Get the effective todo file path for the current session */
	function getActiveTodosPath(ctx: { cwd: string; sessionManager: { getSessionId(): string } }): string {
		const todoId = pi.getFlag("--todo-id") as string | undefined;
		const sessionId = getSessionId(ctx);
		return activeTodosPath(ctx.cwd, sessionId, todoId || undefined);
	}

	/** Read all todo data: shared board + scoped (branch/session) */
	function readAllTodos(ctx: { cwd: string; sessionManager: { getSessionId(): string } }) {
		const sessionId = getSessionId(ctx);
		const sharedPath = sharedTodosPath(ctx.cwd);
		const sessionPath = sessionTodosPath(ctx.cwd, sessionId);
		const sessionExists = sessionPath ? fs.existsSync(sessionPath) : false;
		const activeFile = getActiveTodosPath(ctx);
		const isUsingShared = activeFile === sharedPath;

		const sharedContent = readFile(sharedPath);
		const scopedContent = isUsingShared ? null : readFile(activeFile);

		// Combine open/done from active file (scoped or shared)
		const activeContent = scopedContent ?? sharedContent;
		const open = activeContent ? parseOpenTodos(activeContent) : [];
		const done = activeContent ? parseDoneTodos(activeContent) : [];

		// Shared board stats (for summary injection)
		const sharedOpen = sharedContent ? parseOpenTodos(sharedContent) : [];

		// Detect current branch for context
		const branch = getCurrentBranch(ctx.cwd);
		const branchPath = branch ? branchTodosPath(ctx.cwd, branch) : null;

		return {
			sharedPath, sharedContent, activeFile, scopedContent,
			isUsingShared, open, done, sharedOpen, branch, branchPath,
			sessionPath, sessionExists,
		};
	}

	// Update TUI status + widget after each assistant message
	pi.on("message_end", async (event, ctx) => {
		if (!ctx.hasUI) return;
		if (event.message.role !== "assistant") return;

		const usage = ctx.getContextUsage();
		const { open, done } = readAllTodos(ctx);

		// Footer status
		const statusParts: string[] = [];
		if (usage?.percent !== null && usage?.percent !== undefined) {
			statusParts.push(`ctx:${usage.percent.toFixed(0)}%`);
		}
		if (open.length > 0 || done.length > 0) {
			statusParts.push(`todo:${done.length}✓/${open.length + done.length}`);
		}
		if (statusParts.length > 0) {
			ctx.ui.setStatus("context-awareness", statusParts.join(" │ "));
		}

		// Widget: show open todos above editor
		if (open.length > 0) {
			const lines = [`── todos (${open.length} open) ──`, ...open.map((t) => `  ☐ ${t}`)];
			if (lines.length > 6) {
				lines.splice(5, lines.length - 5, `  ... +${open.length - 4} more`);
			}
			ctx.ui.setWidget("todos", lines, { placement: "aboveEditor" });
		} else {
			ctx.ui.setWidget("todos", undefined);
		}
	});

	// Also update on session start
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		const { open, done } = readAllTodos(ctx);
		if (open.length > 0 || done.length > 0) {
			ctx.ui.setStatus("context-awareness", `todo:${done.length}✓/${open.length + done.length}`);
			if (open.length > 0) {
				const lines = [`── todos (${open.length} open) ──`, ...open.map((t) => `  ☐ ${t}`)];
				if (lines.length > 6) lines.splice(5, lines.length - 5, `  ... +${open.length - 4} more`);
				ctx.ui.setWidget("todos", lines, { placement: "aboveEditor" });
			}
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const usage = ctx.getContextUsage();
		const parts: string[] = [];

		// Context status
		if (usage) {
			parts.push(contextStatus(usage.tokens, usage.contextWindow, usage.percent));
		}

		// Todo injection — scoped todos + shared board summary
		const {
			sharedPath, sharedContent, activeFile, scopedContent,
			isUsingShared, open, sharedOpen, branch, branchPath,
			sessionPath, sessionExists,
		} = readAllTodos(ctx);

		if (isUsingShared) {
			// No scoped todos yet — inject shared board directly so the agent still sees pending work.
			if (sharedContent && sharedContent.trim()) {
				parts.push(`\n**Project board** (${open.length} open) — file: ${sharedPath}`);
				parts.push(sharedContent.trim());
			}
			if (sessionPath && !sessionExists) {
				parts.push(`\n_Tip: create \`${sessionPath}\` if this task needs session-scoped detail. Keep \`${sharedPath}\` to one-liners._`);
			}
			if (branchPath && branch && branch !== "main" && branch !== "master" && branch !== "dev") {
				parts.push(`\n_Tip: create \`${branchPath}\` for branch-scoped todos instead of adding to the shared board._`);
			}
		} else {
			// Scoped todos exist — inject them as primary, shared board as summary-only
			if (sharedOpen.length > 0) {
				parts.push(`\n**Project board** (${sharedOpen.length} open) — \`read ${sharedPath}\` for cross-stream context`);
			}

			// Inject the scoped todos in full
			const activeContent = scopedContent;
			if (activeContent && activeContent.trim()) {
				const label = branchPath && activeFile === branchPath ? `Branch todos (${branch})` : "Session todos";
				parts.push(`\n**${label}** (${open.length} open) — file: ${activeFile}`);
				parts.push(activeContent.trim());
			}
		}

		if (parts.length === 0) return;

		const todoFile = activeFile;
		const injection = [
			"<context_and_todos>",
			...parts,
			"",
			"RULES:",
			`- Maintain ${todoFile} as you work: add items when planning, check them off when done.`,
			"- The todo file is your anchor — it survives compaction and keeps you oriented.",
			"- self_compact may aggressively discard most live conversation state after saving a handoff.",
			"- Before calling self_compact, write a distilled handoff that is sufficient to resume without chat history.",
			"- Do not dump the raw transcript; capture goals, decisions, current state, blockers, exact file paths, and next actions.",
			"- When you self_compact, ALL open todos must be addressed in your handoff document.",
			"- After compaction, read the handoff file + check todos to know exactly where you are.",
			"- Update todos with the edit or write tool. Format: `- [ ] task` / `- [x] done`.",
			...(isUsingShared
				? [
					`- Keep shared board items SHORT (one-liner per workstream). Narrative belongs in session/branch todos or handoffs.`,
					...(sessionPath && !sessionExists
						? [`- If this task needs private detail, create \`${sessionPath}\` before writing long-form todos.`]
						: []),
					...(branchPath && branch && branch !== "main" && branch !== "master" && branch !== "dev"
						? [`- For branch-specific work, create \`${branchPath}\` to avoid bloating the shared board.`]
						: []),
				]
				: [
					`- For cross-session coordination, write to the shared board: ${sharedPath}`,
					`- Keep shared board items SHORT (one-liner per workstream). Details stay in your scoped todo file.`,
				]),
			"</context_and_todos>",
		].join("\n");

		return {
			systemPrompt: event.systemPrompt + "\n\n" + injection,
		};
	});

	pi.registerTool({
		name: "self_compact",
		label: "Self-Compact",
		description: [
			"Write a handoff document and compact context. Use whenever you need to free up space",
			"or before context quality degrades. No minimum threshold — you decide when.",
			"",
			"Assume the live conversation may be aggressively discarded after this runs.",
			"Write a distilled handoff that is sufficient to resume without chat history.",
			"Do not dump the transcript; preserve goals, decisions, state, blockers, file paths, and next actions.",
			"",
			"The handoff is saved to .pi/handoffs/<timestamp>.md and persists on disk.",
			"By default the agent automatically continues after compaction — a follow-up user message is",
			"queued that tells the next turn to read the handoff + todos and resume from 'Next Steps'.",
			"Set autoContinue=false if you want to hand control back to the human instead.",
			"",
			"ALL open items in .pi/todos.md must be addressed in the handoff.",
			"The todo file itself survives compaction — it's your persistent task anchor.",
		].join(" "),
		parameters: Type.Object({
			handoff: Type.String({
				description: [
					"Full markdown handoff document. MUST include:",
					"Goal, Current State, Progress (done/in-progress/not-started with specific file paths),",
					"Key Decisions (with rationale), Important Context (file paths, errors, gotchas),",
					"Open Todos (address every unchecked item from .pi/todos.md),",
					"Next Steps (specific, actionable), Files Modified, Files Read.",
					"Assume the current conversation may become unavailable after this tool.",
					"This is your lifeline after compaction — be exhaustive but distilled.",
				].join(" "),
			}),
			reason: Type.String({
				description: "Brief explanation of why compaction is needed now.",
			}),
			autoContinue: Type.Optional(
				Type.Boolean({
					description:
						"When true (default), a follow-up user message is queued after compaction so the next turn fires automatically — no human input needed. Set false to compact and then wait for the human.",
				}),
			),
			resumeHint: Type.Optional(
				Type.String({
					description:
						"Optional short sentence appended to the auto-continue message telling the next turn what specifically to do first (e.g. 'Fix the 3 bugs Claude found on PR #2'). Ignored if autoContinue=false.",
				}),
			),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { activeFile, open: openItems } = readAllTodos(ctx);
			const warnings: string[] = [];
			const compactCtx = ctx as {
				compact?: (options: {
					customInstructions?: string;
					onComplete?: (_result: unknown) => void;
					onError?: (error: Error) => void;
				}) => void;
			};

			if (openItems.length > 0) {
				const handoffLower = params.handoff.toLowerCase();
				const missed = openItems.filter((t) => {
					const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
					return !words.some((w) => handoffLower.includes(w));
				});
				if (missed.length > 0) {
					warnings.push(
						`⚠️ These open todos may not be addressed in your handoff:`,
						...missed.map((t) => `  - [ ] ${t}`),
						`Consider updating the handoff to cover them.`,
						"",
					);
				}
			}

			let handoffPath: string;
			try {
				handoffPath = writeHandoff(ctx.cwd, params.handoff);
			} catch (err) {
				return {
					content: [{
						type: "text",
						text: `Failed to write handoff: ${err instanceof Error ? err.message : String(err)}`,
					}],
					isError: true,
				};
			}

			const autoContinue = params.autoContinue !== false; // default true

			const customInstructions = [
				"SELF_COMPACT MODE.",
				"Treat the saved handoff as the canonical state.",
				`Handoff file: ${handoffPath}`,
				`Todo file: ${activeFile}`,
				`Reason: ${params.reason}`,
				"Replace older conversation history with a minimal restore note only.",
				"Do not preserve a narrative summary of the full chat.",
				"Tell the next agent to read the handoff first, then the todo file.",
				"Keep the summary short and action-oriented.",
				...(autoContinue
					? [
							"A follow-up user message is queued that will auto-trigger the next turn — the next agent should read the handoff + todos, then continue working without waiting for the human.",
						]
					: []),
			].join("\n");

			// Notify before compaction so the user sees it (compaction swallows tool results)
			const uiCtx = ctx as { ui?: { notify?: (msg: string, level?: string) => void } };
			uiCtx.ui?.notify?.(`📄 Handoff saved: ${handoffPath}`, "success");
			if (warnings.length > 0) {
				uiCtx.ui?.notify?.(warnings.join("\n"), "warning");
			}

			// Check compact availability BEFORE calling. If ctx.compact isn't exposed
			// (old pi build, RPC mode, etc) we must NOT claim the live conversation
			// was discarded — the auto-continue message would be actively misleading.
			const compacted = typeof compactCtx.compact === "function";
			if (compacted) {
				// Build resume message before compact() so closures capture it.
				// Auto-continue is sent from onComplete — after compaction finishes and
				// the agent is idle. Sending during tool execution (the old approach)
				// races with compact()'s abort(): the follow-up gets queued into
				// followUpQueue, but the abort kills the agent loop before it can
				// drain that queue, so the message just sits there forever.
				const resumeHint = autoContinue && typeof params.resumeHint === "string" ? params.resumeHint.trim() : "";
				const resumeMessage = autoContinue
					? [
							"Auto-continue after self_compact. The live conversation was discarded — the handoff file is your canonical state.",
							"",
							"Do these in order before anything else:",
							`1. read ${handoffPath}`,
							`2. read ${activeFile}`,
							"",
							"Then continue from the handoff's **Next Steps** section, addressing open todos.",
							"Do NOT wait for further human input. Just continue working — the user expects you to pick up where you left off.",
							...(resumeHint ? ["", `Immediate focus: ${resumeHint}`] : []),
						].join("\n")
					: undefined;

				compactCtx.compact?.({
					customInstructions,
					onComplete: () => {
						if (!autoContinue || !resumeMessage) return;
						try {
							const sendUser = (pi as { sendUserMessage?: (content: string) => void })
								.sendUserMessage;
							if (typeof sendUser === "function") {
								// No deliverAs — agent is idle post-compaction, so this
								// starts a fresh turn directly via prompt().
								sendUser(resumeMessage);
							} else {
								uiCtx.ui?.notify?.(
									"autoContinue requested but pi.sendUserMessage is not available in this pi build — falling back to manual resume.",
									"warning",
								);
							}
						} catch (err) {
							uiCtx.ui?.notify?.(
								`autoContinue failed to send follow-up: ${err instanceof Error ? err.message : String(err)}`,
								"warning",
							);
						}
					},
				});
			} else {
				uiCtx.ui?.notify?.(
					"self_compact: ctx.compact is not available on this pi build — handoff was saved but no compaction occurred. Auto-continue is skipped to avoid a misleading 'context discarded' message.",
					"warning",
				);
			}

			const lines = [
				`📄 Handoff saved to: ${handoffPath}`,
				`📋 Todos: ${activeFile}`,
				compacted
					? "🧹 Triggered compaction with self-compact restore instructions."
					: "⚠️  Compaction unavailable on this pi build — handoff saved but context is NOT reduced.",
				compacted && autoContinue
					? "▶️  Auto-continue queued — the next turn will fire automatically after compaction."
					: !compacted
						? "⏸  Auto-continue skipped because compaction did not run."
						: "⏸  autoContinue=false — compaction will return control to the human.",
				"",
				"**After compaction, restore context:**",
				`1. \`read ${handoffPath}\``,
				`2. \`read ${activeFile}\``,
				"",
				"**For a truly clean session instead of compaction:**",
				`- Run \`/fresh ${path.basename(handoffPath)}\``,
			];
			if (warnings.length > 0) {
				lines.push("", ...warnings);
			}
			return { content: [{ type: "text", text: lines.join("\n") }] };
		},
	});
}
