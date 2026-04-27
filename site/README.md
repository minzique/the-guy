# The Guy site

This folder is the GitHub Pages surface for The Guy.

## Source of truth

- editorial/architecture content: `site/content/stack-overview.mjs`
- page renderer: `site/templates/render-stack-page.mjs`
- generated output: `site/index.html`
- automatic release ledger source: `CHANGELOG.md`
- payload source-of-truth docs: `docs/payload-sync.md`

## Build

```bash
node ./scripts/build-pages-site.mjs
```

## Automation

- `release.yml` updates `CHANGELOG.md` and rebuilds `site/index.html`
- `pages.yml` deploys the `site/` directory to GitHub Pages on pushes to `main`
- `pnpm sync:power-user-payload` refreshes pack facts from `dotfiles-agents` + `pi-curated-skills`
