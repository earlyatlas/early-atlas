# ADR 0005: Authoring Identity, Persistence, and the Review Trust Boundary

## Status

Accepted

## Context

ADR 0004 established an MCP authoring gateway and the rule that curriculum
changes become canonical only after review. It left open _who_ may author, _how_
they are authenticated, _where_ an in-flight proposal is stored before it is
approved, and _how_ the deployed (static) site can accept a proposal at all.

Constraints that force the design:

- **Production is fully static.** The public site is prerendered to S3 and served
  by CloudFront. `/mcp`, the editor, and `/api/*` only run under `pnpm dev` today
  — there is **no backend in production**, so the deployed site currently cannot
  receive a proposal.
- **Untrusted input must never touch git.** Letting an anonymous proposal open a
  GitHub PR directly would expose repository write to the public path. The
  repository must only ever receive admin-approved content.
- **Contributors and agents both need identity.** We want attribution, basic
  spam control, an admin allow-list, and a standard way for AI agents to
  authenticate — including one-off agents that connect for a single session and
  do not persist the connection.
- **A relational database already exists**: a shared, VPC-private Aurora
  **PostgreSQL 16** cluster, reached over a normal in-VPC connection (no Data API).

## Decision

### 1. Trust boundary — staging table, not a PR

Incoming proposals (from humans via a structured form, or from agents via MCP)
are validated server-side and written as **inert rows in the database**, not as
git commits. Spam or malicious input has no commit history and is deleted with a
`DELETE`. **Only an authenticated admin approval** invokes the trusted,
server-side action that materializes a validated change set into a branch + PR
via the GitHub App. The public path has **zero** git-write capability.

A proposal is a stored curriculum **change set** (the existing
`changesetSchema`: `create_record`, `update_fields`, `replace_body`,
`deprecate_record`, `add_edge`). New records (skills, activities, worksheets) are
`create_record` ops — this is not edit-only.

### 2. Review — deterministic gate + advisory AI + human admin

1. **Deterministic gate (hard pass/fail):** `validateChangeset()` applies the ops
   to a clone of the current release and runs Zod + `checkGraph()` — every id
   reference must resolve, domain/skill linkages must be real, no prerequisite
   cycles, controlled methodology vocab. Runs on submit _and_ again in CI before
   merge. This is the linkage-integrity guarantee.
2. **AI editorial review (advisory, never gating):** an agent judges placement,
   domain fit, and sequencing — things code cannot decide — and writes notes onto
   the proposal row.
3. **Human admin (final):** sees the rendered diff/preview, the deterministic
   result, and the AI notes, and approves. Intuitive without AI; accelerated by it.

### 3. Identity — AWS Cognito

A Cognito user pool is the single identity provider:

- **Contributors** sign in (email + social) for attribution; needed to submit.
- **Admins** are a hand-controlled `admins` group; the Lambda gates `/admin/*`
  and the approval API on the JWT group claim. This is the access control we lack
  today (no IAM/DB-level authz for the app).
- **Agents** authenticate via **OAuth 2.1 browser consent** with Cognito as the
  authorization server — the MCP-standard flow. A one-off agent consents for the
  session and stores no long-lived secret, so it does not auto-load next time.

### 4. Compute — a small Go service on the shared EC2 host

The dynamic surface (`/mcp`, `/api/*`, `/admin/*`) is served by a **small Go
service** (`services/authoring`) that runs on a shared host as a container behind
the edge proxy — the same pattern as the other apps there. CloudFront keeps serving
the static content from object storage and path-routes the
dynamic paths to that service. One static binary on a distroless image (~12 MB),
nonroot — deliberately minimal footprint on an already-busy host.

> Earlier drafts proposed Astro SSR on Lambda + the RDS Data API. That was
> abandoned: see §5. Lambda+Data API only made sense to reach the DB from outside
> the VPC; running in-VPC on EC2 removes that need entirely.

### 5. Persistence — `authoring` schema, via a normal in-VPC Postgres connection

