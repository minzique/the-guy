# RFC-003: Pack-Owned Pi Payloads, Override Layering, and Publish/Sync Rules

| Field | Value |
|-------|-------|
| **Author** | Minzi |
| **Status** | Draft |
| **Created** | 2026-04-13 |
| **Last Updated** | 2026-04-13 |
| **Scope** | Next The Guy packaging phase after v0.1 dogfood |
| **Supersedes** | None |
| **Related** | `docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`, `docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md` |

## Abstract

This RFC defines the next packaging boundary for **The Guy**. The current v0.1 runtime already ships a working profile, asset manifests, install logic, doctor checks, and a local release bundle. The problem is that Pi payload files still live directly under `profiles/<id>/assets/`, which is a good bootstrap shape and a bad long-term architecture.

The core decision is: **keep one `the-guy` monorepo, add a first-class `packages/guy-pi-pack/`, and treat `~/.pi/**` as disposable render output generated from pack defaults plus explicit user overrides.** Profiles remain simple presets. They stop being the long-term home of raw Pi payload files.

**Current execution note (2026-04-18):** the expanded payload now being copied into `profiles/power-user/assets/` is a temporary mirror for the founder weekend build. It must not become the authoring source of truth. Keep the canonical payload upstream on a dedicated dev branch until the pack-owned manifest flow replaces this stopgap.

This RFC makes six hard rules explicit:

1. `the-guy` stays the only repo for now.
2. `packages/guy-pi-pack/` becomes the authoritative home of shipped Pi payloads.
3. `~/.pi/**` is disposable render output, not a source of truth.
4. Supported customization lives in `~/.guy/overrides/<pack-id>/...`.
5. Packs declare runtime compatibility and asset ownership per asset id.
6. External npm publishing is deferred until the internal boundary proves clean.

## Motivation

`RFC-002` intentionally optimized for a narrow dogfood slice. That worked. The Guy now has a real runtime contract, a working `power-user` profile, a release bundle, and install/repair/doctor flows.

The current asset model does not scale cleanly.

Today:
- `packages/guy-core/src/index.ts` loads `profiles/<id>/profile.json`
- it reads `assetManifest` from `profiles/<id>/assets.json`
- it copies profile-local files straight into `~/.pi/**`
- it writes a minimal rendered metadata file under `~/.guy/rendered/<profile-id>/assets.json`

That is fine for a first slice. It becomes messy as soon as you want any of these:
- a Pi payload that is independently publishable or reusable
- explicit pack/runtime compatibility
- user overrides that survive repair/update
- clean ownership when a file disappears or changes upstream
- future profile reuse without copying the same Pi payload across multiple profiles

If The Guy keeps raw Pi payload files living only under profiles, it will blur three separate responsibilities:
- runtime logic
- shipped payload content
- user customization

That blur is how drift systems happen.

## Goals and Non-Goals

**Goals**
- Keep a single clean repo: `/Users/minzi/Developer/the-guy`.
- Introduce an explicit Pi payload boundary with `packages/guy-pi-pack/`.
- Keep The Guy as the product/runtime boundary for install, repair, doctor, state, and release bundling.
- Make supported end-user customization explicit and durable.
- Make rendered `~/.pi/**` output reproducible from pack defaults plus supported overrides.
- Track ownership per asset id so repair and drift handling are deterministic.
- Add explicit pack/runtime compatibility fields.
- Preserve a migration path from the current profile-owned `assets.json` model.
- Keep the first implementation scope narrow enough to dogfood locally before widening the shipped asset set.

**Non-Goals**
- Splitting The Guy into separate runtime and payload repos now.
- Building a general package manager or dependency solver inside profiles.
- Supporting arbitrary multiple Pi packs per profile in v1 of this packaging phase.
- Supporting directory-level or semantic/patch-style overrides.
- Live-syncing user machines to repo `HEAD`.
- Requiring npm publication before the internal package boundary is usable.
- Solving update channels, rollback, or remote pack fetching in the same change.

## Current State

### Repo structure that matters today

```text
/Users/minzi/Developer/the-guy/
  apps/guy-installer/src/cli.ts
  packages/
    guy-core/src/index.ts
    guy-doctor/src/index.ts
    guy-profile-schema/src/index.ts
  profiles/
    base/
      profile.json
      assets.json
    power-user/
      profile.json
      assets.json
      assets/.pi/agent/settings.json
      assets/.pi/agent/agents/*.md
      assets/.pi/agent/prompts/*.md
  scripts/build-release-bundle.mjs
```

