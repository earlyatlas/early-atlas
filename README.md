# Early Atlas

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue.svg)](LICENSE)

A free, standards-grounded early-childhood curriculum — published as data in
git, served as a fast static site at **[earlyatlas.com](https://earlyatlas.com)**, and
grown through a reviewed contribution pipeline.

Early Atlas is a building-block library for the people who teach and raise young
children. Every skill, activity, and milestone is a schema-validated record; the
website is generated from those records; and git is the single source of truth. The
curriculum is the public foundation — no ads, no paywall.

## What's inside

- **Whole-child domains** mapped to the federal Head Start **Early Learning Outcomes
  Framework (ELOF)**.
- **Skills** (what a child is learning) and **activities** (things to do together),
  each with age ranges, signs of mastery, materials, and steps.
- **Developmental milestones** (ELOF goals), with skills linked to the milestones they
  build toward — the basis of the Milestones explorer.
- **Methodology explainers** (Montessori, Reggio-inspired, and others), used
  descriptively; Early Atlas is independent and unaffiliated.

## Run it locally

Requires Node 20 and pnpm (via corepack).

```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm install
pnpm dev      # http://localhost:4321  — browse, search, milestones
pnpm check    # the full gate: lint, types, tests, curriculum validation, build
```

The site is static and prerendered; `pnpm build` produces the publishable artifact.

## Contributing

Two ways to help, both from **[/contribute](https://earlyatlas.com/contribute)**:

- **Support the work** — a voluntary donation keeps the library free and open.
- **Share your expertise** — propose a new skill or activity, or suggest an edit to an
  existing record. Sign in, fill in the structured form, and submit.

Every contribution is **reviewed before it publishes**. A proposal is validated on
submit, queued for an admin, and on approval is materialized into a **draft pull
request** (re-validated by the full gate) for a human to merge. You can also edit the
records under `curriculum/` directly and open a PR — same gate, same review.

Curriculum ids (`ea.<kind>.<...>`) are permanent: deprecate, never rename.

## Repository layout

| Path                 | What                                                            |
| -------------------- | --------------------------------------------------------------- |
| `curriculum/`        | The curriculum itself — one validated record per file.          |
| `apps/web`           | The Astro website (browse, search, milestones, contribute).     |
| `packages/`          | The curriculum schema and core (load / validate / write).       |
| `services/authoring` | The Go authoring backend (auth, proposal queue, donations).     |
| `docs/`              | Standards, ADRs, and design notes — indexed in `docs/INDEX.md`. |

Infrastructure-as-code is **not** in this repo — it lives in a separate private
repository (see `docs/standards/infrastructure.md`). This repo never contains
account ids, host addresses, or secrets.

## More

- **[AGENTS.md](AGENTS.md)** — the working guide for contributors and AI agents.
- **[docs/INDEX.md](docs/INDEX.md)** — the full documentation index.

## License

Early Atlas — both the curriculum content and the source code — is licensed under
**Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

You're free to **use, share, and adapt** it — including using the curriculum to power
another app — for **non-commercial** purposes, as long as you give **attribution**:
credit "Early Atlas" with a link back to this repository. **Commercial use requires
permission.** The maintainer retains copyright; reach out for commercial licensing.

See [`LICENSE`](LICENSE) for the full terms.
