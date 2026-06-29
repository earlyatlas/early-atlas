# Platform Architecture

## Principle

The platform should not be a paid curriculum reader. It should be the operational and intelligence layer around the open curriculum.

Paid value comes from:

- Organization.
- Planning.
- Tracking.
- Communication.
- Reporting.
- AI assistance.
- Compliance and operational workflows.

## High-Level Shape

```text
Public curriculum repo
  -> versioned curriculum release
  -> public website
  -> AI authoring gateway
  -> draft previews and pull requests
  -> commercial platform import
  -> recommendations, plans, observations, reports, AI
```

## Recommended Phase 3 Stack

- Application: Next.js with TypeScript.
- Database: PostgreSQL.
- Architecture: modular monolith.
- API contracts: OpenAPI for external APIs where needed.
- Search: PostgreSQL and generated curriculum indexes initially; dedicated search service later.
- AI retrieval: PostgreSQL plus pgvector initially, with an option to move to a dedicated vector store if needed.
- Media: object storage with signed URLs.
- Background work: queue-based jobs for reports, notifications, media processing, AI generation, and exports.

## Authoring Gateway

The authoring gateway is a shared service before the commercial platform. It should expose MCP-compatible tools for AI clients and a small HTTP API for first-party UI.

Purpose:

- Let ChatGPT, Claude, Codex, and other agents search curriculum context.
- Let an agent propose a new skill, activity, assessment, citation, or edit.
- Validate proposals as structured curriculum change sets.
- Generate temporary previews before a pull request exists.
- Submit approved draft proposals to GitHub as draft pull requests.

The gateway should not let agents push to `main`, merge pull requests, bypass review, run arbitrary shell commands, or write arbitrary repository paths.

Recommended modules:

- `mcp`: tool definitions, resources, prompts, and auth.
- `changesets`: schema-aware curriculum patch format.
- `validation`: schema, graph, citation, accessibility, and style checks.
- `preview`: draft overlays and preview URLs.
- `github`: branch, commit, and draft pull request automation through a GitHub App.
- `audit`: tool calls, author identity, draft history, and PR submission logs.
- `moderation`: spam, abusive content, and low-quality contribution filters.

Recommended tools:

- `search_curriculum`
- `get_curriculum_record`
- `get_schema`
- `get_style_guide`
- `create_draft_changeset`
- `validate_changeset`
- `preview_changeset`
- `revise_changeset`
- `submit_changeset_as_pull_request`
- `get_submission_status`

Write tools should require authentication, explicit user confirmation, and server-side validation. Merge should remain outside the MCP surface.

## Preview Environments

EarlyAtlas should have four separate preview states:

```text
Local preview
  Developer computer, working tree and local draft overlays.

Draft preview
  Private temporary browser URL generated from a change set.

Pull request preview
  Hosted preview generated from a GitHub PR branch.

Production
  Public site generated only from reviewed and merged content.
```

Local preview should be available with one command, for example `pnpm dev`, and should support an overlay path such as `drafts/local/<draft-id>/changeset.json`.

Draft preview should be temporary, unlisted, no-index, and access-controlled when the author is logged in. It should render the public site with the proposed change set overlaid on top of the current curriculum release. This lets a non-technical author inspect the result in a browser before creating a pull request.

Pull request preview should be generated automatically after the gateway submits a branch and draft PR. Reviewers should use the PR preview for editorial review.

Production should deploy only from the protected production branch after required checks and admin/editor approval.

## Core Platform Modules

### Identity And Tenancy

Entities:

- Organization
- Location or center
- User
- Role
- Membership
- Invitation
- Permission

Requirements:

- Multi-tenant from day one.
- `organization_id` on tenant-owned records.
- Role-based permissions.
- Audit events for sensitive actions.
- Tenant-scoped queries by default.

### Child And Family

Entities:

- Child
- Guardian
- Enrollment
- Classroom assignment
- Consent
- Emergency contact
- Pickup authorization

Requirements:

- Data minimization.
- Clear consent records for media and communication.
- Export and deletion workflows.
- Strong access control for child records.