### What the runtime does today

- `profiles/base/assets.json` is empty.
- `profiles/power-user/assets.json` currently declares 11 copy-managed Pi assets.
- `packages/guy-core/src/index.ts` resolves assets from the profile chain and copies them directly into target destinations such as `~/.pi/agent/settings.json` and `~/.pi/agent/agents/*.md`.
- The runtime computes a single `managedAssetHash` from bundled sources and stores it in `~/.guy/state/install.json`.
- The runtime writes rendered metadata to `~/.guy/rendered/<profile-id>/assets.json`, but that file only records basic source and destination paths. It does not record per-asset source layer, pack identity, or content hashes.
- `packages/guy-doctor/src/index.ts` verifies managed assets mostly by checking that the rendered metadata file exists and that the listed destination paths still exist.
- `scripts/build-release-bundle.mjs` copies the built app/packages plus the entire `profiles/` tree into the tarball artifact.

### What is missing

The current model cannot answer these questions cleanly:
- Which layer owns a given rendered file?
- Did the user intentionally override a file, or did they just edit the rendered output directly?
- If an upstream asset disappears in the next version, should repair delete the rendered file or keep it?
- Which runtime versions are compatible with which Pi payload versions?
- How do you make the Pi payload independently publishable without turning profiles into the payload source of truth?

## Approaches

### Approach A — Keep profile-owned raw assets as the permanent model

Profiles continue to own concrete Pi assets directly in `profiles/<id>/assets/`.

**Pros**
- smallest short-term change
- keeps the current runtime intact
- no new package boundary yet

**Cons**
- profiles become the wrong abstraction for reusable payloads
- compatibility and ownership stay implicit
- user override handling becomes bolted-on instead of designed-in
- future publication still requires another extraction later
- encourages copy-paste asset sets across profiles

### Approach B — Split runtime and Pi payload into separate repos now

Create a dedicated Pi payload repo/package and keep The Guy as only the runtime repo.

**Pros**
- clean publish boundary on paper
- strong separation of concerns
- independent repo release cadence possible

**Cons**
- adds split-brain release logic immediately
- forces repo coordination before the boundary is proven
- makes dogfooding slower and more annoying
- solves publication early and actual usability later

### Approach C — Keep one repo and add a first-class Pi pack package **(recommended)**

Keep `the-guy` as the monorepo. Add `packages/guy-pi-pack/` as the authoritative home of the Pi payload. Profiles reference one primary Pi pack. Runtime renders pack defaults plus explicit user overrides into disposable `~/.pi/**` output.

**Pros**
- preserves one clean repo
- keeps The Guy as the runtime/product boundary
- creates an internal package boundary before external publication pressure
- supports explicit compatibility and ownership
- gives users a supported override path without making rendered output canonical
- lets future npm publication be a packaging decision, not an architecture prerequisite

**Cons**
- requires a migration path from current profile-owned assets
- adds a new schema and runtime layer now
- forces hard decisions about unsupported direct edits and override rules

### Recommendation

Choose **Approach C**.

It keeps the good part of `agent-stuff`—a clean publishable payload boundary—without collapsing The Guy into “just a Pi package” or introducing a second repo too early.

## Detailed Design

### Hard rules

These are not soft guidelines. They are the contract.

1. **`~/.pi/**` is disposable render output.**
   - The Guy may overwrite it during install or repair.
   - The runtime does not treat rendered output as source of truth.
2. **Direct edits in `~/.pi/**` are unsupported.**
   - Users may do it, but `guy repair` may overwrite those edits.
   - Supported customization path is the override tree.
3. **Ownership is tracked per asset id, not per directory.**
   - Repair and drift handling reason about asset ids.
4. **Profiles are presets, not package managers.**
   - In v1 of this packaging phase, a profile references one primary Pi pack.
   - No dependency solver.
5. **Packs declare runtime compatibility.**
   - The runtime must reject incompatible packs before rendering.
6. **External publishing is deferred.**
   - The internal package boundary comes first.

### Proposed repo shape

