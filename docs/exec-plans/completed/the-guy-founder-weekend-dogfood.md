# The Guy founder weekend dogfood

## Purpose / Big Picture

Ship a weekend build of The Guy that founder friends can actually install and use without inheriting Minzi's dotfiles repo, symlink setup, or shell debugging burden.

After this work, you should be able to hand someone one install command, get a working `guy` launcher, install Pi if it is missing, render the shipped Minzi-style Pi payload into `~/.pi/**`, run `guy doctor`, and recover most local drift with `guy doctor --fix` or `guy repair`.

This plan is explicitly for the **weekend Pi-first dogfood cut**. Paperclip, connector packaging, and the hosted control plane come later.

## Progress

- [x] (2026-04-18 07:01Z) Refresh product docs around the managed-runtime wedge and weekend founder scope
- [x] (2026-04-18 07:01Z) Expand the shipped `power-user` asset set to include the core Pi runtime payload
- [x] (2026-04-18 07:01Z) Make `guy install` able to install Pi and sync portable Pi packages
- [x] (2026-04-18 07:01Z) Add one-command release-bundle install flow
- [x] (2026-04-18 07:01Z) Add doctor auto-fix flow and smoke-test it from the CLI
- [x] (2026-04-18 07:01Z) Build a release bundle and run the end-to-end founder dogfood smoke flow

## Surprises & Discoveries

- The weekend copy-based payload expansion works as a shipping move, but it immediately reintroduces a source-of-truth problem: if you start editing the mirrored payload directly in `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/`, you will forget to land the same changes upstream.
- The first bundle-install smoke test failed because the installer symlinked `~/.local/bin/guy` directly to the bundle launcher, and that launcher resolved paths relative to the symlink location instead of the installed release. Writing a tiny wrapper script in `install.sh` fixed that cleanly.

## Decision Log

- The copied Pi payload in The Guy is temporary render input, not the long-term authoring home. Until the pack-owned manifest flow from `RFC-003` lands, the authoritative payload should live upstream on a dedicated dev branch and The Guy should mirror it for release builds.
- The immediate safeguard is a Node-based sync script at `/Users/minzi/Developer/the-guy/scripts/sync-power-user-pi-payload.mjs`. Refresh the mirrored payload with `pnpm sync:power-user-payload` instead of hand-copying files.
- Bash stays as a bootstrap shim only. The runtime install, doctor, package sync, and repair logic remains in the TypeScript packages.

## Outcomes & Retrospective

- The founder weekend slice is now real enough to hand to an early adopter: the release bundle can be installed through `/Users/minzi/Developer/the-guy/install.sh`, `guy install` renders the Pi-first payload, and `guy doctor --fix` converges the managed runtime from the CLI.
- The biggest architectural compromise is still the mirrored payload under `profiles/power-user/assets/.pi/agent/`. That compromise is now explicit in the docs and guarded by a sync script, but it still needs to be replaced by the pack-owned manifest flow from `RFC-003`.
- The fast path was the right one. A thin installer plus a tested TypeScript runtime is already much less fragile than another large shell bootstrap.

## Context and Orientation

### Repo and key docs

- Product repo: `/Users/minzi/Developer/the-guy`
- Shared plans doc: `/Users/minzi/Developer/the-guy/docs/PLANS.md`
- Vision doc: `/Users/minzi/Developer/the-guy/docs/VISION.md`
- Product RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- Installer/profile RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`
- Pi payload RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-003-pack-owned-pi-payloads-and-overrides.md`

### Current runtime files

