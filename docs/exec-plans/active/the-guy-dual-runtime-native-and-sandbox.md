# The Guy dual runtime: native install + sandboxed local/remote execution

## Purpose / Big Picture

Ship **one The Guy product** with **two primary runtime envelopes** and one future-facing hosting contract:

1. **Native envelope** — `guy install` manages a real local runtime in the user’s home directory.
2. **Sandbox envelope** — `guy sandbox ...` runs the same shipped payload inside an isolated local or remote sandbox.
3. **Paperclip-compatible envelope** — the sandbox contract is explicit enough that Paperclip can later launch the same runtime remotely without inventing a second product-specific execution model.

After this plan, a founder friend on macOS should be able to:
- install The Guy natively with the existing bundle flow,
- start an isolated local sandbox with one command,
- reattach to that sandbox with low interactive latency,
- optionally point the same sandbox flow at a remote Docker host over SSH,
- understand exactly what filesystem, network, and credential access the sandbox received,
- and recover or compact long-running implementation work without losing track of progress.

This plan intentionally **does not** make OpenShell or macOS-guest virtualization the first shipping substrate. Instead it establishes a **shared runtime contract** and ships a **Docker-backed v0 driver** first, with explicit extension points for OpenShell and microVM/macOS guest modes later.

## Progress

- [x] (2026-04-18 10:39Z) Create the exec plan on `feat/dual-runtime-sandbox` and lock the initial architecture direction
- [ ] Freeze the shared runtime contract, capability model, and v0 backend decisions in repo docs
- [ ] Add the sandbox package boundary, state model, and CLI command surface for `guy sandbox`
- [ ] Implement the local Docker sandbox flow with warm-container attach, exec, stop, and doctor coverage
- [ ] Extend release artifacts and CI so the same runtime can be turned into a reusable sandbox image and used remotely
- [ ] Implement the remote SSH + Docker host flow and a Paperclip-friendly non-interactive sandbox execution surface
- [ ] Run end-to-end validation, update docs, and capture the compaction / handoff loop so implementation can continue safely across sessions

## Surprises & Discoveries

- The pack-first branch already moved the shipped Pi payload into `/Users/minzi/Developer/the-guy/packages/guy-pi-pack/`, so the dual-runtime work should build on that branch rather than re-deriving payload ownership from `profiles/power-user/assets/`.
- The existing release artifact builder at `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs` already knows how to copy raw pack assets into the bundle. That is the right seam for generating or packaging a sandbox image later.
- The current runtime can install Pi on demand via profile `binaryRequirements`, but that path still assumes a mutable host environment. The sandbox flow needs an explicit decision about whether Pi is baked into the image, installed on first boot inside persistent sandbox state, or both.
- Existing The Guy tests already rely on `GUY_HOME` temp homes and bundle-based smoke tests, which makes them a good base for sandbox smoke coverage without creating fake user accounts.
- The agent harness `subagent` calls completed successfully but returned empty payloads, so the opposite-opinion pass must be preserved in this plan directly instead of relying on the returned text as the only record.

## Decision Log

- Build this work on branch `/Users/minzi/Developer/the-guy` @ `feat/dual-runtime-sandbox`, branched from `feat/pack-owned-pi-payloads`, so the sandbox runtime inherits the pack-owned payload boundary instead of fighting the old profile-local asset model.
- Treat **payload** and **runtime envelope** as separate concerns. The same shipped The Guy payload must be able to run natively and inside a sandbox.
- Ship **Docker-first** for v0 sandboxing. It is the shortest path to a working local + remote story, keeps local interaction low-latency, and is easier to validate end-to-end than OpenShell-first or macOS-guest-first.
- Use a **driver abstraction** from day one so Docker is the first backend, not the only backend. OpenShell and VM/microVM backends remain later-compatible choices.
- Prefer a **spawned Docker CLI wrapper** over a heavy Docker SDK for v0. The sandbox UX needs robust `run`, `exec`, `attach`, `cp`, `inspect`, and `logs` behavior. Spawning `docker` with argv arrays keeps behavior close to what developers debug manually, avoids shell injection, and avoids the streaming edge cases that often show up in daemon-API wrappers.
- Defer **OpenShell backend implementation** until the shared contract exists and the Docker path proves the product surface. OpenShell remains a strong future hardening backend.
- Defer **macOS guest mode** to a later high-isolation/testing slice. It is valuable for true macOS semantics, but it is the wrong first default for a lightweight sandbox story.
- Add an explicit **compaction / handoff loop** to this plan so the implementation can survive long-running sessions without losing branch state, plan state, or validation state.