```text
/Users/minzi/Developer/the-guy/
  apps/
    guy-installer/
  packages/
    guy-core/
    guy-doctor/
    guy-profile-schema/
    guy-pi-pack/
      package.json
      src/index.ts
      pack.json
      assets/.pi/agent/settings.json
      assets/.pi/agent/agents/*.md
      assets/.pi/agent/prompts/*.md
  profiles/
    base/
      profile.json
      assets.json                 # deprecated migration fallback
    power-user/
      profile.json
      assets.json                 # deprecated migration fallback
```

### Responsibility split

| Layer | Owns | Must not own |
|------|------|--------------|
| **The Guy runtime** | install, repair, doctor, state, compatibility checks, bundle assembly, render pipeline | long-term authored Pi payload files |
| **Pi pack** | shipped Pi payload files, asset ids, pack version, compatibility metadata | runtime install state, health logic |
| **Profile** | user-facing preset choice, supported tools, doctor scope, one primary pack reference | long-term raw Pi payload files, dependency resolution graphs |
| **Override tree** | intentional user customization | runtime-generated output or pack defaults |
| **Rendered `~/.pi/**`** | disposable final output for Pi to read | canonical user intent |

### Filesystem layout

#### Pack source in the repo

```text
packages/guy-pi-pack/
  pack.json
  assets/.pi/agent/settings.json
  assets/.pi/agent/agents/scout.md
  assets/.pi/agent/agents/planner.md
  assets/.pi/agent/agents/reviewer.md
  assets/.pi/agent/agents/reviewer-max.md
  assets/.pi/agent/agents/worker.md
  assets/.pi/agent/prompts/feature.md
  assets/.pi/agent/prompts/scout-and-plan.md
  assets/.pi/agent/prompts/implement.md
  assets/.pi/agent/prompts/implement-and-review.md
  assets/.pi/agent/prompts/worktree.md
```

#### Guy-managed runtime layout

```text
~/.guy/
  state/
    install.json
  packs/
    pi-pack/
      0.1.0/
        pack.json
        assets/.pi/...
  overrides/
    pi-pack/
      .pi/agent/AGENTS.md
      .pi/agent/agents/reviewer.md
  rendered/
    power-user/
      assets.json
  logs/
    doctor.log
```

Notes:
- `~/.guy/packs/<pack-id>/<version>/` is the staged immutable source used for rendering and repair.
- `~/.guy/overrides/<pack-id>/...` is the supported user-editable layer.
- `~/.guy/rendered/<profile-id>/assets.json` remains the rendered metadata path, but it becomes a **real per-asset ledger**.
- Cleanup of old staged pack versions is deferred to the future update/rollback RFC. Phase one may retain older staged versions rather than guessing a deletion policy.

### Proposed schema changes

#### New pack manifest

Add `packages/guy-profile-schema/schema/pack.schema.json` and matching TypeScript types.

Proposed top-level shape:

```json
{
  "version": "0.1",
  "id": "pi-pack",
  "displayName": "The Guy Pi Pack",
  "packageName": "@the-guy/pi-pack",
  "packVersion": "0.1.0",
  "minimumRuntimeVersion": "0.1.0",
  "maximumTestedRuntimeVersion": "0.1.x",
  "assets": [
    {
      "id": "pi-settings",
      "source": "./assets/.pi/agent/settings.json",
      "destination": "~/.pi/agent/settings.json",
      "strategy": "copy",
      "required": true
    }
  ]
}
```

Required fields:
- `id`
- `packVersion`
- `minimumRuntimeVersion`
- `assets[]`

Optional but recommended:
- `packageName`
- `displayName`
- `maximumTestedRuntimeVersion`

#### Profile manifest change

Add a single primary Pi pack reference to `GuyProfileManifest`.

Proposed shape:

```json
{
  "id": "power-user",
  "piPack": {
    "id": "pi-pack",
    "version": "0.1.0"
  },
  "assetManifest": "./assets.json"
}
```

Rules:
- `piPack` is the long-term source.
- `assetManifest` stays only as a deprecated migration fallback.
- During migration, the profile schema and TypeScript types must allow `piPack`, `assetManifest`, or both. `assetManifest` can no longer stay a permanently required field.
- The runtime prefers `piPack` when present.

#### Render ledger shape

Expand `~/.guy/rendered/<profile-id>/assets.json` to record per-asset ownership.

Proposed shape:

