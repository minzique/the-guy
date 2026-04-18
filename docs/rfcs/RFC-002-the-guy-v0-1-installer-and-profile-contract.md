# RFC-002: The Guy v0.1 Installer and Profile Contract

| Field | Value |
|-------|-------|
| **Author** | Minzi |
| **Status** | Draft |
| **Created** | 2026-04-13 |
| **Last Updated** | 2026-04-13 |
| **Scope** | The Guy v0.1 dogfood build |
| **Supersedes** | None |
| **Related** | `docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md` |

## Abstract

This RFC defines the lower-level contract for **The Guy v0.1**. It turns the current `dotfiles-agents/manifest.json` plus `setup.sh` into a product boundary that a real installer can implement without inheriting Minzi's repo layout, symlink assumptions, or secret-management workflow.

The core decision is simple: **v0.1 ships a copy-based runtime with one selectable profile (`power-user`), a CLI-only surface, and a small health model.** It does not ship `setup.sh`, `stow`, `git-crypt`, broad skill bootstrap, OpenCode setup, or update/rollback flows.

**Current execution note (2026-04-18):** the weekend founder build adds a thin `install.sh` bundle bootstrapper and `guy doctor --fix`, but install/doctor/repair logic still belongs in the TypeScript runtime rather than in bash.

The output of this RFC is a clean contract for three things:

1. what a shipped profile must declare
2. what the installer/runtime must do
3. what is explicitly deferred to v0.2+

## Motivation

`RFC-001` defines the product boundary at a high level. That is not enough to implement cleanly.

Today, the source system mixes four different concerns:

- authoring-time source material in `dotfiles-agents`
- workstation bootstrap logic in `setup.sh`
- local secret-unlock flow with `age` and `git-crypt`
- runtime config for Claude Code, Codex, Pi, helper CLIs, and community skills

That works for Minzi because Minzi already knows the repo and the failure modes. It is the wrong shape for a shipped product.

If v0.1 copies that structure directly, The Guy will freeze the same bad assumptions into a new repo:

- symlink-first installs
- source-repo coupling
- encrypted source checkout as a prerequisite
- monolithic shell bootstrap
- too many tools on day one

v0.1 needs a smaller contract.

## Goals and Non-Goals

**Goals**
- Ship a clean dogfood installer contract for macOS.
- Support one user-visible profile: `power-user`.
- Keep the runtime independent of a live `dotfiles-agents` checkout.
- Replace source-repo symlinks with Guy-managed copied assets.
- Define a stable Guy-owned state layout under `~/.guy`.
- Support these CLI commands in v0.1:
  - `guy install`
  - `guy auth claude`
  - `guy auth codex`
  - `guy status`
  - `guy doctor`
  - `guy repair`
- Use existing Claude/Codex CLI auth flows instead of inventing a new auth stack.
- Keep the implementation small enough to dogfood locally before widening scope.

**Non-Goals**
- Native Windows support.
- WSL2 support in v0.1.
- A guided installer or desktop GUI.
- Update channels, self-update, or rollback commands.
- Broad OpenCode setup.
- Community skill catalog bootstrap from `npx skills add ...`.
- `git-crypt` or `age` as end-user install prerequisites.
- Shipping every internal helper or edge-case workflow from `dotfiles-agents`.

## Current State Extracted from `dotfiles-agents`

### What `manifest.json` actually models

`dotfiles-agents/manifest.json` contains five useful buckets of information:

| Bucket | Example | Meaning today | Product meaning in The Guy |
|--------|---------|---------------|-----------------------------|
| `stow` | `home -> ~` | target roots for symlinked files | replaced by explicit managed asset destinations |
| `homebrew` | `age`, `git-crypt`, `gh`, `stow` | workstation prerequisites | split into authoring-only vs shipped runtime requirements |
| `binaries` | `bun`, `dcg`, `pi` | custom install commands | becomes a smaller runtime dependency contract |
| `skills` | skill sources, Pi symlink overrides | external skill bootstrap and source wiring | mostly deferred from v0.1 |
| `post_install` | `npm install`, `bun install`, `bun update ...` | repo-local follow-up tasks | becomes explicit runtime post-install tasks when still relevant |

### What `setup.sh` actually does

`dotfiles-agents/setup.sh` is a monolithic bootstrap script. It currently:

1. installs prerequisites with Homebrew
2. unlocks encrypted files with `age` + `git-crypt`
3. symlinks a large set of files into the home directory
4. resolves worktree/main-checkout logic for helper CLIs
5. verifies helper CLI availability
6. installs OpenCode plugin dependencies
7. removes legacy Claude Max proxy state
8. installs community skill catalogs
9. installs OpenCode, `dcg`, and `pi`
10. installs Pi extension dependencies and packages
11. mutates `~/.zshrc`
12. verifies Pi setup

That script is valuable source material. It is not a product contract.

## Approaches

### Approach A — Ship `setup.sh` logic with light cleanup

Keep the current structure, rename a few things, and slowly carve pieces out later.

