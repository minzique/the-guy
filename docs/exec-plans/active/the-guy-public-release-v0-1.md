# The Guy public release v0.1

## Purpose / Big Picture

Publish The Guy as a real upstream project with a real tagged release that founder friends can install from GitHub without needing a local repo checkout or a manually pasted bundle URL.

After this plan lands, you should be able to point someone at one install command, rely on a public GitHub release asset, and trust that the repo is clean enough for public exposure. Tagging a release should also create usable release notes automatically instead of requiring manual GitHub release editing every time.

## Progress

- [ ] Audit the repo for public-release safety and remove obvious sensitive or personal leakage
- [ ] Tighten the release/install flow so a real public GitHub release works end to end
- [ ] Add automatic changelog or release-note generation suitable for a tag-driven release flow
- [ ] Create the upstream repo and publish the first tagged release
- [ ] Verify the public install command against the real GitHub release asset

## Surprises & Discoveries

- (none yet)

## Decision Log

- (none yet)

## Outcomes & Retrospective

- (fill when complete)

## Context and Orientation

### Repo and publishing surface

- Product repo: `/Users/minzi/Developer/the-guy`
- Installer shim: `/Users/minzi/Developer/the-guy/install.sh`
- Release workflow: `/Users/minzi/Developer/the-guy/.github/workflows/release.yml`
- Build script: `/Users/minzi/Developer/the-guy/scripts/build-release-bundle.mjs`
- Package metadata: `/Users/minzi/Developer/the-guy/package.json`
- Main docs entry: `/Users/minzi/Developer/the-guy/README.md`
- Vision doc: `/Users/minzi/Developer/the-guy/docs/VISION.md`
- Packaging RFC: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-003-pack-owned-pi-payloads-and-overrides.md`

### Current repo state that matters

- The repo still has no upstream remote configured in `.git/config`.
- The release workflow exists locally but has not yet been exercised against a real GitHub repository.
- `install.sh` already works against local bundles, direct bundle URLs, and a mocked latest-release API path.
- The shipped Pi payload is still a mirrored copy under `profiles/power-user/assets/.pi/agent/`, so public-release review must explicitly check for personal or sensitive data before publishing.

### Terms used in this plan

- **Public-release safety**: no secrets, no tokens, and no obviously accidental personal/private machine data that should not live in a public repo.
- **Automatic release notes**: release notes produced by the release pipeline or generated from checked-in templates/scripts, not manually typed into the GitHub UI per release.
- **Tagged release**: a Git tag like `v0.1.0` that triggers GitHub Actions to build the tarball and publish it as a release asset.

## Plan of Work

### Milestone 1 — Public-release audit

Search the repo for secrets, tokens, local-machine paths, private account data, and other obvious publication hazards. Remove or replace anything that should not be public.

**Result:** the repo is safe enough to push to a public GitHub repository.

### Milestone 2 — Automatic release notes

Add a small automatic release-notes mechanism that works with the tag-driven release workflow. The default should be something that actually runs without human editing — for example generated GitHub release notes plus a checked-in changelog fragment or generated release summary from repo metadata.

**Result:** shipping a tag does not require somebody to open GitHub and hand-write the release body.

### Milestone 3 — Upstream repo creation and first publish

Create the upstream GitHub repo, wire the remote, push the repo, and publish the first tagged release through the workflow.

**Result:** the repo is real, public, and versioned.

### Milestone 4 — Real-world verification

Run the public install command against the real GitHub release asset and verify that founder-install behavior matches the mocked/tested flow.

**Result:** the release is not just theoretically publishable; it is installable.

## Concrete Steps

1. Audit the repo with targeted scans for:
   - tokens and secret patterns
   - local machine paths
   - personal emails and handles
   - private workflow references that should not ship publicly
2. Update docs and release automation files as needed.
3. Re-run:
   - `cd /Users/minzi/Developer/the-guy && pnpm test`
   - `cd /Users/minzi/Developer/the-guy && pnpm release:bundle`
4. Create upstream GitHub repo and configure `origin`.
5. Commit and push the initial repo contents.
6. Tag the first release and push the tag.
7. Verify GitHub Actions publishes:
   - `the-guy-0.1.0.tar.gz`
   - checksum file
   - release notes/body
8. Run the public install command against the published repo.

## Validation and Acceptance

### Safety acceptance

- No secrets or tokens are present in tracked files.
- No obviously accidental private config files are published.
- Any remaining personal/workflow references are intentional and documented.

### Release acceptance

- A public GitHub repo exists.
- The tag-triggered release workflow completes successfully.
- A release asset is attached to the GitHub release.
- Release notes are created automatically enough that no manual GitHub release editing is required.

### Install acceptance

- `curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh | bash` works against the real repo.
- `install.sh --tag <tag>` works against the real repo.

## Idempotence and Recovery

- Audit changes are just file edits and can be repeated safely.
- Release workflow changes are testable locally with `pnpm test` and `pnpm release:bundle` before pushing.
- If the first tag or release fails, delete the bad GitHub release/tag, fix the workflow, and retag.
- Do not keep shipping from an unpublished local tarball once the real public repo exists. The public release path becomes the canonical install path.
