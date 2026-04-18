# The Guy vision

The Guy is not another assistant wrapper.

It is a **managed local-first agent runtime** for founders and operators who already have model access but do not want to become their own agent SRE.

## The product wedge

People do not mainly need help getting GPT, Claude, or Pi onto a machine.
They need help with agent operations:

- install without cloning a personal dotfiles repo
- working defaults for Pi, prompts, agents, extensions, and skills
- provider auth that can be checked and repaired
- package and connector health
- drift repair after files go missing or local edits go sideways
- a release artifact that does not depend on live repo state

Claude Code is the wedge because it is already on the machine.
The product expands from that wedge into a managed runtime that can also own Pi, Paperclip, packaged agent payloads, and eventually a control plane.

## What ships this weekend

The weekend founder build is intentionally narrow.

You should be able to:

1. run one install command
2. get a working `guy` launcher
3. run `guy install`
4. get Pi installed if missing
5. get the bundled `power-user` Pi profile rendered into `~/.pi/**`
6. run `guy doctor` to see whether the machine is healthy
7. run `guy doctor --fix` or `guy repair` to converge most local drift back to the shipped bundle

The shipped payload is Pi-first:

- `~/.pi/agent/AGENTS.md`
- bundled agent definitions
- bundled prompts
- bundled core extensions (`context-awareness`, `subagent`, `session-browser`)
- bundled local skills from Minzi's current setup
- bundled Pi settings with portable package references

This is enough to give founder friends a working Minzi-style runtime without asking them to clone `dotfiles-agents`, use symlinks, or debug shell setup drift.

## Reliability principles

### Bash is not the runtime

Use bash only as a thin bootstrap shim.

Bash can:

- download a release bundle
- unpack it
- symlink one launcher into `~/.local/bin`
- invoke the real runtime

Bash should **not** own install logic, asset rendering, health evaluation, package sync, or repair semantics.
Those belong in the TypeScript runtime where you can test them.

### Do not use symlinks as the product contract

Symlink-heavy setups are fine for a personal dotfiles repo and bad for a shipped runtime.

The temporary product contract is:

- versioned release bundle
- explicit asset manifest
- copy-based render into final destinations
- Guy-owned state in `~/.guy/`
- repair from owned metadata, not from guessed filesystem state

That copy-based render is a **temporary shipping move**, not the long-term authoring model. The source of truth must stay upstream. Until pack-owned manifests land, treat the payload inside The Guy as a mirror of an upstream dev branch, not as the place where you author long-lived changes.

### Treat rendered Pi config as disposable output

The runtime owns the rendered files under `~/.pi/**` that it ships.
If they drift, `guy repair` can overwrite them.
Supported customization should move into an override layer later instead of making rendered output the source of truth.

## Product ladder

### Phase 0 — weekend founder dogfood

Ship a Pi-first local runtime with:

- one-command install path
- macOS support only
- one shipping profile: `power-user`
- doctor and auto-fix
- bundled Minzi runtime assets

### Phase 1 — packaged Pi payloads and overrides

Move raw Pi payloads out of `profiles/` and into a first-class package boundary.
Add override layering and a per-asset render ledger so repair is deterministic.

### Phase 2 — Paperclip and connector runtime

Once local Pi installs are stable, add packaged Paperclip defaults and connector health.
The runtime should be able to answer:

- is Paperclip installed?
- are background workers healthy?
- which connectors are broken?
- what can be auto-fixed locally?

### Phase 3 — hosted control plane

The hosted layer comes after the local runtime is stable.
That layer should own:

- manifests and release channels
- machine registration
- rollout state
- remote diagnostics and support bundles
- background job routing
- connector health visibility

## What not to do yet

Do not spend this weekend on:

- a GUI installer
- a generic marketplace story
- native Windows support
- broad OpenCode packaging
- hosted orchestration before the local runtime is trustworthy
- symlink compatibility with personal dotfiles layouts

## Current implementation rule

If a decision is ambiguous, pick the option that makes the weekend build:

- easier to install
- easier to diagnose
- easier to repair
- less coupled to Minzi's live filesystem
- more testable without shell tricks
