# RFC-001: The Guy — Managed Agent Harness Distribution

- **Status:** Draft
- **Authors:** Minzi
- **Created:** 2026-04-13
- **Reviewers:** TBD
- **Decision Deadline:** TBD

## Abstract

The Guy is a managed local-first distribution of Minzi's agent harness. It packages the current `dotfiles-agents` setup into something people can install, enroll, update, repair, and roll back without inheriting Minzi's full personal workstation assumptions.

The product boundary changes in this RFC. `dotfiles-agents` becomes the internal authoring source for prompts, rules, helper tools, and reference configuration. The Guy becomes the shipped runtime: installer, profile system, auth enrollment, release channels, and health checks.

**Current execution note (2026-04-18):** the immediate shipping slice is a Pi-first founder dogfood build. The wedge is agent operations, not “another assistant”: one-command install, a reliable local runtime, doctor/repair, and later Paperclip plus a control plane.

This RFC recommends a profile-driven bootstrap core with two user surfaces: a CLI for technical users and a guided installer for nontechnical users. The first supported targets should be **macOS native** and **Windows via WSL2**, with device-local Claude and Codex authentication and a shared runtime for Claude Code, Codex, and Pi.

## Motivation

The current setup works for Minzi because Minzi already knows the repo, the terminal conventions, the auth workarounds, and the failure modes. It does not work as a product.

Today, the main entrypoint is still `git clone && ./setup.sh` from `dotfiles-agents/README.md`, backed by a large shell script in `dotfiles-agents/setup.sh`. That script assumes:

- Homebrew and a Darwin-first environment
- a terminal-comfortable user
- symlink-friendly filesystem behavior
- local paths under `~/Developer`
- secrets unlocked through `git-crypt` and an age passphrase
- global runtime installation through `npm`, `bun`, and shell profile edits

Those assumptions are fine for internal dogfooding. They are wrong for a shippable distribution.

The user need is simple:

> Install one thing, sign into Claude and Codex, get the harness, and keep getting sane updates.

That is the product The Guy should provide.

## Problem Statement

We need a shippable harness distribution that serves both technical and nontechnical users, preserves the core philosophy of the current agent setup, and supports release planning instead of raw repo sync.

The system must answer five product questions:

1. **Installation:** How does a new machine get the runtime without cloning internal repos and hand-running setup steps?
2. **Enrollment:** How does a person authenticate Claude, Codex, and Pi-adjacent provider access without touching shared refresh-token files?
3. **Profiles:** How does the same harness adapt to a terminal-native user and a terminal-averse user without forking the whole system?
4. **Updates:** How do users receive changes through release channels instead of live repo state?
5. **Health:** How do we know whether a device is healthy, repairable, or ready to update?

## Personas and User Segments

The current known users are enough to define the initial profile model.

| Persona | Current behavior | Product implication |
| --- | --- | --- |
| **Asra** | Likes the terminal and already has Minzi's terminal setup | Ship a power-user profile with full CLI depth and fast access to beta features |
| **Belva** | Annoyed by terminal setup friction and does not have Minzi's terminal environment | Ship a guided profile with one-click install, guided auth, updates, and repair |
| **Dulina** | Already uses Pi and OpenCode | Ship an overlay-friendly path that can coexist with existing tools |
| **Hash** | Unknown | Do not optimize the initial design for unknown needs; keep the profile model extensible |
| **The Guy** | Internal dogfood reference harness that tracks new capabilities early | Treat this as the dogfood channel and reference install for release validation |

## Goals

### Product goals

- Make The Guy installable by both technical and nontechnical users
- Preserve the same underlying harness capabilities across users
- Support Claude Code, Codex, and Pi from one managed runtime
- Separate syncable configuration from device-local secrets
- Ship release channels so users get pinned, testable versions instead of live repo state
- Give each install a clear health surface through status, doctor, repair, and rollback

### Technical goals