**Pros**
- fastest path to something installable for Minzi
- reuses existing source material directly
- minimal design work now

**Cons**
- locks in source-repo coupling
- keeps `git-crypt`, symlinking, and shell mutations in the product path
- makes later cleanup harder, not easier
- cannot produce a clean dogfood artifact

### Approach B — Define a small installer/profile contract and build to it **(recommended)**

Compile or curate shipped assets out of `dotfiles-agents`, then let The Guy install from its own bundle into Guy-owned state and tool config targets.

**Pros**
- clean product boundary now
- no live repo or encrypted checkout needed at runtime
- explicit asset ownership and drift repair
- small enough to implement and dogfood quickly

**Cons**
- requires up-front contract work
- forces explicit deferrals instead of vague future support
- some current setup behavior must be dropped or postponed

### Approach C — Build the final release/updater system first

Treat v0.1 as the first version of the full future product: bundle compiler, channel switching, rollback, installer shell, and cross-platform story.

**Pros**
- fewer future migrations
- cleaner long-term story on paper

**Cons**
- too much scope for the first dogfood cut
- delays the first usable runtime
- risks spending weeks on packaging before validating the profile/runtime model

### Recommendation

Choose **Approach B**.

The Guy v0.1 should be opinionated and narrow. It should prove the runtime, profile, and health model first. Everything else can layer on later.

## Detailed Design

### Before and after

**Current source-system shape**

```text
+---------------------------+
| dotfiles-agents checkout  |
|                           |
| manifest.json             |
| setup.sh                  |
| encrypted files           |
| home/ + developer/ trees  |
+-------------+-------------+
              |
              | unlock + symlink + install everything
              v
        current workstation
```

**v0.1 shipped shape**

```text
+--------------------------------------+
| The Guy artifact / workspace build   |
|                                      |
| apps/guy-installer                   |
| packages/guy-*                       |
| profiles/base                        |
| profiles/power-user                  |
+-------------------+------------------+
                    |
                    | install / doctor / repair
                    v
+--------------------------------------+
| Guy-managed runtime                  |
|                                      |
| ~/.guy/state/...                     |
| ~/.guy/logs/...                      |
| managed copied assets                |
| provider auth handoff/status         |
+--------------------------------------+
                    |
                    +--> Claude Code config targets
                    +--> Codex config targets
                    +--> Pi config targets
```

### v0.1 shipped surface

#### Supported platform

- **macOS only**

#### Supported profile selection

- **`power-user`** is the only user-selectable shipped profile
- `base` exists as an internal inherited profile
- `guided` remains in the repo as deferred metadata only

#### Supported commands

- `guy install`
- `guy auth claude`
- `guy auth codex`
- `guy status`
- `guy doctor`
- `guy repair`

#### Explicit deferrals

- `guy update`
- `guy rollback`
- `guy channel`
- GUI/guided onboarding
- OpenCode bootstrap
- automatic community skill installation
- shell profile mutation

### Runtime state layout

The runtime owns a single directory: `~/.guy`.

```text
~/.guy/
  state/
    install.json        current install/profile/runtime state
  logs/
    doctor.log          latest doctor output
  cache/
    bundles/            future artifact/cache space
  rendered/
    power-user/         rendered manifests and resolved asset metadata
  backups/              reserved for future repair/rollback work
```

`install.json` should be the single source of truth for runtime state.

```json
{
  "version": "0.1.0",
  "profileId": "power-user",
  "channel": "dogfood",
  "platform": "darwin",
  "installedAt": "2026-04-13T00:00:00.000Z",
  "updatedAt": "2026-04-13T00:00:00.000Z",
  "managedAssetHash": "...",
  "health": "ready"
}
```

### Profile contract

The shipped profile contract splits into two files per profile.

1. `profile.json` — identity, inheritance, platform/tool requirements, doctor checks
2. `assets.json` — explicit managed asset list

#### `profile.json`

Each shipped profile must declare:

- schema version
- profile id and display name
- profile status: `internal`, `shipping`, or `deferred`
- inheritance
- supported platforms
- UI mode
- default channel metadata
- managed tools in scope
- binary requirements
- doctor checks
- asset manifest path
- post-install tasks that still belong to the shipped runtime

Example shape:

```json
{
  "version": "0.1",
  "id": "power-user",
  "displayName": "Power User",
  "description": "Terminal-forward The Guy profile for macOS dogfooding.",
  "status": "shipping",
  "inherits": ["base"],
  "supportedPlatforms": ["darwin"],
  "uiMode": "terminal-first",
  "channel": "dogfood",
  "selectable": true,
  "managedTools": ["claude", "codex", "pi", "gh"],
  "binaryRequirements": [
    {
      "id": "pi",
      "required": true,
      "managedByGuy": true,
      "installHint": "npm install -g @mariozechner/pi-coding-agent"
    },
    {
      "id": "claude",
      "required": true,
      "managedByGuy": false,
      "installHint": "Install Claude Code before running guy auth claude"
    }
  ],
  "assetManifest": "./assets.json",
  "doctorChecks": ["runtime-state", "managed-assets", "pi", "claude-auth", "codex-auth"]
}
```