## Outcomes & Retrospective

(fill when complete)

## Context and Orientation

### Repo and branch
- Product repo: `/Users/minzi/Developer/the-guy`
- Active implementation branch: `feat/dual-runtime-sandbox`
- Branch base: `feat/dual-runtime-sandbox` currently starts from `feat/pack-owned-pi-payloads`, not from `main`
- Existing draft PR that this branch effectively stacks on: `https://github.com/minzique/the-guy/pull/1`

### Existing user-visible entrypoints
- CLI entrypoint: `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
- Install script bootstrapper: `/Users/minzi/Developer/the-guy/install.sh`
- Install-script smoke tests: `/Users/minzi/Developer/the-guy/apps/guy-installer/src/install-script.test.ts`
- CLI smoke tests: `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.test.ts`

### Existing runtime and payload boundaries
- Core runtime: `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
- Core runtime tests: `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.test.ts`
- Doctor checks: `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.ts`
- Doctor tests: `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.test.ts`
- Shared schema/types: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
- Pi pack package: `/Users/minzi/Developer/the-guy/packages/guy-pi-pack/`
- Power-user profile manifest: `/Users/minzi/Developer/the-guy/profiles/power-user/profile.json`
- Release bundle builder: `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`
- Release workflow: `/Users/minzi/Developer/the-guy/.github/workflows/release.yml`

### Current state that matters for this feature
- `guy install`, `guy status`, `guy doctor`, and `guy repair` already work against a real home directory.
- The shipped `power-user` profile already references a canonical Pi pack through `piPack`.
- The current runtime writes managed files under `~/.guy/**` and rendered Pi files under `~/.pi/**`.
- The release bundle already contains The Guy app code, workspace package dist files, profile manifests, and Pi pack raw assets.
- No current command exists for sandbox lifecycle, image building, remote execution, or capability declaration.

### Terms used in this plan
- **Payload**: The versioned The Guy runtime content — CLI code, profile metadata, pack metadata, raw pack assets, and docs bundled into a release.
- **Native envelope**: The existing mode where The Guy mutates the user’s real home directory and manages `~/.guy/**` + `~/.pi/**` directly.
- **Sandbox envelope**: A mode where The Guy runs inside an isolated environment, with a persistent sandbox home and explicit host capability grants.
- **Driver**: The backend implementation for starting and controlling sandboxes. Docker is the v0 driver. OpenShell or VM backends are later drivers.
- **Capability model**: The user-facing permission shape for host paths, network access, and credential forwarding. This must not be hard-coded to one backend’s private flags.
- **Warm sandbox**: A long-lived sandbox container that remains available for low-latency reattach, rather than paying the full cold-start cost on every shell session.
- **Paperclip-compatible execution surface**: A non-interactive command/API shape that lets a remote control plane ask The Guy to start, inspect, exec, and stop a sandbox without emulating an interactive human terminal.
- **Compaction / handoff loop**: The implementation discipline of updating this plan, session todos, git commits, and a handoff before context quality degrades.

## Plan of Work

### Milestone 1 — Freeze the shared contract before coding the driver
Write the architecture down before backend code expands. This milestone defines the **shared runtime contract** and the **v0 scope boundary**:
- same payload, multiple envelopes,
- Docker-first backend for v0,
- OpenShell + macOS guest deferred but explicitly anticipated,
- capability model expressed in The Guy terms instead of raw Docker flags,
- low-latency local attach as a hard product requirement,
- Paperclip compatibility through a machine-friendly sandbox execution surface.

This should live in repo docs, either as a dedicated RFC/architecture doc or as a tightly scoped extension to the active plan and existing RFCs. The output must be strong enough that future sessions do not re-litigate the backend choice every turn.

**Result:** there is one stable product story: `guy install` for native, `guy sandbox` for isolated local/remote execution.

### Milestone 2 — Add the sandbox package boundary and command surface
Create a new package boundary for sandbox logic rather than stuffing Docker process control into the existing monolithic core runtime. This milestone should introduce:
- a new workspace package, expected at `/Users/minzi/Developer/the-guy/packages/guy-sandbox/`,
- typed sandbox state and capability types,
- a driver interface that can support local Docker first and remote/OpenShell/VM later,
- CLI command parsing and help text for `guy sandbox start|status|shell|exec|stop|doctor`,
- state location under `~/.guy/` for sandbox metadata, logs, and persistent identifiers.

