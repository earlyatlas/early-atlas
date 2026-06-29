# ADR 0003: Schema First Curriculum Content

## Status

Proposed

## Context

EarlyAtlas curriculum records need to be readable by educators and reliable for software. A skill record must support public pages, search, graph traversal, recommendations, observations, printables, AI retrieval, and later platform imports.

Unstructured markdown is pleasant to write but too weak for this job. Database-only records are machine-friendly but poor for public contribution and review.

## Decision

Represent each curriculum object as structured metadata plus a human-readable body.

Recommended file pattern:

```text
record.yaml
body.mdx
```

Schemas should define required fields, valid relationships, age ranges, review status, citations, and accessibility metadata.

## Consequences

Positive:

- Strong validation.
- Human-readable content.
- Stable graph and search exports.
- AI chunks can cite exact source records.
- Platform imports can be deterministic.

Negative:

- More authoring conventions.
- Contributors need examples and tooling.
- Schema migrations must be managed.

## Follow-Up

Implement schema definitions, examples, validation CLI, and contributor templates in Phase 1.
