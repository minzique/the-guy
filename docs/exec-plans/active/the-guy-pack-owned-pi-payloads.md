# The Guy pack-owned Pi payloads and overrides

## Purpose / Big Picture

Define and land the next packaging phase for **The Guy** so the product can keep a single clean monorepo, ship Pi payloads as a first-class bundle, and support end-user customization without turning `~/.pi/**` into an unmanageable drift zone.

After this plan, you should be able to point at one clear contract:
- The Guy runtime owns install, repair, doctor, state, and bundle assembly.
- A dedicated Pi pack owns the shipped Pi payload files and compatibility metadata.
- Users customize through a Guy-owned override tree, not by editing rendered output in place.
- The rendered `~/.pi/**` tree is disposable output that Guy can regenerate deterministically.

This plan starts with architecture freeze and docs, then moves into pack extraction and runtime changes.

## Progress

- [x] (2026-04-13 14:54Z) Write a clean exec plan and freeze the problem statement for pack-owned Pi payloads
- [x] (2026-04-13 14:54Z) Write RFC-003 for `guy-pi-pack`, override layering, compatibility, and publish/sync rules
- [x] (2026-04-13 14:54Z) Generate an HTML review doc that explains the RFC visually for human review
- [ ] Add pack manifest/types/schema support in `packages/guy-profile-schema`
- [ ] Introduce `packages/guy-pi-pack/` with the current Pi payload slice moved out of `profiles/power-user/assets/`
- [ ] Refactor `packages/guy-core` to render pack defaults + user overrides into disposable `~/.pi/**` output with a per-asset ledger
- [ ] Update `guy-doctor`, `guy repair`, and release bundling for the new contract
- [ ] Run regression tests and a fuller dogfood smoke flow against the pack-first artifact

## Surprises & Discoveries

- The current runtime is already farther along than the older v0.1 dogfood plan text suggests. The repo has working TS packages, tests, and a release bundle, but the plan file still describes parts of the repo as scaffold-only.
- `profiles/power-user/assets.json` currently owns concrete Pi payload files directly. That is good enough for v0.1, but it is the wrong long-term boundary for reusable or publishable Pi payloads.
- The current release bundle copies the entire `profiles/` tree plus built workspace packages. That means a future pack package must either be copied into the artifact explicitly or resolved through a runtime-friendly path inside the bundle.
- `packages/guy-core/src/index.ts` currently resolves assets from `profiles/<id>/assets.json`, copies them straight into home-directory targets, and writes only a minimal rendered metadata file. That is not enough to reason about override ownership or drift.
- Parallel subagent review converged on the same conclusion: the repo split should wait, `~/.pi/**` must be disposable render output, and profiles must not grow into a dependency solver.
- A final RFC review found no critical issues; only three clarifications were needed: the ledger must record the winning source per asset id, override discovery should mirror destination paths under the override tree, and `assetManifest` cannot remain permanently required in the schema.

## Decision Log

- Keep one repo: `/Users/minzi/Developer/the-guy` remains the only repo for now.
- Introduce a dedicated workspace package, likely `packages/guy-pi-pack/`, instead of splitting into a separate repo.
- Treat `~/.pi/**` as disposable render output, not as a source of truth.
- Supported customization path will be a Guy-owned override tree under `~/.guy/overrides/<pack-id>/...`.
- Profiles stay simple presets. They should reference one primary Pi pack, not become a dependency solver.
- External npm publishing is a later capability, not a requirement for phase one of this packaging work.
- RFC-003 and the review HTML are the architecture freeze for this phase; implementation should now follow the documented contract instead of ad-hoc pack extraction.

## Outcomes & Retrospective

(fill when complete)

## Context and Orientation

### Repo and branch
- Product repo: `/Users/minzi/Developer/the-guy`
- Current branch: `docs/rfc-bootstrap`
- Important git note: the repo currently has no initial commit, so `git status` shows the whole tree as untracked. Use the filesystem as truth.

