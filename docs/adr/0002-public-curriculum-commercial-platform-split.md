# ADR 0002: Public Curriculum And Commercial Platform Split

## Status

Proposed

## Context

EarlyAtlas has two complementary goals:

- Make the curriculum a trusted public good.
- Build a commercial platform that makes the curriculum easier to implement.

The architecture must support both without confusing what is free and what is paid.

## Decision

Separate the open curriculum from the commercial platform.

Recommended GitHub shape:

- Public curriculum repository.
- Public website repository or app.
- Private commercial platform repository.

The platform consumes versioned curriculum releases rather than owning the curriculum.

## Consequences

Positive:

- Clear trust boundary.
- Public contributors can work on curriculum without seeing platform code.
- Commercial product can evolve without weakening the open curriculum promise.
- Curriculum releases remain stable for reports and observations.

Negative:

- Shared schema and loader packages need versioning.
- Release import tooling is required.
- Cross-repo coordination matters.

## Follow-Up

Start locally with clear directory boundaries, then split repositories when publishing to GitHub.
