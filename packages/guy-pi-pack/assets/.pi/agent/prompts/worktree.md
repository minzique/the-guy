# Worktree Management Command

Manage git worktrees for isolated feature development.

## Usage

```
/worktree <action> [branch-name]
```

## Actions

### `/worktree new <branch-name>`
Create a new worktree for feature development.

### `/worktree list`
List all active worktrees.

### `/worktree clean [branch-name]`
Clean up a specific worktree or all merged worktrees.

### `/worktree switch <branch-name>`
Switch context to an existing worktree.

## Workflow

When this command is invoked, follow these steps:

### For `new`:
1. Validate branch name follows convention: `feat/`, `fix/`, `chore/`, `docs/`
2. Ensure main branch is up to date: `git fetch origin && git pull origin main`
3. Create worktree using project's script if available, otherwise:
   ```bash
   # Determine worktree path (sibling to current repo)
   REPO_NAME=$(basename $(git rev-parse --show-toplevel))
   WORKTREE_PATH="../${REPO_NAME}-${branch-name##*/}"
   
   # Create worktree
   git worktree add -b $branch-name "$WORKTREE_PATH" main
   ```
4. Copy environment files: `.env*`, `.env.local`, etc.
5. Install dependencies: `pnpm install` or `npm install` or `bun install`
6. Report the worktree path and confirm ready to work

### For `list`:
```bash
git worktree list
```

### For `clean`:
1. If branch specified: remove that worktree
2. If no branch: find and remove all merged worktrees
```bash
# Remove specific
git worktree remove <path> --force

# Clean merged
git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2 | while read wt; do
  branch=$(git -C "$wt" branch --show-current)
  if git branch --merged main | grep -q "$branch"; then
    git worktree remove "$wt" --force
    git branch -d "$branch"
  fi
done
```

### For `switch`:
1. Find worktree path for the branch
2. Update working directory context
3. Confirm switch

## Important Notes

- NEVER work directly on main branch for features/fixes
- Always create worktrees for isolated development
- Clean up worktrees after merging PRs
- Keep main branch in sync with origin
