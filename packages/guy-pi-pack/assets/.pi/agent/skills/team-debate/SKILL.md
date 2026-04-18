---
name: team-debate
description: >
  Spawn a multi-model debate using pi-team to resolve architecture, design,
  or strategy questions. Two or more models argue adversarially, then you
  synthesize. Use when facing tradeoff decisions, RFC review, security review,
  or any choice that benefits from structured disagreement. Triggers: "debate
  this", "get a second opinion", "should we use X or Y", architecture
  decisions, design tradeoffs, strategy choices, RFC review.
---

# Team Debate

Spawn a multi-model debate via `pi-team` when you face a decision that
benefits from adversarial reasoning.

## When to use

- Architecture choices (monolith vs microservice, SQL vs NoSQL, framework X vs Y)
- Design tradeoffs where reasonable people disagree
- RFC or plan review — have models argue both sides before you decide
- "Should we use X or Y" questions with real tradeoffs
- Security review where you want adversarial thinking
- Any decision where you're uncertain and want structured disagreement

## When NOT to use

- Simple implementation tasks — just do them
- Questions with obvious answers
- Debugging (use the debug skill)
- Time-critical low-stakes decisions

## Prerequisites

`pi-team` must be on PATH. Install the published `pi-team` package or
use `npm link` from a local source checkout.

Verify: `pi-team plans` should list available subscription plans.

## Model defaults (updated 2026-04-05)

Use these exact model strings. Do NOT guess model names — they change
frequently. If a model fails to start, run `pi --list-models` to verify
availability, then fall back to the next preset.

### Presets

**Tier 1 — Frontier (best reasoning, use for important decisions):**
```
claude:anthropic/claude-opus-4-6:high
codex:openai-codex/gpt-5.4:xhigh
```

**Tier 2 — Strong + fast (good balance, use for most debates):**
```
claude:anthropic/claude-sonnet-4-6:high
codex:openai-codex/gpt-5.4:high
```

**Tier 3 — Three-way (add Gemini when Google provider is configured):**
```
claude:anthropic/claude-opus-4-6:high
codex:openai-codex/gpt-5.4:xhigh
gem:google/gemini-2.5-pro:high
```

**Tier 4 — Fast + cheap (for low-stakes or exploratory debates):**
```
claude:anthropic/claude-sonnet-4-5:medium
codex:openai-codex/gpt-5.4-mini:high
```

### With subscription plans

Append `@plan-id` to avoid burning API credits on subscription:
```
claude:anthropic/claude-opus-4-6:high@anthropic-max-20x
codex:openai-codex/gpt-5.4:xhigh@openai-plus
```

Plans: `openai-plus`, `openai-pro`, `openai-business`, `anthropic-pro`,
`anthropic-max-5x`, `anthropic-max-20x`, `api`. Run `pi-team plans` to list.

### Checking available models

If a model string doesn't work, verify what's configured:
```bash
pi --list-models 2>&1 | head -40
```

Only providers with configured API keys or OAuth tokens appear. Common
missing case: Google/Gemini requires `GOOGLE_API_KEY` or `GEMINI_API_KEY`
in the environment.

## How to run a debate

### Quick start (copy-paste this)

```bash
# Recommended: briefing + no-tools
# Agents research codebase first, then debate tool-free
pi-team run \
  --name "<descriptive-slug>" \
  --agent claude:anthropic/claude-opus-4-6:high@anthropic-max-20x \
  --agent codex:openai-codex/gpt-5.4:xhigh@openai-plus \
  --no-tools --briefing \
  --topic "<your question — be specific, include context and constraints>" \
  --max-turns 8
```

### Tool control

| Mode | Flags | Use when |
|------|-------|----------|
| **Briefing + no-tools** | `--no-tools --briefing` | Large codebases. Agents research first, debate fast. |
| **Read-only** | `--tools read,grep,find,ls` | Agents can look things up during debate. |
| **No tools** | `--no-tools` | All context in the topic. Pure reasoning. |
| **Full tools** | _(default)_ | Small repos. Can be slow on large codebases. |

### Three-way debate (when Google provider is available)

```bash
pi-team run \
  --name "<slug>" \
  --agent claude:anthropic/claude-opus-4-6:high@anthropic-max-20x \
  --agent codex:openai-codex/gpt-5.4:xhigh@openai-plus \
  --agent gem:google/gemini-2.5-pro:high \
  --topic "<question>" \
  --max-turns 10
```

## Writing good topics

**Bad:** "How should we do auth?"

**Good:** "Debate: should the WhatsApp bridge use per-tenant API keys stored
in Postgres vs short-lived JWTs minted by the main API server? Context: Fly
deployment, ~50 tenants, messages are latency-sensitive (<2s). Consider:
security, operational complexity, token refresh overhead, and failure modes
when the main API is down."

Always include:
- The specific decision (X vs Y, not "what should we do")
- Relevant context (stack, scale, constraints)
- What dimensions to evaluate on
- Any hard constraints or non-negotiables

## Reading results

The transcript is at `~/.pi/team/sessions/<name>/transcript.jsonl`.

```bash
# Quick view — last messages usually contain convergence
cat ~/.pi/team/sessions/<name>/transcript.jsonl | \
  jq -r 'select(.role == "assistant") | "[" + .from + "] " + .content' | tail -2000
```

## After the debate

1. **Read** the full transcript
2. **Identify agreement** — where models converged (high-confidence signal)
3. **Identify disagreement** — the real decision points you need to resolve
4. **Decide** — the debate informs, you decide
5. **Document** — reference the debate reasoning in your commit/comment/RFC
6. **Clean up** — `rm -rf ~/.pi/team/sessions/<name>/`

## Cost awareness

Each debate turn = one model call per agent. An 8-turn debate with 2 agents
= 8 calls total. On subscription plans this is negligible. On API billing,
an Opus + GPT-5.4 8-turn debate ≈ $2–8 depending on context length.

Keep `--max-turns` proportional to complexity:
- Simple A-vs-B tradeoff: 4–6 turns
- Complex architecture decision: 8–12 turns
- Deep RFC review: 10–14 turns

## Advanced: inject human steering mid-debate

While a debate is running via `pi-team start` (tmux mode), you can inject:

```bash
# From another terminal
pi-team inject --name <session-name>

# Or via HTTP if --http-port was set
curl -X POST http://localhost:7682/inject -d "focus on the failure modes, not the happy path"
```

Injections land at the next turn boundary and all agents see them.
