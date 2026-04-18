---
description: Git worktree workflow for isolated feature development. Automatically creates worktrees, manages lifecycle, and enforces branch hygiene.
---

# Worktree Development Workflow Skill

## Purpose
Ensure all feature development happens in isolated git worktrees, keeping the main branch clean and in sync with origin.

## Activation Triggers

This skill activates when the user asks to:
- Implement a feature
- Fix a bug  
- Create a PR
- Work on a GitHub issue
- Make code changes that require commits
- Research something that might lead to implementation

## Pre-Flight Check (ALWAYS DO FIRST)

```bash
# 1. Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# 2. Check if in a worktree
git rev-parse --git-dir | grep -q "worktrees" && echo "In worktree: YES" || echo "In worktree: NO"

# 3. List existing worktrees
git worktree list
```

**If on `main` or `master` and task requires code changes**: STOP and create a worktree.

## Workflow Steps

### Phase 1: Setup (Before Any Code Changes)

#### 1.1 Determine Branch Name
Ask user or infer from task:
- `feat/<description>` - New features
- `fix/<description>` - Bug fixes
- `chore/<description>` - Maintenance
- `docs/<description>` - Documentation

#### 1.2 Sync Main & Create Worktree

**If project has Makefile with worktree targets:**
```bash
# Check for Makefile targets
grep -q "worktree-new" Makefile && echo "Has worktree-new target"

# Use project's script
make worktree-new branch=feat/my-feature
```

**Otherwise, manual creation:**
```bash
# Sync main first
git fetch origin
git checkout main
git pull origin main

# Create worktree
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
BRANCH_NAME="feat/my-feature"
BRANCH_SHORT=$(echo "$BRANCH_NAME" | sed 's|.*/||')
WORKTREE_PATH="../${REPO_NAME}-${BRANCH_SHORT}"

git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main

# Setup worktree
cd "$WORKTREE_PATH"

# Copy env files from main repo
MAIN_REPO="../$REPO_NAME"
for f in .env .env.local .env.development .env.development.local; do
  [ -f "$MAIN_REPO/$f" ] && cp "$MAIN_REPO/$f" . && echo "Copied $f"
done

# Install dependencies
if [ -f "pnpm-lock.yaml" ]; then
  pnpm install
elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  bun install
elif [ -f "package-lock.json" ]; then
  npm install
elif [ -f "yarn.lock" ]; then
  yarn install
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "Pipfile" ]; then
  pipenv install
fi
```

#### 1.3 Confirm Ready
```bash
pwd  # Should be in worktree
git branch --show-current  # Should be feature branch
```

Announce: **"Working in worktree: /path/to/worktree on branch: feat/my-feature"**

### Phase 2: Development

All work happens in the worktree:
- Edit files
- Run tests
- Make commits
- Iterate

### Phase 3: Pre-PR Verification

Before creating PR:
```bash
# Run tests if available
[ -f "Makefile" ] && grep -q "^test:" Makefile && make test
[ -f "package.json" ] && npm test 2>/dev/null || pnpm test 2>/dev/null || true

# Check for build errors
[ -f "Makefile" ] && grep -q "^build:" Makefile && make build
[ -f "package.json" ] && npm run build 2>/dev/null || pnpm build 2>/dev/null || true

# Lint if available
[ -f "package.json" ] && npm run lint 2>/dev/null || pnpm lint 2>/dev/null || true
```

### Phase 4: Create PR

```bash
# Push branch
git push -u origin $(git branch --show-current)

# Create PR
gh pr create --title "feat: description" --body "## Summary
- Change 1
- Change 2

## Testing
- Tested locally
"
```

### Phase 5: Post-Merge Cleanup

After PR is merged:

**If project has cleanup script:**
```bash
# Go back to main repo
cd <main-repo-path>
make worktree-clean branch=feat/my-feature
```

**Manual cleanup:**
```bash
# Go to main repo (not worktree)
cd <main-repo-path>

# Sync main
git fetch origin
git checkout main  
git pull origin main

# Remove worktree
WORKTREE_PATH="../repo-name-feature-name"
git worktree remove "$WORKTREE_PATH" --force

# Delete branch
git branch -d feat/my-feature
```

## Quick Reference

| Action | Command |
|--------|---------|
| List worktrees | `git worktree list` |
| Create worktree | `git worktree add -b <branch> <path> main` |
| Remove worktree | `git worktree remove <path> --force` |
| Prune stale | `git worktree prune` |
| Check branch | `git branch --show-current` |

## Error Recovery

### Accidentally edited main
```bash
git stash
# Create worktree...
cd <worktree>
git stash pop
```

### Worktree path already exists
```bash
rm -rf <path>
git worktree prune
# Try again
```

### Branch already exists
```bash
# Use existing branch in new worktree
git worktree add <path> <existing-branch>
```

## Important Reminders

1. **NEVER commit to main** - Always use feature branches
2. **NEVER push to main** - PRs only
3. **ONE worktree per feature** - Keep work isolated
4. **CLEAN UP after merge** - Don't leave stale worktrees
5. **SYNC before creating** - Always pull latest main first