The command surface must separate interactive and machine usage cleanly. `guy sandbox shell` is for humans. `guy sandbox exec -- <cmd>` is for automation and future Paperclip integration.

**Result:** the repo has a clear sandbox abstraction boundary and a user-visible CLI contract.

### Milestone 3 — Implement the local Docker driver with warm attach
Implement the first real backend using Docker on the local machine. The key rules:
- Use spawned `docker` commands with explicit argv arrays, never shell-string concatenation.
- Prefer a persistent named container or equivalent warm state so `guy sandbox shell` can reattach quickly.
- Provide a persistent sandbox home/volume separate from the host home.
- Mount the user’s chosen workspace explicitly; do not grant the real home directory by default.
- Bootstrap the runtime deterministically inside the sandbox so the same The Guy payload becomes runnable there.
- Expose human-friendly errors for missing Docker, missing images, failed bootstrap, and container drift.

This milestone should prove the product value locally: low-friction isolated usage without creating extra macOS users or a full VM.

**Result:** a founder friend can run a warm local sandbox with one command and get a usable interactive shell quickly.

### Milestone 4 — Make the sandbox artifact reusable outside the laptop
Extend the current tarball-centric release flow so the same versioned payload can become a sandbox image and be reused locally or remotely. This milestone should add:
- a deterministic Docker build path from the shipped bundle or checked-out repo,
- versioned image tagging tied to `package.json` / release tags,
- release workflow support for publishing the image (likely GHCR) alongside the tarball,
- bundle metadata or runtime helpers so `guy sandbox start` knows which image/tag belongs to the installed release.

The artifact story must avoid a split-brain product where native and sandboxed The Guy behave like different distributions.

**Result:** the same release can be installed natively or launched as a sandbox image.

### Milestone 5 — Add remote Docker-host execution and the Paperclip handoff seam
Once the local Docker driver works, add a remote mode that executes the same sandbox flow on a host reachable over SSH. This is not yet a full Paperclip control plane; it is the narrow substrate Paperclip can later call into. The remote slice should:
- reuse the same image contract from Milestone 4,
- execute Docker commands remotely over SSH without inventing a second packaging model,
- keep human interactive shell access available through a direct command (`guy sandbox shell --remote ...`),
- provide a non-interactive `exec` mode that can return structured exit status and metadata for automation,
- define what minimal remote prerequisites are required (Docker + SSH + access to the published image or a staging path).

**Result:** The Guy can point at a remote host and create a sandbox there without introducing a separate hosted runtime product.

### Milestone 6 — Validation, docs, and the compaction / handoff loop
Finish by proving the whole path, documenting it, and making the work survivable across sessions. This milestone includes:
- unit tests for state, capability parsing, and command construction,
- local Docker smoke tests gated by environment detection,
- bundle smoke tests that validate sandbox image / bundle compatibility,
- release workflow validation for OCI publish + tarball publish,
- README / docs updates for native vs sandbox usage,
- explicit implementation-loop instructions for updating this plan, session todo files, and git commits before compaction.

**Result:** the feature is documented, validated, releasable, and resumable.

## Compaction / Handoff Loop

This section is part of the plan on purpose. The feature is large enough that it will span multiple execution sessions, and the implementation must keep itself alive.

### Operating cadence
1. Start each work session by reading:
   - `/Users/minzi/Developer/the-guy/docs/exec-plans/active/the-guy-dual-runtime-native-and-sandbox.md`
   - `/Users/minzi/Developer/.pi/todos.md`
   - `/Users/minzi/Developer/.pi/todos/79dd4cb4-0faa-4564-8926-897b436c5185.md`
   - `git -C /Users/minzi/Developer/the-guy status --short --branch`
2. Work only the next unchecked Progress item unless a discovered blocker forces a Decision Log update.
3. After every meaningful milestone chunk:
   - update this plan,
   - update the session todo file,
   - run the relevant validation command,
   - commit the plan/code together on `feat/dual-runtime-sandbox`.

### When to compact
Compact aggressively instead of “later”. Use `self_compact` when **any** of the following becomes true:
- context usage is above roughly **60%** and the next task is not obviously tiny,
- more than one milestone chunk has been completed without a written handoff,
- the next task will require broad file reads across multiple packages or workflows,
- the branch has uncommitted changes and the current reasoning is no longer easy to restate from memory,
- a test failure or design surprise would be painful to rediscover from scratch.