Proposals live in a logically separate `authoring` schema in the shared Aurora
PostgreSQL cluster. The Go service connects the **same way every other app does**:
a normal pooled Postgres connection (`DATABASE_URL`) from an in-VPC process. This
is what makes scale-to-zero a non-issue — a connection simply wakes the cluster.

The **RDS Data API was ruled out**: the cluster is Aurora Serverless v2 with
`MinCapacity = 0` (scale-to-zero), and AWS does not support the Data API on a
cluster with 0-ACU minimum. Enabling it would have required removing scale-to-zero
(a continuous-cost change to shared platform infra). A normal connection avoids
all of that and matches the established platform pattern. Local DB access for
migrations/dev is via the existing SSH tunnel to the EC2 host.

### 6. Environments — one backend, shared by all UI surfaces

There is **one** authoring backend, by decision: one Cognito pool, one Go service,
one `authoring` schema/DB role. **UI surfaces may split** (e.g. `dev.earlyatlas.com`
as a preview surface and `earlyatlas.com` as the public surface) but they all talk
to the **same** backend and the **same** schema. There is intentionally **no
separate dev/prod backend split**. (Where `dev` appears in resource names it
denotes the shared non-prod _account tier_, not an app environment.) The
non-canonical render mode below — not a separate backend — is
what keeps unapproved content from looking official.

### 7. Non-canonical render mode (reputation guardrail)

Any render that is not production-from-`main` (local working-tree edit, draft
overlay, PR preview) gets, in one place: a persistent "Draft — not official Early
Atlas content" banner, `noindex`, and **no print/PDF button**. This prevents
edited-but-unapproved material from being printed or shared as official.

## Consequences

Positive:

- Untrusted input never reaches the repository; the repo stays pristine.
- New skills/activities/worksheets and edits use one change-set pipeline.
- Reuses existing assets: `changesetSchema`, `validateChangeset`/`checkGraph`,
  the MCP gateway, the CI gate.
- Standard, ephemeral agent auth; humans approve without touching GitHub.

Negative / costs:

- New infra (provisioned in the private infra repo): Cognito pool, a small Go service
  on a shared host, CloudFront path-routing to it, and an `authoring` schema + migrations.
- The cluster is shared and scale-to-zero. It may later move to a dedicated cluster,
  but remains the **one** backend either way (see Environments).
- A second runtime language (Go) alongside the TS app — bounded to the authoring
  service; the curriculum schema/validation stays single-source in TS.

## Follow-Up

All AWS IaC is done in the **spark** repo (project `earlyatlas`); see
`docs/standards/infrastructure.md`. Phased build (identity first):

1. **Identity** — Cognito pool + `admins` group (spark mutation
   `2026-06-28-earlyatlas-cognito-user-pool`, applied). OAuth + admin guard live in
   the app. ✓
2. **Persistence** — `services/authoring` Go service: `authoring` schema +
   migrations + proposal repository over a normal in-VPC Postgres connection. Then
   `create_draft_changeset` writes a proposal row. (Data API approach withdrawn.)
3. **Structured human editor** — schema-driven forms (id-reference fields are
   search-and-pick, so broken links are impossible); writes the same change set.
4. **Draft preview + non-canonical render mode** — wire `applyChangeset()` to a
   `/drafts/<id>` overlay; banner + noindex + print-kill.
5. **Approval + materialization** — admin queue; approve → a GitHub
   `repository_dispatch` triggers the `materialize-proposal` workflow, which
   materializes via canonical `writeRecord`, runs `pnpm check`, and opens a draft
   PR on `proposals/<id>`; a human merges. The service only triggers; it never
   writes git. See `services/authoring/MATERIALIZATION.md`. ✓ (built; activate with
   a GitHub trigger credential + branch protection on `main`.)
6. **Agent OAuth + persist `add_edge`** — Cognito OAuth on `/mcp`; make `add_edge`
   actually write the relationship.

Resolved since: the production UI surfaces are static and do client-side OAuth +
bearer calls to the one backend (`api.earlyatlas.com`); the Go service runs on the
shared EC2 behind the edge nginx (no CloudFront path-routing needed).