```json
{
  "generatedAt": "2026-04-13T00:00:00.000Z",
  "profileId": "power-user",
  "packId": "pi-pack",
  "packVersion": "0.1.0",
  "assets": [
    {
      "assetId": "reviewer-agent",
      "destinationPath": "/Users/minzi/.pi/agent/agents/reviewer.md",
      "sourceLayer": "override",
      "packSourcePath": "/Users/minzi/.guy/packs/pi-pack/0.1.0/assets/.pi/agent/agents/reviewer.md",
      "overridePath": "/Users/minzi/.guy/overrides/pi-pack/.pi/agent/agents/reviewer.md",
      "contentHash": "...",
      "required": true
    }
  ]
}
```

The ledger records the **winning rendered source for each asset id**, not multiple competing entries. If an override wins, the entry records `sourceLayer: "override"` plus the matched pack source and override path. If no override exists, the same asset id is recorded once with `sourceLayer: "pack"`.

The exact JSON shape can be tightened during implementation. The important requirement is not the property names. The requirement is that repair and doctor can answer ownership questions without guessing.

### Install and repair flow

#### Current flow

```text
profile.json
  -> assets.json
  -> profile-local files
  -> copy into ~/.pi/**
  -> write minimal rendered metadata
```

#### Proposed flow

```text
profile.json
  -> piPack ref
  -> bundled pack.json
  -> compatibility check
  -> stage immutable pack under ~/.guy/packs/<id>/<version>/
  -> overlay ~/.guy/overrides/<id>/...
  -> render final files into ~/.pi/**
  -> write per-asset ledger under ~/.guy/rendered/<profile-id>/assets.json
  -> update install state
```

Detailed rules:
1. `guy install` resolves the selected profile.
2. The runtime resolves the referenced pack from the bundle/workspace artifact.
3. The runtime validates `minimumRuntimeVersion` and optionally `maximumTestedRuntimeVersion`.
4. The runtime stages pack content under `~/.guy/packs/<pack-id>/<version>/`.
5. For each declared asset id, the runtime derives the override candidate path by mirroring the asset destination relative to home under `~/.guy/overrides/<pack-id>/`. Example: destination `~/.pi/agent/agents/reviewer.md` maps to override candidate `~/.guy/overrides/pi-pack/.pi/agent/agents/reviewer.md`.
6. If an override exists, that file wins.
7. The runtime renders the chosen file into the destination path under `~/.pi/**`.
8. The runtime writes or updates the per-asset ledger.
9. `guy repair` repeats the same render process from staged pack content plus overrides only.

### Override model

#### Supported customization path

The supported path is file-level replacement inside the override tree.

Example:

```text
~/.guy/overrides/pi-pack/.pi/agent/agents/reviewer.md
~/.guy/overrides/pi-pack/.pi/agent/prompts/implement.md
~/.guy/overrides/pi-pack/.pi/agent/AGENTS.md
```

Rules:
- one override file replaces one shipped asset
- no directory-level ownership inference
- no three-way merge in v1
- no patch format in v1

Future helper commands can make this nicer:
- `guy override path pi-pack reviewer-agent`
- `guy override diff`
- `guy override reset pi-pack reviewer-agent`

Those commands are useful, but they are not required to establish the filesystem contract.

#### Unsupported path

Direct edits in rendered destinations such as `~/.pi/agent/agents/reviewer.md` are unsupported. The Guy may overwrite them during install or repair.

That is deliberate. It keeps the supported customization path explicit and testable.

### Compatibility model

Each pack declares runtime compatibility.

Minimum required rules:
- If `runtime.version < minimumRuntimeVersion`, install and repair fail.
- If `maximumTestedRuntimeVersion` exists and `runtime.version` is newer, the runtime may warn or fail based on policy. For this phase, warning is acceptable.
- The runtime never silently renders an incompatible pack.

This prevents split truth when runtime and pack evolve at different speeds.

### Publish and sync model

#### What changes on user machines

User machines change through The Guy commands, not through repo synchronization.

Examples:
- `guy install`
- `guy repair`
- future `guy update`

They do **not** stay live-synced to:
- repo `HEAD`
- a `dotfiles-agents` checkout
- symlinked authoring files

#### What “publishable” means in this RFC

In this phase, publishable means:
- the Pi payload has a first-class package boundary
- it can be bundled into The Guy artifacts deterministically
- it has explicit metadata and compatibility
- it could be published later without re-architecting the runtime

It does **not** mean npm publication must happen now.