### Existing runtime/design files
- Product RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- Installer/profile RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`
- Existing v0.1 plan: `/Users/minzi/Developer/the-guy/docs/exec-plans/active/the-guy-v0-1-dogfood.md`
- Plans format: `/Users/minzi/Developer/the-guy/docs/PLANS.md`

### Current code paths that define the present contract
- Profile schema/types: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
- Profile schema JSON: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/schema/profile.schema.json`
- Asset schema JSON: `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/schema/assets.schema.json`
- Install/render logic: `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
- Doctor logic: `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.ts`
- CLI: `/Users/minzi/Developer/the-guy/apps/guy-installer/src/cli.ts`
- Release bundle script: `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`

### Current profile asset layout
- Base profile manifest: `/Users/minzi/Developer/the-guy/profiles/base/profile.json`
- Base asset manifest: `/Users/minzi/Developer/the-guy/profiles/base/assets.json`
- Power-user profile manifest: `/Users/minzi/Developer/the-guy/profiles/power-user/profile.json`
- Power-user asset manifest: `/Users/minzi/Developer/the-guy/profiles/power-user/assets.json`
- Current shipped Pi payload files:
  - `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/settings.json`
  - `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/agents/*.md`
  - `/Users/minzi/Developer/the-guy/profiles/power-user/assets/.pi/agent/prompts/*.md`

### Terms used in this plan
- **Runtime**: The Guy commands and state management logic (`install`, `repair`, `doctor`, bundle assembly, state files).
- **Pack**: A versioned payload package that owns shipped Pi files plus compatibility metadata.
- **Override tree**: A Guy-owned directory where user-customized files live and intentionally replace pack defaults.
- **Rendered output**: The final files copied into `~/.pi/**` for Pi to read. This output is disposable and can be regenerated.
- **Per-asset ledger**: A metadata file written by Guy that records asset ownership and hashes per asset id, not just per directory.

## Plan of Work

### Milestone 1 — Freeze the architecture in writing
Write RFC-003 for the pack-owned payload model. The RFC must make the hard rules explicit:
- one repo now, not a repo split
- one primary Pi pack per profile in v1
- `~/.pi/**` is disposable render output
- direct edits there are unsupported and may be overwritten
- supported customization lives under `~/.guy/overrides/<pack-id>/...`
- packs declare runtime compatibility
- profiles stop being the long-term home of raw Pi payload files

Then generate a self-contained HTML review doc so Minzi can review the design quickly.

**Result:** the architecture is frozen before code churn starts.

### Milestone 2 — Add schema and package boundaries
Extend `packages/guy-profile-schema/` with pack manifest types and schema. Add a new `packages/guy-pi-pack/` workspace package that contains the current Pi payload slice and a `pack.json` manifest.

Keep the current `assetManifest` field as a compatibility shim during migration so the runtime can still load the existing profile-owned asset layout until the pack-first path is proven.

**Result:** the repo has an explicit pack boundary instead of profile-owned raw assets only.

### Milestone 3 — Refactor install/render logic
Refactor `packages/guy-core/src/index.ts` so install/repair become pack-first:
1. resolve the selected profile
2. resolve the referenced Pi pack
3. validate pack/runtime compatibility
4. stage or locate immutable pack content under Guy-managed state
5. overlay supported user overrides from `~/.guy/overrides/<pack-id>/...`
6. render final files into `~/.pi/**`
7. write a per-asset ledger with asset id, pack id, pack version, source layer, destination path, and content hash

**Result:** repair and drift handling use explicit ownership instead of guessing from file existence.

### Milestone 4 — Update doctor, repair, and bundle assembly
Teach `guy-doctor` and `guy repair` to validate against the new per-asset ledger and compatibility rules. Update the release bundle so the tarball contains everything needed for pack-first resolution without a repo checkout.

**Result:** the bundle proves the architecture works in a real artifact, not just in the source tree.

### Milestone 5 — Dogfood and retire the legacy path
Add regression coverage for pack compatibility, legacy fallback, override precedence, and rendered drift repair. Then run a fuller end-to-end smoke flow from the built artifact.

Once the pack-first path is proven, stop using profile-owned raw Pi assets as the live runtime source.

**Result:** The Guy has a clean next-phase packaging model that is shippable and maintainable.

## Concrete Steps

1. Read these files before changing the contract:
   - `/Users/minzi/Developer/the-guy/docs/PLANS.md`
   - `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`
   - `/Users/minzi/Developer/the-guy/packages/guy-profile-schema/src/index.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-core/src/index.ts`
   - `/Users/minzi/Developer/the-guy/packages/guy-doctor/src/index.ts`
   - `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`
2. Write `RFC-003` under `/Users/minzi/Developer/the-guy/docs/rfcs/`.
3. Write the HTML review doc under `~/.agent/diagrams/`.
4. Add pack manifest schema/types and the new `packages/guy-pi-pack/` package.
5. Refactor runtime install/repair/doctor flow to use packs + overrides + per-asset ledger.
6. Update bundle assembly and tests.
7. Run from repo root:
   - `pnpm test`
   - `pnpm release:bundle`
8. Smoke-test the tarball in a temp directory with a temp home and confirm:
   - install succeeds
   - rendered Pi files appear
   - override precedence works
   - repair overwrites unsupported rendered drift but preserves supported overrides

## Validation and Acceptance

### Architecture acceptance
- RFC-003 clearly explains why one repo + a dedicated Pi pack is the right next step.
- The RFC states the hard rules for overrides, rendered output, compatibility, and profile simplicity.
- The HTML review doc presents the same design in a fast-to-review visual format.

### Implementation acceptance
- `packages/guy-pi-pack/` exists with pack metadata and the current Pi payload slice.
- `profiles/power-user/profile.json` can reference the Pi pack without requiring profile-owned raw Pi assets as the primary source.
- `guy install` and `guy repair` render from pack defaults + overrides, not from profile-local asset files only.
- `guy doctor` validates against a per-asset ledger and pack compatibility.
- `pnpm test` passes.
- `pnpm release:bundle` passes.
- The tarball can install and repair without access to the source repo checkout.

## Idempotence and Recovery

- Creating RFC-003 and the HTML review doc is low risk and fully retryable.
- During migration, keep the legacy `assetManifest` path available until pack-first tests pass. Do not remove the old path and the new path in one jump.
- If pack resolution fails, `guy install` and `guy repair` must fail before mutating managed state to “healthy.”
- The rendered `~/.pi/**` tree is disposable. Recovery should always be possible by re-rendering from pack defaults plus supported overrides.
- The per-asset ledger must be authoritative enough that `guy repair` can restore missing managed files or overwrite unsupported drift without guessing.
