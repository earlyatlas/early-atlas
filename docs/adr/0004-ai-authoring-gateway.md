# ADR 0004: AI Authoring Gateway

## Status

Proposed

## Context

EarlyAtlas should allow non-technical contributors to use AI tools such as ChatGPT, Claude, Codex, or other agents to propose curriculum changes.

The system must preserve the core governance rule: curriculum changes become canonical only after review and approval.

## Decision

Build an MCP-compatible authoring gateway that exposes safe curriculum authoring tools.

Agents will create structured curriculum change sets. The gateway will validate those change sets, generate temporary previews, and submit draft GitHub pull requests through a limited GitHub App when the author explicitly submits.

Agents will not receive tools to merge pull requests, push to `main`, write arbitrary files, or run shell commands.

## Consequences

Positive:

- Non-technical contributors can author through AI clients.
- The same interface can work across ChatGPT, Claude, Codex, and other MCP clients.
- Drafts can be previewed before GitHub PR creation.
- GitHub remains the durable review and history boundary.
- Admin review remains required before publication.

Negative:

- Requires a new gateway service.
- Requires auth, rate limits, audit logs, and preview cleanup.
- Requires careful prompt and tool design.
- Requires GitHub App setup and contribution license flow.

## Follow-Up

Define the change-set schema, MCP tools, local draft overlay loader, temporary draft preview service, and GitHub App automation in Phase 1.
