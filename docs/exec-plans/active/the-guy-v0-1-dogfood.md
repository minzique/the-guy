# The Guy v0.1 dogfood build

## Purpose / Big Picture

Build the first actually usable version of The Guy for Minzi and other technical early adopters. After this plan lands, you should be able to install The Guy on a macOS machine, apply a curated `power-user` profile, verify Claude/Codex/Pi readiness, and recover config drift without depending on a live `dotfiles-agents` checkout.

This version is intentionally narrow. It is for dogfooding and clean architecture validation, not for Belva-grade nontechnical onboarding yet.

## Progress

- [x] Lock the v0.1 scope and write the lower-level installer/profile RFC
- [x] Turn the repo into a buildable TypeScript workspace
- [x] Finalize the Guy profile schema and Guy-owned state layout
- [ ] Expand the first shipped asset set beyond the initial power-user slice
- [x] Implement the first real `guy-core` install/apply/state slice
- [ ] Implement provider auth handoff/status checks for Claude and Codex
- [x] Finish the first real `guy status`, `guy doctor`, and `guy repair` slice
- [x] Build a local release artifact skeleton and run workspace smoke checks
- [x] Run multi-agent review on the current runtime slice and fix the critical findings

## Surprises & Discoveries

- The subagent extension frontmatter does **not** accept profile aliases like `gpt54-max`; it shells out to `pi --model`, so the working format is provider/model plus optional thinking suffix such as `openai-codex/gpt-5.4:xhigh`.
- Creating a new `dotfiles-agents` worktree currently fails because `git-crypt` smudge trips during checkout. For live harness changes, local agent overrides under `~/.pi/agent/agents/` are working around that.
- `pi --help` shows the exact model syntax we need for future subagent definitions: `--model provider/id:thinking` or `--model pattern:thinking`.
- The first TypeScript workspace skeleton builds cleanly with `tsc -b`, runs node:test smoke coverage, and can emit a local `.artifacts/the-guy-0.1.0.tar.gz` bundle before the real runtime exists.
- The first real install slice now works end-to-end: `guy install` copies two bundled power-user assets into a temp home, writes `~/.guy/state/install.json`, writes rendered asset metadata, and `guy status` reads the real install state.
- `guy doctor` now runs real checks against install state, rendered assets, platform support, and provider CLI presence. `guy repair` now re-applies the installed profile and restores missing managed files.
- The local release bundle is now actually runnable: it includes a `bin/guy` launcher plus a minimal `node_modules/@the-guy/*` runtime tree, and was smoke-tested by unpacking the tarball and running the bundled CLI.
- Parallel `reviewer` + `reviewer-max` passes were run twice; critical issues around bundle runnability, inheritance, install health, optional provider semantics, doctor exit codes, and command assumptions were fixed.

## Decision Log

- v0.1 will be **macOS native only**. Windows via WSL2 stays in RFC-001 but is deferred from this first dogfood build.
- v0.1 will be **CLI only**. No guided installer or GUI shell yet.
- v0.1 will ship **one user-visible profile**: `power-user`. `base` remains internal/inherited. `guided` is deferred.
- v0.1 will support **Claude + Codex auth handoff and status detection**, but it will not invent custom OAuth flows yet. It should orchestrate existing CLI login flows cleanly and detect whether the machine is ready.
- The shipped runtime must be **copy-based**, not symlink-based, so it can run without a `dotfiles-agents` checkout.
- The codebase should be optimized for future agent maintainability: small packages, minimal dependencies, explicit state files, idempotent commands, and local dogfooding.

## Outcomes & Retrospective

(fill when complete)

## Context and Orientation

- Product repo: `/Users/minzi/Developer/the-guy`
- Source authoring repo: `/Users/minzi/Developer/dotfiles-agents`
- Product RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- Bootstrap scaffold plan: `/Users/minzi/Developer/the-guy/docs/exec-plans/active/the-guy-bootstrap-v0.md`
- Shared workspace todo: `/Users/minzi/Developer/.pi/todos.md`
- Session todo: `/Users/minzi/Developer/.pi/todos/79dd4cb4-0faa-4564-8926-897b436c5185.md`
- Live local subagent overrides:
  - `/Users/minzi/.pi/agent/agents/planner.md`
  - `/Users/minzi/.pi/agent/agents/reviewer.md`
  - `/Users/minzi/.pi/agent/agents/reviewer-max.md`

### Current repo shape

The repo is still a scaffold:

- `apps/guy-installer/` is placeholder-only
- `packages/guy-core/`, `packages/guy-doctor/`, `packages/guy-auth-*`, and `packages/guy-profile-schema/` only have README/package stubs
- `profiles/` has minimal JSON examples but no real rendered assets or schema-backed validation
- `docs/rfcs/RFC-001-...` exists and has a PDF export

### Chosen v0.1 product surface

The first shippable build should expose:

- `guy install`
- `guy auth claude`
- `guy auth codex`
- `guy status`
- `guy doctor`
- `guy repair`

The runtime should manage a Guy-owned state directory such as `~/.guy/` and render a curated subset of configs/assets for Claude Code, Pi, and related helper tools.

## Plan of Work

### Milestone 1 — Freeze the dogfood contract

