# Coding standards

## The gate (objective)

`pnpm check` runs, in order: `lint` (ESLint) → `format:check` (Prettier) →
`typecheck` (tsc + `astro check`) → `test` (Vitest) → `validate` (curriculum) →
`check:docs` (docs index) → `build`. A change is done only when this passes. CI
runs the identical gate on every push/PR.

## Rules

- **TypeScript, strict.** `tsconfig.base.json` is strict with `noUnusedLocals`.
  Prefer precise types; avoid `any` in new code (loaders that handle untrusted
  YAML are the pragmatic exception).
- **Small, single-purpose modules.** Packages export from `src/index.ts`. Keep
  cross-package imports flowing one way: `web` → `core` → `schema`.
- **Comments state constraints, not narration.** Explain a non-obvious rule or
  invariant; don't restate the code.
- **Errors are values where it aids callers** (e.g. the loader collects issues
  rather than throwing) so the site and gateway can render partial state.
- **Formatting is automated.** Run `pnpm format`; never hand-format. Prettier
  config is the source of truth (`printWidth` 100).
- **Determinism.** Node 20+ (`.nvmrc`), pnpm via corepack, committed lockfile,
  `--frozen-lockfile` in CI.

## Adding a dependency

Justify it (size, maintenance, security). Pin a caret range, run `pnpm install`,
commit the lockfile, and make sure the gate still passes.