- CLI entrypoint: `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
- Runtime core: `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
- Doctor logic: `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.ts`
- Profile types: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
- Profile schema: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/schema/profile.schema.json`
- Release bundling: `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`
- Release installer shim: `/Users/minzi/Developer/the-guy/install.sh`

### Current shipped profile files

- Power-user profile: `/Users/minzi/Developer/the-guy/profiles/power-user/profile.json`
- Power-user assets manifest: `/Users/minzi/Developer/the-guy/profiles/power-user/assets.json`
- Shipped Pi payload root: `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/`

### Source authoring material

- Dotfiles source repo: `/Users/minzi/Developer/dotfiles-agents`
- Source Pi AGENTS: `/Users/minzi/Developer/dotfiles-agents/home/.pi/agent/AGENTS.md`
- Source Pi extensions: `/Users/minzi/Developer/dotfiles-agents/home/.pi/agent/extensions/`
- Source Pi skills: `/Users/minzi/Developer/dotfiles-agents/home/.pi/agent/skills/`

### Terms used in this plan

- **Release bundle**: the tarball produced by `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs` that contains the runnable CLI, bundled workspace packages, and profile assets.
- **Managed runtime**: The Guy-owned state and commands under `~/.guy/` plus the rendered files it owns under `~/.pi/**`.
- **Doctor auto-fix**: a CLI flow that can converge the local machine back toward the shipped runtime without forcing the user to reason about missing files or package drift manually.
- **Pi-first dogfood**: the narrow launch slice that optimizes for a working Pi runtime before Paperclip or a hosted control plane exists.

## Plan of Work

### Milestone 1 — Refresh docs and the product story

Write a clear vision document and update the main README so the repo tells the right story: The Guy is a managed local-first agent runtime, not a bash-heavy dotfiles clone. The docs must state that bash is only the bootstrap shim and the TypeScript runtime owns install, doctor, repair, and asset rendering.

**Result:** a new reader immediately understands the wedge, the weekend scope, and the later control-plane direction.

### Milestone 2 — Ship the real Pi payload

Expand the `power-user` assets from the tiny prompt/agent slice to the actual Pi-first founder payload: `AGENTS.md`, core extensions, prompts, agents, and bundled local skills. Keep the shipped `settings.json` portable.

**Result:** `guy install` renders a runtime that feels like Minzi's setup instead of a toy scaffold.

### Milestone 3 — Move install logic into the runtime, not bash

Teach the TypeScript runtime to install Pi when the managed binary is missing and to sync portable Pi packages from the shipped settings. This must be testable and idempotent. Do not push that logic into shell scripts.

**Result:** `guy install` is the real install command. Bash only gets the runtime onto disk.

### Milestone 4 — Add the one-command install path

Use `/Users/minzi/Developer/the-guy/install.sh` as the thin release bootstrapper. It should download or copy a bundle, unpack it into a Guy-owned releases directory, link `guy` into `~/.local/bin`, and optionally run `guy install`.

**Result:** founder friends can use one command without cloning the repo or running workspace build steps.

### Milestone 5 — Add doctor auto-fix

Add `guy doctor --fix` or equivalent so the runtime can repair common local drift by re-rendering owned files and re-running portable package sync. The doctor output should stay actionable when a fix is not possible automatically.

**Result:** the first support loop is built into the CLI.

### Milestone 6 — Prove the artifact

Build the release tarball and run the full founder-dogfood smoke flow from the bundle, not from the repo source tree.

**Result:** the weekend build is real enough to hand to founder friends.

## Concrete Steps

1. Update docs:
   - `/Users/minzi/Developer/the-guy/README.md`
   - `/Users/minzi/Developer/the-guy/docs/VISION.md`
   - `/Users/minzi/Developer/the-guy/docs/exec-plans/active/the-guy-founder-weekend-dogfood.md`
2. Expand the shipped Pi payload under `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/`.
3. Regenerate `/Users/minzi/Developer/the-guy/profiles/power-user/assets.json` from the curated payload tree.
4. Update runtime/profile code in:
   - `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/schema/profile.schema.json`
   - `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.ts`
   - `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
5. Add the release-bundle installer shim at `/Users/minzi/Developer/the-guy/install.sh`.
6. Update and run tests:
   - `cd /Users/minzi/Developer/the-guy && pnpm test`
7. Build and smoke-test the bundle:
   - `cd /Users/minzi/Developer/the-guy && pnpm release:bundle`
   - `cd /Users/minzi/Developer/the-guy && ./install.sh --bundle ./.artifacts/the-guy-0.1.0.tar.gz --no-run`
   - `~/.local/bin/guy install`
   - `~/.local/bin/guy doctor`
   - `~/.local/bin/guy doctor --fix`

## Validation and Acceptance

### Functional acceptance

- `install.sh` can install a release bundle without a repo checkout on the target machine.
- `guy install` installs Pi if missing, copies the bundled Pi payload, and writes `~/.guy/state/install.json`.
- `guy doctor` reports the machine state with actionable failures.
- `guy doctor --fix` repairs managed-file drift and re-syncs portable Pi packages when possible.
- The installed runtime contains the shipped Minzi-style Pi payload: AGENTS, prompts, agents, extensions, and skills.

### Build acceptance

- `cd /Users/minzi/Developer/the-guy && pnpm test` passes.
- `cd /Users/minzi/Developer/the-guy && pnpm release:bundle` passes.
- The release tarball can run `bin/guy` without access to `/Users/minzi/Developer/dotfiles-agents`.

### User acceptance

A founder friend with Node installed can run one install command against the release bundle and get a usable Pi runtime the same day.

## Idempotence and Recovery

- `guy install` and `guy repair` must be safe to rerun.
- `install.sh` should replace the named release directory atomically enough that rerunning it lands on the same result.
- If `guy install` fails after copying assets, rerun `guy doctor --fix` or `guy repair` before manual debugging.
- If the installed runtime is hopelessly broken, delete `~/.guy/current`, the specific release directory under `~/.guy/releases/`, and the affected `~/.pi/**` files that The Guy owns, then reinstall from the bundle.
- Do not add symlink-based product state as a fallback. That reintroduces the failure mode this plan is trying to remove.
