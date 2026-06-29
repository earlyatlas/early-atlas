# Testing standards

Tests are part of the gate (`pnpm test`, via Vitest). Write tests that assert
behavior and invariants, not implementation details.

## Layers

- **Schema** (`packages/curriculum-schema`) — id format, required fields, age
  ranges, media (youtube id), change-set union. Pure and fast.
- **Core** (`packages/curriculum-core`) — loading the real curriculum cleanly,
  graph integrity (dangling refs, prerequisite cycles), search, change-set
  validation (accept valid, reject bad refs), id→path mapping.
- **MCP gateway** (`apps/web/src/lib/mcp`) — JSON-RPC behavior and an **objective
  token-budget gate**: `tools/list` must stay well under budget (the design keeps
  detail in resources, not tool descriptions). Tests fail if the tool list bloats.
- **Types** — `astro check` + `tsc` are part of `typecheck`.
- **Curriculum content** — `pnpm validate` is the content test (schema + graph).

## Conventions

- Co-locate tests as `*.test.ts` next to the code.
- No network and no AWS calls in unit tests. Keep them deterministic.
- A bug fix adds a test that fails before the fix.

## Later

End-to-end UI tests (Playwright) and visual checks are planned once there are
more interactive surfaces; keep them out of the fast default gate (separate
`test:e2e`).
