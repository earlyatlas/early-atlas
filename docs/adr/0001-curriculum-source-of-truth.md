# ADR 0001: Curriculum Source Of Truth

## Status

Proposed

## Context

EarlyAtlas needs a curriculum that is public, version controlled, community reviewed, machine-readable, printable, accessible, and suitable for AI-assisted workflows.

The curriculum must remain free. The commercial business should be built around implementation workflows, not access control around curriculum content.

## Decision

Use a public Git repository as the canonical source of truth for curriculum content.

Future authoring tools may provide a visual editing experience, but they should create commits or pull requests against the repository.

## Consequences

Positive:

- Public history and transparent review.
- Natural contribution workflow.
- Release tags can freeze curriculum versions.
- Schema validation can run in CI.
- Anyone can fork, inspect, export, or use the curriculum.

Negative:

- Raw Git is not friendly for every educator.
- Media and translation workflows need extra care.
- A visual authoring studio will eventually be needed.

## Follow-Up

Build Phase 1 with file-based curriculum records and validation. Build the authoring studio in Phase 2.
