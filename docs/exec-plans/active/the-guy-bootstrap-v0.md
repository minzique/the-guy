# The Guy bootstrap v0

## Purpose / Big Picture

Create the first repo scaffold for The Guy, write the initial product RFC, and generate a readable PDF export so the project has a concrete plan of record.

## Progress

- [x] (2026-04-13 08:54Z) Initialize `the-guy` repo scaffold
- [x] (2026-04-13 08:54Z) Draft RFC-001 for The Guy product boundary and rollout
- [x] (2026-04-13 08:55Z) Generate the RFC PDF export
- [ ] Derive the next installer/profile RFC from `dotfiles-agents/manifest.json` and `setup.sh`

## Surprises & Discoveries

- `pandoc`, `pdflatex`, and `weasyprint` are already installed locally, so a PDF export does not need extra tooling.

## Decision Log

- Chose a new repo boundary (`the-guy`) instead of continuing to overload `dotfiles-agents`.
- Chose macOS native + Windows via WSL2 as the first shipping targets.
- Chose profile-driven runtime design over shipping the raw `setup.sh` path.

## Outcomes & Retrospective

The repo now has a concrete product boundary, an initial RFC, and a readable PDF export. The next missing layer is the lower-level installer/profile RFC that turns the current `dotfiles-agents` implementation details into a buildable bootstrap design.

## Context and Orientation

- Root repo: `/Users/minzi/Developer/the-guy`
- Source authoring repo: `/Users/minzi/Developer/dotfiles-agents`
- Primary RFC path: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
- PDF output path: `/Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.pdf`

## Plan of Work

### Milestone 1 — Create the product boundary

Create a new repo that reflects the desired product shape: apps, packages, profiles, and docs. The result should make the new runtime boundary explicit before any installer implementation starts.

### Milestone 2 — Write the plan of record

Write an RFC that defines the product boundary, personas, profile system, release channels, auth model, health model, and staged rollout.

### Milestone 3 — Produce a portable artifact

Export the RFC to PDF so it is easy to review outside the repo.

### Milestone 4 — Turn the design into implementation guidance

Use the RFC to derive the next lower-level installer/profile RFC from `dotfiles-agents/manifest.json` and `setup.sh`.

## Concrete Steps

1. Create the repo scaffold under `/Users/minzi/Developer/the-guy`
2. Write `README.md`, workspace metadata, profile examples, and package placeholders
3. Write `docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`
4. Run `pnpm rfc:pdf` from the repo root
5. Validate that the PDF exists and is readable

## Validation and Acceptance

- `git -C /Users/minzi/Developer/the-guy status --short` shows the new repo scaffold
- `test -f /Users/minzi/Developer/the-guy/docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.pdf` succeeds
- The RFC clearly states the recommended approach, personas, release channels, auth model, and rollout plan

## Idempotence and Recovery

- Re-running the directory creation steps is safe
- Re-running the PDF generation command overwrites the PDF in place
- If the PDF generation fails, fall back to a different `pandoc` PDF engine without changing the markdown source
