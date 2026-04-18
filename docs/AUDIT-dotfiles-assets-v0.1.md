# Audit Report: The Guy v0.1 Asset Set
## Audit of the source dotfiles asset set

**Date:** 2026-04-13  
**Scope:** Identify smallest safe first asset set for the power-user profile  
**Criteria:** No encrypted files, no tightly owner-specific coupling, no private auth/API keys  
**Output Format:** KEEP / DEFER / REJECT with rationale and exact paths

---

## KEEP: Core Agent Infrastructure

These form the foundation and are generic, encapsulated, and required.

### Agent Definitions
| Path | Rationale |
|------|-----------|
| `home/.pi/agent/agents/scout.md` | Generic subagent template, self-contained, no secrets |
| `home/.pi/agent/agents/planner.md` | Generic subagent template, no secrets |
| `home/.pi/agent/agents/reviewer.md` | Generic subagent template, no secrets |
| `home/.pi/agent/agents/worker.md` | Generic subagent template, no secrets |

### Prompts (Workflow Templates)
| Path | Rationale |
|------|-----------|
| `home/.pi/agent/prompts/feature.md` | Generic feature implementation workflow, reusable pattern |
| `home/.pi/agent/prompts/scout-and-plan.md` | Generic agent delegation pattern, no coupling |
| `home/.pi/agent/prompts/implement.md` | Generic implementation prompt, reusable |
| `home/.pi/agent/prompts/implement-and-review.md` | Generic review pattern, reusable |
| `home/.pi/agent/prompts/worktree.md` | Generic git worktree workflow, project-agnostic |

### Core Extensions (Generic)
| Path | Rationale |
|------|-----------|
| `home/.pi/agent/extensions/context-awareness.ts` | Generic context window tracking, todo persistence, self-compact tool — universal need |
| `home/.pi/agent/extensions/subagent/index.ts` | Generic delegation/orchestration runtime, no secrets, fundamental capability |
| `home/.pi/agent/extensions/subagent/agents.ts` | Subagent resolution and loading logic, generic |
| `home/.pi/agent/extensions/session-browser/index.ts` | Generic session browsing UX, orthogonal to auth |

### Core Philosophy & Configuration
| Path | Rationale |
|------|-----------|
| `home/.pi/agent/AGENTS.md` | **PARTIAL KEEP**: Contains generic workflow philosophy + conventions. **MUST EDIT**: Remove Minzi-specific identity section (lines 1-43: "Full-stack engineer...Sycophancy is a bug"). Keep workflow rules, context awareness, todo tracking, git commit attribution sections. This is product philosophy, not Minzi biography. |
| `home/.pi/agent/settings.json` | **KEEP with modification**: Default model selection, thinking level, skill paths are reusable. Edit: change defaultProvider/Model to neutral choice (gpt-5.4 is fine), ensure skill paths point to standard locations |

---

## KEEP: Generic Skills (Power-User Safe)

These skills are generic, require no external auth, and align with power-user workflow.

| Skill | Path | Rationale |
|-------|------|-----------|
| clean-code | `home/.pi/agent/skills/clean-code/` | Self-contained best practices, no external API, no coupling |
| code-reviewer | `home/.pi/agent/skills/code-reviewer/` | Generic code quality patterns, no secrets required |
| debug | `home/.pi/agent/skills/debug/` | Self-contained debugging methodology, well-organized references |
| dev-rfc | `home/.pi/agent/skills/dev-rfc/` | Generic RFC template + review patterns, lightweight |
| docs-style | `home/.pi/agent/skills/docs-style/` | Generic documentation writing principles |
| exec-plan | `home/.pi/agent/skills/exec-plan/` | Generic execution planning patterns |
| find-skills | `home/.pi/agent/skills/find-skills/` | Meta skill for skill discovery, self-referential but useful |
| git-workflow | `home/.pi/agent/skills/git-workflow/` | Generic git/PR workflows, universal patterns |
| humanizer | `home/.pi/agent/skills/humanizer/` | Generic text improvement skill, Wikipedia-based patterns |
| project-docs | `home/.pi/agent/skills/project-docs/` | Generic documentation generation from codebase |
| refactor | `home/.pi/agent/skills/refactor/` | Self-contained refactoring patterns from Fowler, no coupling |
| shell | `home/.pi/agent/skills/shell/` | Generic shell scripting best practices, portable |
| team-debate | `home/.pi/agent/skills/team-debate/` | Generic multi-model debate orchestration pattern |
| think | `home/.pi/agent/skills/think/` | Generic strategic thinking methodology |
| visual-explainer | `home/.pi/agent/skills/visual-explainer/` | Generic visualization generation skill, self-contained |
| worktree | `home/.pi/agent/skills/worktree/` | Generic git worktree workflow skill |
| agent-browser | `home/.pi/agent/skills/agent-browser/` | Browser automation skill, self-contained, reusable |

---

## DEFER: Valuable but Not v0.1 MVP