- Turn the current `dotfiles-agents/manifest.json` into a real profile manifest and installation spec
- Replace the current monolithic `setup.sh` path with a bootstrap core that supports multiple frontends
- Keep macOS native support first-class
- Support Windows first through WSL2 rather than through a separate native Windows runtime
- Reuse existing Claude and Codex auth research rather than inventing a third auth system

## Non-Goals

- Shipping native Windows desktop support in v0
- Rebuilding Claude, Codex, or Pi themselves
- Centralizing user secrets in Git or in a shared encrypted repo
- Building a remote fleet management product in v0
- Supporting every existing edge-case tool and local customization from `dotfiles-agents` on day one
- Locking the product name forever; "The Guy" is good enough to build around now

## Current State

The current internal system has three valuable parts and one bad product boundary.

### Valuable parts

1. **Good authoring material**
   - prompts, rules, helper tools, extensions, packages, and workflows already exist in `dotfiles-agents`
2. **Real usage pressure**
   - Minzi already uses the harness daily
   - there are real user archetypes already visible in Asra, Belva, and Dulina
3. **Auth research already exists**
   - Claude OAuth experiments and adapters already exist in related repos
   - Codex OAuth flow code already exists in related repos

### Bad boundary

The shipped thing is currently too close to the authoring repo.

That creates four concrete problems:

- internal filesystem assumptions leak into the product
- secrets and config are mixed together
- updates track repo state instead of versioned releases
- onboarding assumes a terminal-first operator

## Requirements

### Functional requirements

- Install the runtime on a fresh machine
- Enroll Claude and Codex on the current device
- Render and apply a selected profile
- Verify health after install and after updates
- Update to a specific release channel
- Roll back to the previous known-good release

### Quality requirements

- Idempotent install and repair behavior
- Minimal hand editing of config files
- Clear failure messages for missing prerequisites and auth issues
- Stable path handling across updates
- No shared credential files copied across devices as the primary auth model

## Approaches

### Approach A — Ship `dotfiles-agents` directly

Users clone the repo, run `setup.sh`, and maybe get better docs plus a Windows script.

**Pros**
- fastest path to something barely distributable
- reuses the current repo almost unchanged
- low short-term engineering cost

**Cons**
- keeps the wrong product boundary
- duplicates install logic across shell scripts and platforms
- keeps auth and secrets tangled with personal config
- has no real release or rollback model
- keeps Belva-class users stuck in terminal setup friction

### Approach B — Build The Guy as a managed runtime plus profiles **(recommended)**

Create a bootstrap core that installs the runtime, handles enrollment, renders a selected profile, and updates through release channels. Keep `dotfiles-agents` as an internal source repo that feeds the shipped product.

**Pros**
- creates a real product boundary
- supports both CLI and guided UX from one backend
- lets us version runtime, profiles, and migrations cleanly
- keeps secrets local to each device
- allows dogfood, beta, and stable release rings

**Cons**
- higher initial engineering cost than just polishing `setup.sh`
- requires profile compilation or rendering work up front
- forces explicit choices about auth ownership and path mapping

### Approach C — Build a full desktop app first

Start with a native-feeling GUI installer/updater and make the CLI secondary.

**Pros**
- great fit for Belva-class users
- easy to explain and demo
- creates a polished first impression

**Cons**
- pushes a large amount of product and frontend work ahead of runtime design
- risks hiding unresolved core issues behind a nicer shell
- slows down power-user adoption and dogfooding
- likely creates duplicate logic unless a shared bootstrap core exists first

## Recommendation

Choose **Approach B**.

Do not ship `dotfiles-agents` directly. Do not start with a desktop app. Build a real bootstrap core first, then expose it through a CLI and later a guided installer.

This gives the shortest path to something shippable without freezing bad assumptions into the product. It also preserves the current philosophy: improve tooling and workflow, not just prompts and defaults.

## Detailed Design

### Core concepts

The system has five core concepts.

1. **Runtime**
   - installs required binaries and package dependencies
   - owns update, repair, and rollback behavior