### Classroom Operations

Entities:

- Classroom
- Schedule
- Attendance record
- Daily report
- Meal
- Nap
- Toileting
- Incident note
- Medication note

Requirements:

- Mobile-first capture.
- Fast repeated-entry workflows.
- Offline-tolerant mobile strategy later.
- Parent-facing summaries.

### Curriculum Planning

Entities:

- Curriculum release
- Plan
- Plan item
- Activity assignment
- Material list
- Weekly schedule
- Classroom objective

Requirements:

- Plans pin to a curriculum release.
- Recommendations explain which skills they support.
- Teachers can override recommendations.
- Plans can be printed and shared.

### Observations And Progress

Entities:

- Observation
- Evidence
- Skill progress
- Assessment state
- Attachment
- Reviewer note

Requirements:

- Observational assessment, not test scoring.
- Progress changes require evidence.
- AI can suggest, but educators confirm.
- Longitudinal progress uses stable skill IDs.

### Communication

Entities:

- Message thread
- Announcement
- Daily report delivery
- Parent summary
- Notification

Requirements:

- Clear boundaries between internal notes and parent-visible content.
- Translation support later.
- Audit trail for delivered communications.

### Reporting

Entities:

- Developmental dashboard
- Child progress report
- Classroom coverage report
- Licensing or compliance report
- Curriculum usage report

Requirements:

- Reports cite skills, observations, and evidence.
- Reports support export to PDF.
- Dashboards distinguish observed progress from inferred recommendations.

## Data Boundary

Public curriculum data:

- Open.
- Versioned.
- Shared across tenants.
- Safe for AI indexing.

Tenant operational data:

- Private.
- Organization-scoped.
- Contains child and family data.
- Requires auditability, retention, and consent management.

AI context must keep this boundary explicit. Curriculum context can be broad. Child context must be minimal, permissioned, and purpose-specific.

## Multi-Tenant Data Model

Most platform tables should include:

- `id`
- `organization_id`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

Sensitive tables should also include:

- `deleted_at`
- `retention_policy`
- `access_level`
- `audit_subject_id`

Recommended controls:

- Application-level authorization.
- PostgreSQL row-level security where practical.
- Audit logs for child data access and mutation.
- Separate media access tokens from page permissions.
- Backups with tenant-aware restore plans.

## Curriculum Release Import

The platform should not read arbitrary latest curriculum content at runtime.

Instead:

1. Curriculum repo publishes release `vX.Y.Z`.
2. Release contains normalized JSON exports and graph edges.
3. Platform imports release into shared curriculum tables.
4. Organizations pin to a release.
5. Upgrade tooling shows changed, deprecated, and replacement skills.

This protects historical reports and observations from changing under users.

## AI Architecture

AI capabilities should be citation-first and educator-confirmed.

Core components:

- Curriculum chunk generator.
- Embedding pipeline.
- Retrieval service.
- Prompt templates versioned in code.
- Output validators.
- Evaluation suite.
- AI audit logs.

Rules:

- AI must cite curriculum sources for curriculum claims.
- AI must not mark a child as mastered without educator confirmation.
- AI-generated parent text should be draft content until approved.
- AI should not receive unnecessary child PII.
- AI outputs should record model, prompt version, sources, and user action.

## Security And Privacy Baseline

Before collecting child data, build:

- Privacy policy and data processing terms.
- Consent model.
- Media permission model.
- Audit logging.
- Data export.
- Data deletion or retention workflow.
- Incident response runbook.
- Backups and restore testing.
- Role and permission matrix.

This is not legal advice. Child data and education records need legal review before launch.

## Why Modular Monolith

EarlyAtlas will have many domains, but the early team should optimize for correctness and speed. A modular monolith allows strong domain boundaries without distributed system overhead.

Suggested modules:

- `identity`
- `organizations`
- `children`
- `classrooms`
- `operations`
- `curriculum`
- `planning`
- `observations`
- `messaging`
- `reports`
- `media`
- `ai`
- `billing`
- `audit`

Each module should own its schema, services, permissions, and tests.