#### `assets.json`

Each asset entry must be explicit. `stow`-style implicit tree mapping is out.

```json
{
  "version": "0.1",
  "profileId": "power-user",
  "assets": [
    {
      "id": "pi-settings",
      "source": "./assets/pi/settings.json",
      "destination": "~/.pi/agent/settings.json",
      "strategy": "copy",
      "required": true
    }
  ]
}
```

This gives `repair` a real ownership model.

### Installer/runtime contract

`guy install` must do only product-runtime work.

#### Required install behavior

1. detect platform and fail fast if unsupported
2. create Guy-owned state directories
3. load and resolve the selected profile
4. ensure Guy-managed runtime dependencies are present
5. copy/render managed assets to their final destinations
6. run declared post-install tasks that still belong to the shipped runtime
7. persist `install.json`
8. run a basic doctor pass

#### Required repair behavior

`guy repair` must:

1. load the last installed profile from `install.json`
2. re-resolve the same asset set
3. restore missing/drifted managed files
4. rerun safe post-install tasks
5. update health state and logs

#### Required status behavior

`guy status` must report:

- The Guy version
- installed profile id
- platform
- health state
- provider auth readiness summary
- last doctor result timestamp if present

#### Required doctor behavior

`guy doctor` must check at least:

- runtime state file exists and parses
- selected profile is supported on this platform
- managed asset destinations exist
- Pi CLI exists and responds
- Claude auth readiness
- Codex auth readiness

### Provider auth contract

v0.1 does **not** invent a new auth system.

#### Claude

`guy auth claude` must:

- check whether the Claude CLI is installed
- hand off to the existing Claude login flow if available
- store only Guy-owned status metadata, not shared secrets
- report readiness through `status` and `doctor`

#### Codex

`guy auth codex` must follow the same pattern.

#### Explicitly not in scope

- moving refresh tokens between devices
- replacing provider-owned secure storage
- abstracting all provider auth behind a generic credential manager

### Mapping from current source system to v0.1

| Current input | v0.1 treatment | Notes |
|---------------|----------------|-------|
| `stow` roots | removed | replaced by explicit asset manifests |
| `age`, `git-crypt` | authoring-only | not required by installed runtime |
| `stow` binary | removed | copy-based runtime owns files |
| `gh` | optional/required-by-profile | kept only if the power-user profile truly needs it |
| `bun` | deferred | tied to OpenCode and broader tooling |
| `dcg` | deferred | not part of the first dogfood cut |
| `pi` install command | kept | Pi is in v0.1 scope |
| skill source catalogs | deferred | too much surface for v0.1 |
| Pi symlink overrides | convert to shipped copied assets if still needed | no symlinks in runtime |
| OpenCode plugin install | deferred | OpenCode not in v0.1 default scope |
| `~/.zshrc` PATH mutation | deferred | runtime should not silently edit shells in v0.1 |
| helper CLI worktree logic | deferred | source-repo concern, not runtime concern |
| legacy Claude Max cleanup | dropped | old local cleanup, not product contract |

### Repo shape for the implementation

```text
apps/
  guy-installer/
    src/cli.ts
packages/
  guy-core/
    src/index.ts
  guy-doctor/
    src/index.ts
  guy-profile-schema/
    src/index.ts
    schema/profile.schema.json
  guy-auth-claude/
    src/index.ts
  guy-auth-codex/
    src/index.ts
profiles/
  base/
    profile.json
    assets.json
  power-user/
    profile.json
    assets.json
  guided/
    profile.json
```

## Testing and Rollout

### Test plan for this RFC's implementation

- unit tests for profile parsing and state-path resolution
- unit tests for CLI command dispatch
- smoke test: build workspace, run `guy status`, run `guy doctor`
- smoke test: build a local artifact, install to a temp home directory, verify `install.json`

### Rollout plan

- Phase 1: implement the contract locally in `the-guy`
- Phase 2: dogfood on Minzi's machine with a temp/home override
- Phase 3: cut a manual artifact for early technical adopters

### Rollback plan

There is no end-user rollback command in v0.1.

If implementation of this RFC goes wrong during dogfooding:

- delete the temp Guy state directory
- fix the profile/runtime contract
- rerun install

That is acceptable for the first dogfood build.

## Open Questions

1. Should `guy auth codex` be a hard v0.1 command, or is Codex status detection plus manual `codex login` enough for the first cut?
2. Does the `power-user` profile need `gh` installed automatically, or can `doctor` treat it as a recommended but non-blocking dependency?
3. Does the first artifact need to present a `theguy.sh` story immediately, or is a tarball + `node dist/cli.js` dogfood path enough?

## References

- `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- `/Users/minzi/Developer/dotfiles-agents/manifest.json`
- `/Users/minzi/Developer/dotfiles-agents/setup.sh`
- `/Users/minzi/Developer/the-guy/docs/exec-plans/active/the-guy-v0-1-dogfood.md`