2. **Profile**
   - defines prompts, rules, helper tools, defaults, and UX posture
   - chooses which capabilities to surface for a user segment
3. **Enrollment**
   - authenticates Claude and Codex on the current device
   - writes secrets to secure local storage and tool-specific config files only when needed
4. **Channel**
   - pins a device to `dogfood`, `beta`, or `stable`
   - controls update cadence and rollout risk
5. **Health**
   - reports whether the install is ready, degraded, or broken
   - powers `status`, `doctor`, `repair`, and rollback decisions

### Proposed architecture

```text
                         dotfiles-agents
                   (internal authoring source)
                                |
                                | build / compile
                                v
+---------------------------------------------------------------+
|                         The Guy release                        |
|                                                               |
|  +-------------------+    +-------------------------------+   |
|  | bootstrap core    |--->| profile renderer / installer  |   |
|  +-------------------+    +-------------------------------+   |
|           |                            |                       |
|           |                            +--> Claude Code config |
|           |                            +--> Codex config       |
|           |                            +--> Pi config          |
|           |                                                    |
|           +--> auth modules (Claude, Codex)                    |
|           +--> doctor / status / repair                        |
|           +--> updater / rollback                              |
+---------------------------------------------------------------+
            |                                  |
            |                                  |
            v                                  v
   CLI surface for power users        Guided installer for nontechnical users
```

### Repository shape

This repo should model the product boundary directly.

```text
apps/
  guy-installer/        CLI entrypoint now, GUI shell later
packages/
  guy-core/             Bootstrap engine, update engine, profile application
  guy-doctor/           Status, doctor, repair, rollback checks
  guy-profile-schema/   Shared profile manifest schema and validators
  guy-auth-claude/      Claude enrollment flow
  guy-auth-codex/       Codex enrollment flow
profiles/
  base/                 Shared baseline
  power-user/           Terminal-forward defaults
  guided/               Low-friction defaults for nontechnical users
docs/rfcs/
  RFC-001-...           Product definition and rollout plan
```

### Platform strategy

#### macOS

Support macOS natively in v0.

That matches the current dogfood environment and lets us reuse most of the working runtime assumptions while we remove personal-machine coupling.

#### Windows

Support Windows in v0 through **WSL2**, not native Windows.

This is the right trade.

- We keep one mostly POSIX runtime surface
- we keep shell, path, and package behavior consistent
- VS Code Remote WSL still gives a decent local experience
- we avoid doubling platform work before the product boundary is stable

Native Windows support can come later if demand proves it matters.

### Auth and enrollment model

The auth boundary must change.

#### Current issue

The current internal setup relies too much on shared repo state, encrypted files, and machine-specific conventions.

#### Proposed rule

- sync **configuration**
- do not sync **live credentials**

#### Claude

Each device runs its own Claude enrollment flow.

The Guy should reuse the existing Claude OAuth research and adapter work rather than inventing a new protocol. The runtime may write tool-specific files if needed, but the source of truth should be secure local storage for the device.

#### Codex

Each device runs its own Codex enrollment flow.

The Guy should support both ChatGPT-based device login and API-key fallback where appropriate, again with device-local storage.

#### Pi

Pi should consume rendered config plus provider credentials through the same device-local auth model. Pi should not invent a separate secret sync story if provider credentials already exist locally.

### Profile model

Profiles should describe capability posture, not entirely different products.

#### `base`

The baseline runtime for everyone.

- installs Claude, Codex, and Pi integration
- applies shared prompts, rules, helper tools, and defaults
- exposes the minimum health and update surface

#### `power-user`

For Asra-like users.

- terminal-first UX
- full helper CLI access
- worktree-heavy flows
- earlier access to beta features

#### `guided`

For Belva-like users.

- guided install and guided auth
- update and doctor surfaced plainly
- same harness underneath, less terminal ceremony

A later `overlay` profile can target Dulina-like users who already have Pi or OpenCode and want selective adoption.

### Release channels

The Guy should ship channel-based updates from the beginning.

