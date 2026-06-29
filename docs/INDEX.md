# Documentation index

The map agents use to find and maintain docs. **Rule:** every `docs/**/*.md` must
be listed here with a one-line purpose (CI enforces this via `pnpm check:docs`).
When you add, move, or retire a doc, update this list in the same change.

Start with [AGENTS.md](../AGENTS.md) (root) — the operating guide.

## Standards (operative — follow these)

- [standards/coding.md](standards/coding.md) — language rules, the `pnpm check` gate.
- [standards/ui.md](standards/ui.md) — UI principles + styling standards (tokens, a11y).
- [standards/testing.md](standards/testing.md) — test frameworks, what to test, how.
- [standards/delivery.md](standards/delivery.md) — GitHub → publish pipeline; local deploy.
- [standards/infrastructure.md](standards/infrastructure.md) — IaC, "spark" naming + tags.
- [standards/content-model.md](standards/content-model.md) — ids, records, relationships, sequencing.
- [standards/source-of-truth.md](standards/source-of-truth.md) — schema is truth; generation + drift gate.
- [standards/refreshing-standards.md](standards/refreshing-standards.md) — regenerate ELOF `standard` records from source.

## Background (planning — context, not rules)

- [00-planning-summary.md](00-planning-summary.md) — overall direction.
- [01-architecture-options.md](01-architecture-options.md) — decisions and trade-offs.
- [02-curriculum-model.md](02-curriculum-model.md) — full curriculum model.
- [03-platform-architecture.md](03-platform-architecture.md) — future commercial platform.
- [04-roadmap.md](04-roadmap.md) — phased roadmap.
- [05-decisions-for-approval.md](05-decisions-for-approval.md) — approved decisions.
- [06-ai-authoring-preview-workflow.md](06-ai-authoring-preview-workflow.md) — MCP authoring flow.
- [research-notes.md](research-notes.md) — references and notes.
- [adr/0001-curriculum-source-of-truth.md](adr/0001-curriculum-source-of-truth.md) — ADR.
- [adr/0002-public-curriculum-commercial-platform-split.md](adr/0002-public-curriculum-commercial-platform-split.md) — ADR.
- [adr/0003-schema-first-curriculum-content.md](adr/0003-schema-first-curriculum-content.md) — ADR.
- [adr/0004-ai-authoring-gateway.md](adr/0004-ai-authoring-gateway.md) — ADR.
- [adr/0005-authoring-identity-and-persistence.md](adr/0005-authoring-identity-and-persistence.md) — ADR: identity (Cognito), persistence (Aurora `authoring` schema), trust boundary.