Write a lower-level RFC that turns the current `dotfiles-agents/manifest.json` and `setup.sh` into a clean installer/profile design for v0.1. That RFC should explicitly carve out what ships now versus what waits for v0.2.

**Status:** Done via `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`

**Result:** the implementation has a narrow contract and clear deferrals.

### Milestone 2 — Make the repo real

Replace placeholder package metadata with a buildable TypeScript workspace. Add shared TS config, package entrypoints, a small dependency budget, and a release-friendly CLI build path.

**Status:** Done. `pnpm install`, `pnpm build`, `pnpm test`, and `pnpm release:bundle` all pass.

**Result:** `pnpm build` and `pnpm test` are the default validation gates, and a local tarball bundle can be emitted.

### Milestone 3 — Define the shipped profile contract

Turn the profile schema into a real validated manifest. Add inheritance, versioning, supported platform metadata, required tools, post-install checks, and an asset manifest for the curated subset copied from `dotfiles-agents`.

**Status:** In progress. `profile.schema.json`, `assets.schema.json`, updated profile manifests, and Guy-owned state layout now exist. The current curated asset slice is intentionally tiny: neutral Pi settings plus `scout.md`.

**Result:** The Guy now has a bundle-safe profile contract and a real first shipped asset slice.

### Milestone 4 — Implement the runtime core

Build the state directory layout, install/apply logic, manifest loading, asset copy/rendering, and idempotent repair behavior in `guy-core`.

**Status:** In progress. Manifest loading, `~` path expansion, asset copying, rendered metadata persistence, and install state writes now work for the first bundled asset slice. Repair and broader asset coverage are next.

**Result:** `guy install` can already perform one real install slice against a temp home without needing `dotfiles-agents` at runtime.

### Milestone 5 — Implement provider readiness and health

Add provider adapters that can hand off to existing Claude/Codex login flows and detect whether the machine is ready. Implement Pi boot verification and drift checks. Surface everything through status/doctor/repair.

**Status:** In progress. `guy auth claude` and `guy auth codex` now perform real CLI handoff if the provider binary exists. `guy doctor` checks provider CLI presence, but true auth-state verification is still shallow.

**Result:** The Guy can already tell you whether the current slice is installed, whether managed assets exist, and whether provider CLIs are present on the machine.

### Milestone 6 — Cut and validate a dogfood artifact

Build a local artifact, run an end-to-end smoke test on this machine, then run parallel reviewer passes and fix the findings.

**Result:** v0.1 is usable by Minzi and ready for early-adopter dogfooding.

## Concrete Steps

1. Read and mine:
   - `/Users/minzi/Developer/dotfiles-agents/manifest.json`
   - `/Users/minzi/Developer/dotfiles-agents/setup.sh`
   - `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
2. Write `RFC-002` for the v0.1 installer/profile contract under `/Users/minzi/Developer/the-guy/docs/rfcs/`
3. Add workspace config:
   - root `tsconfig.json`
   - root `tsconfig.base.json`
   - real `package.json` scripts
4. Add schema/runtime source files under:
   - `packages/guy-profile-schema/src/`
   - `packages/guy-core/src/`
   - `packages/guy-doctor/src/`
   - `packages/guy-auth-claude/src/`
   - `packages/guy-auth-codex/src/`
   - `apps/guy-installer/src/`
5. Add curated asset manifests under `profiles/`
6. Implement CLI commands and smoke tests
7. Run:
   - `pnpm install`
   - `pnpm build`
   - `pnpm test`
   - local `guy` smoke flow
8. Run parallel reviews with:
   - `reviewer` (Opus 4.6 xhigh)
   - `reviewer-max` (GPT-5.4 xhigh)
   - additional scout/worker help as needed
9. Fix findings and re-run the smoke flow

## Validation and Acceptance

### Functional acceptance

- `guy install` is idempotent on the local machine
- `guy auth claude` and `guy auth codex` hand off to the installed CLIs or fail with actionable guidance
- `guy status` reports runtime version, selected profile, and auth/boot readiness
- `guy doctor` reports all failing checks with actionable remediation
- `guy repair` can converge drift in managed assets/config back to the shipped bundle

### Build acceptance

- `pnpm build` passes from repo root
- `pnpm test` passes from repo root
- a local built artifact can run without importing code from `dotfiles-agents`

### Review acceptance

- both `reviewer` and `reviewer-max` review the implementation
- all critical findings are fixed before declaring v0.1 ready

## Idempotence and Recovery

- `guy install` and `guy repair` must be safe to re-run
- managed config should be copy-based, so deleting `~/.guy` and re-running install returns the machine to the expected state
- if auth handoff fails, the runtime must not leave partially-written Guy state marked as healthy
- if the smoke flow fails, preserve logs under `~/.guy/` or a repo-local artifact directory so the next session can inspect them

## Important Questions to Surface to Minzi

These are worth asking only if they block implementation; otherwise choose the cleanest default and move.

1. Is `guy auth codex` required in v0.1, or is Codex status detection plus manual `codex login` acceptable for the first dogfood cut?
2. Should v0.1 manage OpenCode too, or keep the first shipped surface to Claude + Codex + Pi only?
3. Do you want the first artifact to be a simple tarball plus `pnpm dlx`/`node` entry, or should it already present itself as `theguy.sh` install docs?