### Higher-Touch Skills (Require Setup/External Integration)
| Skill | Path | Rationale |
|-------|------|-----------|
| linear | `home/.pi/agent/skills/linear/` | **Defer to v0.2**: Requires a specific Linear workspace API key, team-specific taxonomy, and secret injection. Not portable. Ship without Linear; users without it won't notice; users with it can self-install later. |

### Extensions Requiring Optional/External Dependencies
| Path | Rationale |
|------|-----------|
| `home/.pi/agent/extensions/exa-search/` | **Defer to v0.2+**: Requires Exa API key. Nice to have for semantic search but not critical path. Power user can install manually if needed. |
| `home/.pi/agent/extensions/btw/` | **Defer**: Unknown purpose, likely internal tooling for Minzi. Exclude unless documented. |
| `home/.pi/agent/extensions/dcg.ts` | **Defer**: Likely internal tool, unclear public value. |
| `home/.pi/agent/extensions/ext/index.ts` | **Defer**: Unclear purpose, likely Minzi-specific extension harness. |
| `home/.pi/agent/extensions/_shared/feature-flags.ts` | **Defer**: Infrastructure for feature gating; include only if other deferred extensions are included. |
| `home/.pi/agent/extensions/custom-compaction.ts` | **Defer**: May contain Minzi-specific compaction behavior. Review before shipping. |

### Claude Code Artifacts (Tool-Specific)
| Path | Rationale |
|------|-----------|
| `home/.claude/commands/` | **Keep (generic workflow)**: feature.md and worktree.md are generic. BUT these are Claude Code–specific syntax. For v0.1 π-focused build, keep for users who have Claude Code, but not required. |
| `home/.claude/rules/` | **Keep (generic workflow)**: Same as above — feature-workflow.md and worktree-workflow.md contain reusable patterns. Include with note that they're for Claude Code users. |

---

## REJECT: Secrets, Encrypted, or Minzi-Specific

### Encrypted Files (git-crypt protected)
| Path | Rationale |
|------|-----------|
| `home/.claude/settings.json` | **REJECT**: Encrypted (git-crypt). Contains API keys, provider tokens, permissions. Cannot ship without decryption ceremony. |
| `home/.claude/.env` | **REJECT**: Encrypted. Contains Linear API key. |
| `home/.config/opencode/opencode.json` | **REJECT**: Encrypted. Contains GCP API key for Google provider. |

### Secret/Account Files (gitignore'd but present)
| Path | Rationale |
|------|-----------|
| `home/.config/opencode/antigravity-accounts.json` | **REJECT**: Contains Google Cloud refresh tokens. In .gitignore for good reason. User-specific account enrollment. |
| `home/.claude/settings.local.json` | **REJECT**: Local permission overrides, likely device-specific. |
| `home/.config/opencode/tui.json` | **REJECT**: TUI state, user-specific. |

### Personal Identity & Configuration
| Path | Rationale |
|------|-----------|
| `home/.claude/CLAUDE.md` (full file) | **REJECT the personal biography section** (lines 1-43): "Full-stack engineer. Python-heavy...Sycophancy is a bug." This is the source author’s identity, not product philosophy. The Guy ships without a pre-authored identity; users shape their own via enrollment. **KEEP only the workflow conventions if extracted separately.** |

### Owner-Specific Helper Tools
| Path | Rationale |
|------|-----------|
| `home/.local/bin/tg` | **REJECT**: Telegram bot notifications. Too personal; user can add if needed. |
| `home/.config/opencode/skills/notify-human/` | **REJECT**: Telegram-specific notification skill. Remove with `tg`. |
| `home/.claude/skills/notify-human/` | **REJECT**: Same; Telegram-coupled. |
| `home/.config/opencode/package.json` | **DEFER/REJECT**: OpenCode plugin manifest. Not in v0.1 scope (RFC-002 defers OpenCode). |
| `home/.config/opencode/oh-my-opencode.json` | **DEFER**: OpenCode agent config. Included only if OpenCode is v0.1 scope; RFC-002 does not include it. |

### OpenCode (Deferred from v0.1)
| Path | Rationale |
|------|-----------|
| `home/.opencode.json` | **REJECT/DEFER**: Root OpenCode config. OpenCode not in v0.1 scope (RFC-002, "Not-Goals: Broad OpenCode setup"). |
| `home/.config/opencode/` (entire dir) | **REJECT**: OpenCode tool config. Deferred to v0.2+. Power-user can self-enroll if they have Codex. |

---

## DEFER: Helper CLIs (Valuable but Not Critical Path)

**Decision: PARTIAL KEEP for v0.1, with caveats.**

The three `agent-*` CLIs (`agent-projects`, `agent-branches`, `agent-autonomy`) are valuable power-user tools but **not required for The Guy v0.1 runtime**. They are external CLI tools that ship separately, not as part of the profile asset bundle.

