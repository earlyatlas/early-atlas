# Source of truth & anti-drift

The end goal: an AI agent connects to the MCP gateway, **discovers the rules from
the server**, and contributes a valid record. That only works if the rules the
agent reads are the same rules the server enforces. So we keep one source of truth
and **generate** everything else from it.

## The single source of truth

**The Zod schema in `packages/curriculum-schema` is authoritative.** It defines
every record kind, every field, and the change-set operations. Nothing else may
restate those facts by hand.

## What is generated (never hand-copied)

- **MCP `schema/<kind>` resources** are produced by `jsonSchemaFor(kind)`
  (zod-to-json-schema) at request time. An agent reading
  `earlyatlas://schema/skill` gets JSON Schema generated from `skillSchema`.
- **The MCP change-set operation catalog** (`earlyatlas://guide/changesets`) lists
  operations from `changesetOperationNames()` — the discriminated-union options of
  `operationSchema`.
- **Server-side validation** (`validateChangeset`, `pnpm validate`) runs the same
  Zod schemas. The agent's proposal is checked against the truth, not a copy.

If you need a field list or op list anywhere (a doc, a tool, a UI), derive it from
the schema helpers (`schemaKinds`, `jsonSchemaFor`, `changesetOperationNames`).
Do not paste a field list into prose — prose drifts, generation cannot.

## The drift gate (enforced in CI)

`apps/web/src/lib/mcp/drift.test.ts` (part of `pnpm check`) fails the build if:

- the schema gains a kind with no generated `schema/<kind>` MCP resource, or
- a change-set op exists in the schema but isn't documented in the catalog (it
  shows up as an "undocumented operation").

So you cannot add a kind or op to the schema and forget to surface it to agents —
the build stops you.

## Human docs

Standards docs (this folder) explain _intent_ and point at the schema for _facts_.
When you change the model, update the relevant standard and run `pnpm check:docs`
(every doc must be in [INDEX.md](../INDEX.md)). Keep field-level truth in the
schema, not duplicated here.
