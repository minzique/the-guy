# Feature Implementation Command

End-to-end feature implementation: explore → plan → issue → worktree → implement → PR → merge.

## Usage

```
/feature <description of what to build or fix>
```

## Arguments

The description should explain WHAT needs to change and WHY. Screenshots or issue links help.

## Workflow

When this command is invoked, execute the following phases autonomously. Do NOT ask for confirmation between phases unless you hit ambiguity that would result in 2x+ effort difference.

### Phase 0: Explore (MANDATORY — before any planning)

Fire 3-5 parallel `explore` agents via `task(...)` to understand current state:

```
task(subagent_type="explore", load_skills=[], run_in_background=true,
  description="Find frontend component patterns",
  prompt="Find [area] frontend components — what data they render, what API calls they make")
task(subagent_type="explore", load_skills=[], run_in_background=true,
  description="Find API endpoint schemas",
  prompt="Find [area] API endpoints + schemas — what fields returned")
task(subagent_type="explore", load_skills=[], run_in_background=true,
  description="Find DB model fields",
  prompt="Find DB models for [entities] — ALL fields, what's stored but not exposed")
task(subagent_type="explore", load_skills=[], run_in_background=true,
  description="Find generated TS types",
  prompt="Find generated TS types — what the frontend can access")
```

If external libraries are involved, use:

```
task(subagent_type="librarian", load_skills=[], run_in_background=true,
  description="Find external docs and examples",
  prompt="Find official docs and production examples for [library/feature]")
```

Collect all results before proceeding.

### Phase 1: Data Audit & Plan

Create a **data audit table** showing gaps:

```markdown
| Data Field | Backend | API | UI | Notes |
|---|---|---|---|---|
| Field A | ✅ | ✅ | ✅ | Good |
| Field B | ✅ | ❌ | ❌ | Gap — need to expose |
```

The table IS the plan. Present it to the user with a proposed implementation approach.

### Phase 2: Create GitHub Issue

```bash
gh issue create --title "feat(scope): summary" --body-file - <<'EOF'
## Problem
[What's broken or missing]

## Data Audit
[The table from Phase 1]

## Plan
[Numbered phases with files affected]

## Acceptance Criteria
- [ ] criteria 1
- [ ] criteria 2
EOF
```

### Phase 3: Worktree

```bash
git fetch origin && git checkout main && git pull origin main
make worktree-new branch=feat/<feature-name>
cd <worktree-path>
# Install API deps if needed:
cd apps/api && poetry install
```

ALL subsequent work happens in the worktree.

### Phase 4: Implement — Backend First

Order: **schema → service → `make gen-all` → frontend**

1. Schema changes (`apps/api/app/schemas/`)
2. Service enrichment (`apps/api/app/services/`)
3. `make gen-all` — regenerate OpenAPI + TypeScript types
4. Verify new fields in `packages/types/src/index.ts`

### Phase 5: Implement — Frontend (delegate)

Delegate to `visual-engineering` with the 6-section prompt:

```
1. TASK: [atomic goal]
2. EXPECTED OUTCOME: [concrete deliverables]
3. REQUIRED TOOLS: [tool whitelist]
4. MUST DO: [exhaustive step-by-step with file paths]
5. MUST NOT DO: [explicitly forbidden actions]
6. CONTEXT: [file paths, data available, patterns to follow]
```

Layer-specific skills:

| Layer | Category | load_skills |
|-------|----------|-------------|
| Frontend | visual-engineering | ["tanstack-query", "nextjs", "orval", "vercel-ai-sdk", "tailwind-v4", "shadcn-ui"] |
| Backend | backend-python | ["langfuse-observability", "langfuse-prompt-migration"] |
| Agent/AI | agentic | ["pydantic-ai-agent-creation", "pydantic-ai-dependency-injection"] |

Important:
- `load_skills` is a REQUIRED `task(...)` parameter, not a standalone tool.
- There is no `Agent` tool. Do not write pseudo-calls like `explore(bg): ...`.
- If no skills are needed, pass `load_skills=[]`.

### Phase 6: Verify

```bash
pnpm run build --filter=web    # Frontend type-check + build
make test-api                  # Backend tests if routes/services changed
```

### Phase 7: Commit & PR

- Commit: `feat(scope): summary`
- PR body: Closes #issue, summary bullets, before/after, files table, test checklist
- Push + create PR

### Phase 8: CI & Review

1. `gh pr checks <number>` — check CI status
2. Read Claude review comments
3. Triage failures: compare against main CI to distinguish pre-existing
4. Fix actionable review feedback, push follow-up commit

### Phase 9: Merge & Cleanup

```bash
gh pr merge <number> --squash
make worktree-clean branch=feat/<feature-name>
```

## Important Notes

- Do NOT skip Phase 0 (explore). Assumptions → wrong plans → wasted work.
- Backend-first ordering prevents type errors across the stack.
- Always verify build BEFORE committing — catch issues early.
- Use session_id to continue delegated tasks instead of starting fresh.
- After merge, ALWAYS clean worktree.
