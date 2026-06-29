# Early Atlas — agent guide

Public, schema-validated early-childhood curriculum. Git is the source of truth.
An Astro site renders it; an integrated MCP gateway lets agents propose edits.
Built primarily by AI agents (Claude + Codex). **UI brand is "Early Atlas"**
(two words); the package/identifier namespace is `earlyatlas`.

## Golden rules

1. **The gate is `pnpm check`** — lint, format, types, tests, curriculum
   validation, docs-index, build. Every change must pass it; CI runs the same gate.
2. **UI is for humans; the MCP gateway is for agents.** Never surface authoring
   metadata in the human UI — no ids, status pills, kind tags, or schema talk.
   Show content, not the data model. See `docs/standards/ui.md`.
3. **Style via the layered token architecture.** Colors/space/type come from
   `apps/web/src/styles/tokens.css` (the `color-no-hex` stylelint gate, `pnpm
lint:css`, enforces no raw hex). Styles live in a CSS `@layer` (base < layout <
   components < utilities) or a component's Astro scoped `<style>` — never refatten
   `global.css`. Dark mode is default. See `docs/standards/ui.md` (and the
   `styling` skill).
4. **Curriculum ids are permanent** (`ea.<kind>.<...>`). Never reuse or rename an
   id — deprecate instead. `pnpm validate` must stay green.
5. **This repo builds; it does not deploy.** `pnpm build` produces the static site;
   the publish step and its IaC live in the private infra repo. CI validates only.
   See `docs/standards/delivery.md`.
   **Infrastructure-as-code lives in a separate, private repository, never here.**
   Do not add CDK/Terraform/CloudFormation to this repo, and never commit account
   ids, resource ids, host addresses, or secrets. See `docs/standards/infrastructure.md`.
6. **Keep docs discoverable**: when you add or move a doc, add it to
   `docs/INDEX.md` (enforced by `pnpm check:docs`).
7. **One source of truth**: the Zod schema defines the model. Generate field/op
   lists from it (the MCP `schema/<kind>` resources do); never hand-copy them. The
   drift gate enforces this. See `docs/standards/source-of-truth.md`.

## Repo map

- `curriculum/` — content: `<kind>/<path>/record.yaml` (+ optional `body.mdx`)
- `packages/curriculum-schema` — Zod schemas (records, media/video, change sets)
- `packages/curriculum-core` — load, validate, search, change sets, record writes
- `apps/web` — Astro site. Public pages (browse/search/record) are prerendered
  to static; the editor and `/mcp` are SSR/dev-only. MCP server: `src/lib/mcp`.
- `docs/` — standards + planning, all indexed in `docs/INDEX.md`

## Commands

`pnpm dev` · `pnpm check` (the gate) · `pnpm test` · `pnpm validate` ·
`pnpm build` · `pnpm deploy:site`. Requires Node 20+ (`.nvmrc`) and pnpm via corepack.

## Where to look

Everything is indexed in **`docs/INDEX.md`**. Read the relevant standard before a
large change: coding, ui, testing, delivery, infrastructure, content-model.
