# the-guy

## Project-specific rules

- Third-party curated Pi skills are **not** authored directly in this repo.
- Canonical source is `/Users/minzi/Developer/pi-curated-skills`.
- Generated consumer copy for the shipped runtime lives under `packages/guy-pi-pack/assets/.pi/agent/vendor-skills/**`.
- `packages/guy-pi-pack/assets/.pi/agent/upstream-skills.manifest.json` is generated metadata copied from the curated repo.
- Never hand-edit generated curated skill files in `packages/guy-pi-pack/assets/.pi/agent/vendor-skills/**`.
- Refresh this repo by syncing curated exports into the pack, not by patching the pack copy directly.

## Update loop

1. update `/Users/minzi/Developer/pi-curated-skills`
2. run `npm run render && npm run verify` there
3. run `pnpm sync:power-user-payload` here
4. run `pnpm test`

## Runtime rule

The Guy pack manifest is allowed to carry `postInstall` tasks. JS-backed curated skills like `browser-tools` should declare their runtime dependency step in pack metadata so install/repair stays self-describing.