| Channel | Audience | Update posture |
| --- | --- | --- |
| `dogfood` | Minzi, internal reference installs, The Guy itself | continuous and fast-moving |
| `beta` | technical early adopters such as Asra and Dulina | frequent, but gated by a passing doctor run |
| `stable` | Belva and any user who values low friction | slower, pinned releases only |

### Health model

The Guy needs a small, explicit health model.

Minimum status surface:

- installed runtime version
- selected profile and channel
- Claude auth status
- Codex auth status
- Pi boot verification
- last update result
- last doctor result
- critical package load status

That status powers four commands:

- `guy status`
- `guy doctor`
- `guy repair`
- `guy rollback`

### Update model

Updates should apply versioned release bundles, not live repo state.

A release should contain:

- runtime version
- profile version
- migration steps
- post-install smoke checks
- rollback metadata

This is what makes Belva-safe updates possible.

## Service SLAs and Observability

The Guy is not a backend service, but it still needs concrete operating targets.

### v0 targets

- **Fresh install success rate:** 90% or better on supported environments after docs and onboarding are included
- **Update success rate:** 95% or better on machines that pass `guy doctor` before update
- **Rollback success rate:** 99% for one-step rollback to the previous known-good release
- **Doctor runtime:** under 30 seconds on a healthy machine
- **Status runtime:** under 5 seconds on a healthy machine

### Observability events

The runtime should record local structured events for:

- install started / finished / failed
- auth started / finished / failed for each provider
- update started / finished / failed
- rollback started / finished / failed
- doctor started / finished with failing checks

Remote reporting is optional in v0. Local logs are required.

## Rollout Plan

### Phase 0 — Authoring split

- treat `dotfiles-agents` as the internal authoring repo
- define the product boundary around The Guy
- formalize profile concepts and release channels

### Phase 1 — Bootstrap core

- implement the shared install/update/repair engine
- turn `dotfiles-agents/manifest.json` into a real profile spec
- replace direct `setup.sh` ownership with the new core

### Phase 2 — Auth modules

- add Claude device enrollment
- add Codex device enrollment
- define how Pi consumes local provider credentials

### Phase 3 — Health and updates

- implement status, doctor, repair, rollback
- produce versioned release bundles
- gate updates on health checks where appropriate

### Phase 4 — Profiles and rings

- ship `base`, `power-user`, and `guided`
- put Minzi on `dogfood`
- put Asra and Dulina on `beta`
- put Belva on `stable`

### Phase 5 — Guided installer

- add a guided installer shell on top of the same bootstrap core
- keep the CLI as the source of truth for behavior

## Risks and Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| We keep too much of the current personal-machine layout | The product stays brittle and unshippable | Make the profile compiler explicit and ban repo-relative runtime paths in shipped output |
| We centralize secrets again by convenience | Device auth becomes fragile and unsafe | Keep config sync separate from credential storage from the start |
| We try to support native Windows too early | Platform cost doubles before the product boundary is stable | Use WSL2 first and defer native Windows |
| We optimize for Belva with a GUI before the core exists | We build a polished shell over bad foundations | Keep CLI and bootstrap core first; add guided UI second |
| We auto-update stable users too aggressively | Trust collapses after one bad release | Use channels, health gates, and one-step rollback |

## Open Questions

- Should The Guy remain the long-term external product name, or should it stay internal with a cleaner public brand later?
- How much of Minzi's personal prompt/style system belongs in `base` versus in a private overlay?
- Should Dulina-style overlay installs ship in v0 or wait until the base and guided profiles are stable?
- Which secure storage backend should own the canonical credential store on macOS and WSL2?
- How much local telemetry is worth keeping before we need any remote fleet view?

## Decision

Adopt **The Guy** as a new product boundary and repository now.

Use this repo to build the runtime, profile system, auth enrollment, release channels, and health model. Keep `dotfiles-agents` as the internal authoring source and feed The Guy through compiled, versioned releases rather than live repo sync.