| Path | Status | Rationale |
|------|--------|-----------|
| `home/.local/bin/agent-projects` | **SHIP as optional addon** | Useful for discovering active projects; no Minzi coupling beyond directory layout. Can be a v0.1 stretch goal or v0.1.1 quick-add. User can install via `npm install -g`. |
| `home/.local/bin/agent-branches` | **SHIP as optional addon** | Session history + worktree inspection; excellent power-user tool. No secrets. Include if bandwidth allows. |
| `home/.local/bin/agent-autonomy` | **DEFER to v0.1.1** | Autonomy metrics and dashboard require live session data; less critical for first dogfood. Include later. |
| `home/.local/bin/opencode` | **REJECT** | OpenCode wrapper; not in v0.1 scope. |

**Recommendation for v0.1:**
- Ship `agent-projects` and `agent-branches` as optional helper CLIs (not required, but included as value-add)
- Skip `agent-autonomy` for now
- Skip `opencode` and `tg`

---

## Minimum v0.1 Asset Set Summary

### SHIP (Required Minimum)

**Core Agent Runtime:**
- `home/.pi/agent/agents/{scout,planner,reviewer,worker}.md`
- `home/.pi/agent/prompts/{feature,scout-and-plan,implement,implement-and-review,worktree}.md`
- `home/.pi/agent/extensions/context-awareness.ts`
- `home/.pi/agent/extensions/subagent/{index,agents}.ts`
- `home/.pi/agent/extensions/session-browser/index.ts`
- `home/.pi/agent/AGENTS.md` **(EDITED: remove Minzi biography, keep philosophy/rules)**
- `home/.pi/agent/settings.json` **(EDITED: use neutral defaults)**

**Generic Skills (16 skills):**
- clean-code, code-reviewer, debug, dev-rfc, docs-style, exec-plan, find-skills, git-workflow, humanizer, project-docs, refactor, shell, team-debate, think, visual-explainer, worktree, agent-browser

**Total: ~40 files, well-under 5MB.**

### OPTIONAL v0.1 Additions (Value-Add)

- `home/.local/bin/{agent-projects,agent-branches}` (helper CLIs)
- `home/.claude/commands/{feature,worktree}.md` (for Claude Code users)
- `home/.claude/rules/{feature-workflow,worktree-workflow}.md` (for Claude Code users)

### DEFER to v0.2+

- Linear skill + Varlock integration (requires Minzi's Linear workspace)
- Exa-search extension (requires API key)
- agent-autonomy CLI (requires session harvesting)
- agent-browser-btw, dcg, ext, custom-compaction extensions (unclear/personal)
- OpenCode configuration entirely

### REJECT (Never Ship)

- All encrypted files (`.claude/settings.json`, `.env`, `opencode.json`)
- Telegram integration (`tg` binary, `notify-human` skills)
- Minzi's personal identity section from CLAUDE.md
- Secret account files (`antigravity-accounts.json`, `settings.local.json`)
- OpenCode bootstrap scripts

---

## Implementation Path

### Phase 1: Asset Curation (This Session)
1. Extract KEEP assets to `profiles/power-user/assets/` in the-guy repo
2. Create `profiles/power-user/assets.json` with explicit manifest entries
3. Edit `home/.pi/agent/AGENTS.md`: remove identity section, keep philosophy
4. Edit `home/.pi/agent/settings.json`: use neutral model/provider defaults
5. Verify no encrypted or secret files end up in bundle

### Phase 2: Runtime Integration
1. Implement profile rendering in guy-core
2. Asset copying logic in guy-installer
3. Verify smoke test: install to temp home, confirm context-awareness extension loads

### Phase 3: Dogfood & Validation
1. Bundle and test locally
2. Verify Claude Code, Codex, and Pi enrollment work without encrypted files
3. Collect power-user feedback

---

## Risk Checklist

- ✅ No encrypted files shipped
- ✅ No API keys or refresh tokens in bundle
- ✅ No Minzi-personal identity/biography included
- ✅ No external service dependencies (Linear, Telegram, Exa) required for core use
- ✅ All 17 shipped skills are self-contained and reusable
- ✅ Agent system is generic and testable
- ✅ No `setup.sh`, `git-crypt`, `age`, or source-repo coupling
- ✅ Profile is copyable and offline-installable
- ⚠️ Custom extensions (btw, dcg, ext, custom-compaction) need review before confidently excluding
- ⚠️ Claude Code commands/rules are optional; include with caveat for Claude-only users

---

## Next Steps

1. **Validate risk checklist above** with Minzi
2. **Review custom extensions** (btw, dcg, ext, custom-compaction) to confirm they're Minzi-specific
3. **Extract KEEP assets** to `profiles/power-user/assets/` with correct paths
4. **Generate `assets.json` manifest** for power-user profile
5. **Create sanity test**: verify asset bundle is ≤5MB and decrypts cleanly
6. **Begin Phase 2 implementation** (runtime integration in guy-core)