### What the handoff must contain
Every compaction handoff must capture:
- active branch name,
- exact next Progress item to execute,
- files modified in the current chunk,
- tests run and their status,
- Docker/image/remote prerequisites discovered so far,
- unresolved risks or tradeoffs,
- whether there are staged/unstaged changes,
- and whether the next step is code, docs, tests, or git cleanup.

### Git hygiene during the loop
- Never let this work continue on `main`.
- Keep commits small and milestone-oriented.
- Update the plan before or in the same commit as the implementation chunk it describes.
- If a future session branches again or stacks on top of this branch, record that decision in this plan’s Decision Log immediately.

## Concrete Steps

1. Read these files before changing the contract:
   - `/Users/minzi/Developer/the-guy/docs/PLANS.md`
   - `/Users/minzi/Developer/the-guy/README.md`
   - `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`
   - `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-003-pack-owned-pi-payloads-and-overrides.md`
   - `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
   - `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`
   - `/Users/minzi/Developer/the-guy/.github/workflows/release.yml`
2. Write or update the architecture doc that freezes:
   - Docker-first v0 backend,
   - driver abstraction,
   - capability model,
   - deferred OpenShell/macOS guest work,
   - Paperclip-compatible `exec` surface.
3. Add sandbox types/package boundaries, likely centered on:
   - `/Users/minzi/Developer/the-guy/packages/guy-sandbox/`
   - `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
4. Implement local Docker lifecycle commands:
   - start / ensure image
   - inspect / status
   - interactive shell attach
   - non-interactive exec
   - stop / cleanup
   - doctor diagnostics
5. Extend release plumbing so tagged releases can also produce and publish a sandbox image.
6. Implement remote SSH + Docker host support against the same image contract.
7. Add or extend tests in:
   - `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.test.ts`
   - `/Users/minzi/Developer/the-guy/apps/guy-installer/src/install-script.test.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.test.ts`
   - new tests under `/Users/minzi/Developer/the-guy/packages/guy-sandbox/src/`
8. Run validation from `/Users/minzi/Developer/the-guy`:
   - `pnpm test`
   - `pnpm release:bundle`
   - local Docker smoke commands against `guy sandbox ...`
   - remote smoke commands only after the OCI image path exists
9. After each milestone chunk, update this plan, update `/Users/minzi/Developer/.pi/todos/79dd4cb4-0faa-4564-8926-897b436c5185.md`, and commit.

## Validation and Acceptance

### Product acceptance
- `guy install` still works for the native envelope without regression.
- A user can run a local isolated sandbox with one command and reattach to it quickly.
- A user can point the sandbox flow at a remote Docker host over SSH using the same release version.
- The sandbox flow makes the granted workspace / mount / provider choices explicit.
- The non-interactive execution path is clear enough that Paperclip could later call it without having to understand Docker internals.

### Technical acceptance
- A dedicated sandbox package exists and owns the driver abstraction instead of burying sandbox logic inside unrelated install code.
- The Docker v0 backend is implemented through safe process spawning with argv arrays, not shell-string interpolation.
- Release artifacts can be turned into or associated with a versioned sandbox image.
- The release workflow can publish the tarball and the sandbox image from the same tagged release.
- `pnpm test` passes.
- `pnpm release:bundle` passes.
- Local sandbox smoke tests pass on macOS Apple Silicon with Docker Desktop running.

### Deferred-work acceptance
- The code and docs make it obvious that OpenShell and macOS guest modes are deferred backends, not rejected ideas.
- The shared capability model and driver abstraction make it possible to add those backends later without redesigning the user-facing command surface.

## Idempotence and Recovery

- Writing the architecture doc and this exec plan is low risk and fully retryable.
- The Docker image/tag generation must be deterministic. Re-running the build for the same checkout or release should overwrite or reuse the same local tag cleanly.
- Sandbox start must not mutate native host state outside The Guy’s declared directories and explicit user mounts.
- If local sandbox bootstrap fails partway through, `guy sandbox doctor` and `guy sandbox stop --force` must provide a clean way back to a known-good state.
- Remote SSH + Docker commands must be written so a partially created container can be inspected and removed deterministically.
- The native envelope remains the fallback recovery path. If the sandbox driver becomes unusable during development, `guy install`, `guy doctor`, and `guy repair` must still function unchanged.
- If context degrades mid-implementation, the recovery path is: update plan → update session todo → commit current safe state → `self_compact` with the next unchecked Progress item.