### Release bundle changes

`/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs` currently copies built workspace packages and the entire `profiles/` tree into the tarball. After this RFC:
- the bundle must also contain the built `guy-pi-pack` package
- the bundle must contain raw pack assets and `pack.json`
- the bundle script must treat `guy-pi-pack` as an explicit special case, because copying only `dist/` is not enough for raw payload assets
- the tarball must be able to resolve the pack without access to the source repo checkout

If the tarball cannot install or repair from bundled pack content alone, the design failed.

## Migration Plan

### Phase A — Freeze the contract
- Write this RFC.
- Add `pack.schema.json`, `GuyPackManifest`, and a `piPack` profile field.
- Update `GuyProfileManifest` and `profile.schema.json` so `assetManifest` is no longer an always-required field during migration.
- Keep `assetManifest` as deprecated fallback.

### Phase B — Extract the current Pi payload unchanged
- Create `packages/guy-pi-pack/`.
- Move the current `profiles/power-user/assets/.pi/**` slice into `packages/guy-pi-pack/assets/.pi/**` unchanged first.
- Add `pack.json` with explicit asset ids and compatibility metadata.

### Phase C — Make the runtime pack-first
- Update `packages/guy-core/src/index.ts` to prefer `piPack` over `assetManifest`.
- Stage pack content under `~/.guy/packs/<id>/<version>/`.
- Add override layering and the per-asset ledger.
- Update `guy-doctor` to validate ownership and rendered drift against the ledger.

### Phase D — Retire profile-owned raw assets from the live path
- Switch `profiles/power-user/profile.json` to the new pack reference.
- Keep the legacy `assetManifest` path only as a temporary fallback during migration.
- Remove profile-owned raw Pi assets from the live runtime path after tests and smoke flows prove the new boundary.
- Leave `profiles/guided/` alone until it becomes a real shipping profile; do not widen migration scope just because the directory exists.

### Phase E — Widen the curated asset set separately
- Expand `base` and `power-user` shipped content only after the new boundary works.
- Safe candidates include a neutral `~/.pi/agent/AGENTS.md` and other runtime-safe Pi files.

Do not widen the asset set during the same change that introduces the pack boundary unless there is a concrete reason. That is scope creep.

## Risks and Mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Half-migrated runtime path | Two sources of truth create subtle drift bugs | Keep a strict legacy fallback until pack-first tests pass, then cut over cleanly |
| Asset id churn | Repair and ownership depend on stable asset ids | Treat asset ids as part of the contract; avoid casual renames |
| Users edit rendered output directly | `guy repair` will overwrite changes and feel hostile unless the contract is explicit | Document direct rendered edits as unsupported; give users an override tree instead |
| Profiles grow into mini package managers | Complexity explodes fast | Keep one primary Pi pack per profile in v1 |
| Pack publication becomes a distraction | Can delay useful dogfood work | Keep external publish as deferred follow-up |
| Bundle path fakes success in source checkout only | Artifact will break off-repo | Require tarball smoke tests that resolve pack assets from the artifact alone |

## Operational Acceptance

This RFC is successful when the implementation can prove all of these:
- `packages/guy-pi-pack/` exists and owns the shipped Pi payload.
- `profiles/power-user/profile.json` references the pack.
- `guy install` and `guy repair` render from staged pack content plus supported overrides.
- `~/.pi/**` is treated as disposable output.
- `guy-doctor` can validate rendered assets from per-asset ledger data, not just “file exists.”
- `pnpm test` passes.
- `pnpm release:bundle` passes.
- The tarball can install and repair without a source checkout.

## Open Questions

None are truly blocking for this RFC. Default choices are good enough.

The only low-stakes follow-ups:
1. Should the pack package name ship as `@the-guy/pi-pack` or something slightly broader later?
2. Should a neutral shipped `AGENTS.md` land in the first asset-set expansion or the second?
3. Should future override helper commands be part of the next implementation slice or wait until after pack-first rendering is stable?

## Final Recommendation

Do the boring, correct thing.

Keep one repo. Add `packages/guy-pi-pack/`. Make pack defaults, user overrides, and rendered output three separate layers. Keep profiles simple. Make compatibility explicit. Defer npm publication until the internal boundary is solid.

That gives The Guy a packaging model that is clean enough to ship, simple enough to dogfood, and strict enough not to rot immediately.
