# The Guy

The Guy is a managed local-first distribution of Minzi's agent harness.

It turns the current `dotfiles-agents` setup into a product runtime you can install, inspect, repair, and later update without depending on a live source checkout. The wedge is not “another assistant.” The wedge is **agent ops**: getting a working runtime onto a machine, keeping it healthy, and fixing drift when it breaks.

The first real launch slice is **Pi-first**. Claude Code and Codex still matter, but the weekend dogfood build optimizes for getting founder friends a working Pi runtime with Minzi's prompts, agents, extensions, and local skills.

## Current status

This repo is an active v0.1 founder dogfood build.

- Vision: `docs/VISION.md`
- Product direction: `docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- Installer/profile contract: `docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`
- Dual runtime contract: `docs/rfcs/RFC-004-dual-runtime-native-and-docker-sandbox.md`
- Payload sync workflow: `docs/payload-sync.md`
- Weekend execution record: `docs/exec-plans/completed/the-guy-founder-weekend-dogfood.md`
- **v0.1 supports macOS only**
- **v0.1 is CLI-only**
- **`power-user` is the only selectable shipped profile**
- **bash is only the bootstrap shim; install, doctor, repair, and payload rendering live in the TypeScript runtime**

## Repository layout

```text
apps/
  guy-installer/        CLI entrypoint for install/status/doctor/repair flows
packages/
  guy-core/             Runtime install logic, asset rendering, package sync, state
  guy-doctor/           Health checks and auto-fix surface
  guy-sandbox/          Docker-backed sandbox lifecycle and driver contract
  guy-profile-schema/   Shared profile manifest schema
  guy-auth-claude/      Claude enrollment flow
  guy-auth-codex/       Codex enrollment flow
profiles/
  base/                 Shared baseline profile
  power-user/           Terminal-forward profile
  guided/               Guided profile for terminal-averse users
docs/rfcs/
  RFC-001-...           Product and architecture proposal
```

## Current v0.1 commands

```bash
./install.sh
./install.sh --tag v0.1.0
./install.sh --bundle <path-or-url>
guy install
guy auth claude
guy auth codex
guy status
guy doctor
guy doctor --fix
guy repair
guy sandbox start
guy sandbox status
guy sandbox shell
guy sandbox exec -- <cmd>
guy sandbox stop
guy sandbox doctor
```

The current CLI performs a real Pi-first install slice:

- installs the `power-user` profile into a real home directory or temp override
- can assemble a Docker sandbox image from the current runtime bundle and keep a warm container around
- installs Pi if the managed binary is missing
- copies the bundled Pi payload into `~/.pi/**`
- syncs portable Pi packages from the shipped settings
- writes `~/.guy/state/install.json`
- writes rendered asset metadata under `~/.guy/rendered/`
- runs doctor checks and writes `~/.guy/logs/doctor.log`
- repairs deleted managed files with `guy repair` or `guy doctor --fix`

## Near-term milestones

1. Finish the founder weekend dogfood flow and validate it from the release bundle
2. Extract the Pi payload into a pack-owned package + override layer (`RFC-003`)
3. Ship the Docker-first `guy sandbox` surface on top of the same payload/runtime contract
4. Deepen provider auth/state detection for Claude and Codex
5. Add safer drift reporting and support-bundle diagnostics
6. Package Paperclip and connector health on top of the local runtime once the Pi-first slice is stable

## One-command install shape

The intended install surface is:

```bash
curl -fsSL https://raw.githubusercontent.com/minzique/the-guy/main/install.sh | bash
```

By default the installer resolves the latest GitHub release asset from `minzique/the-guy`. You can also pin a tag:

```bash
curl -fsSL https://raw.githubusercontent.com/minzique/the-guy/main/install.sh | \
  bash -s -- --tag v0.1.0
```

The shell script only resolves and installs the release bundle. The real runtime behavior stays in the TypeScript CLI.

The canonical shipped Pi payload now lives under `packages/guy-pi-pack/assets/.pi/agent/`.

Third-party curated Pi skills are generated from `/Users/minzi/Developer/pi-curated-skills`, not authored directly inside the pack. The shipped runtime destination for those skills is `~/.pi/agent/vendor-skills/**`.

For founder-compatibility, `profiles/power-user/assets/` is still kept as a generated mirror/fallback, not the authoring source. For now the sync flow still refreshes the pack from the upstream Pi authoring repo, then regenerates the profile mirror. See `docs/payload-sync.md` for source-of-truth rules and promotion flow:

```bash
pnpm sync:power-user-payload
pnpm test
```

## Release flow

Tag-driven publishing is set up in `.github/workflows/release.yml`.

Expected flow:

```bash
pnpm install
pnpm test
pnpm release:bundle
# bump package.json version if needed
git tag v0.1.0
# push branch + tag once the repo exists upstream
```

On tag push, GitHub Actions:

- rebuilds and verifies the release bundle
- publishes `the-guy-<version>.tar.gz`
- publishes `the-guy-<version>.tar.gz.sha256`
- generates GitHub release notes automatically
- updates `CHANGELOG.md` from the published release notes automatically

## Workspace scripts

```bash
pnpm install
pnpm build
pnpm test
pnpm sync:power-user-payload
pnpm release:bundle
```

## Generate the RFC PDF

```bash
pnpm rfc:pdf
```
