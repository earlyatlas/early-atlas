# Authoring service

Small Go HTTP service — the Early Atlas authoring backend (ADR 0005). Runs on a
shared host, inside the VPC, and connects to the `authoring` schema in the shared
Aurora PostgreSQL cluster with a **normal Postgres connection** (`DATABASE_URL`),
the same way the other apps connect. No RDS Data API, no Lambda. One static
binary on a distroless image (~12 MB), nonroot.

## Why Go / why here

The cluster is Aurora Serverless v2 with scale-to-zero (MinCapacity 0), which is
incompatible with the RDS Data API. So the authoring backend connects like every
other DK app: a long-running in-VPC process holding a pooled Postgres connection
(scale-to-zero just wakes the cluster on connect). Go keeps the footprint tiny on
an already-busy host.

## Scope

- Proposal queue persistence (`authoring.proposals`) — the trust boundary: untrusted
  change sets are inert rows until an admin approves.
- (Coming) OAuth session verification (Cognito), the admin review API/UI, the agent
  MCP endpoint, and PR materialization on approval.

**Authoritative change-set validation stays in CI** (the TS `validateChangeset` /
`checkGraph` gate runs on the PR). This service does not duplicate the curriculum
schema.

## Config (env)

- `DATABASE_URL` — Postgres DSN (required). In production this is an in-VPC
  connection; locally, point it at your own Postgres (or a tunnel to one):
  `postgres://<user>:<pw>@localhost:5432/postgres`.
- `PORT` — listen port (default 8080).
- `RUN_MIGRATIONS=1` — apply `migrations/*.sql` on startup (idempotent).
- `COGNITO_ISSUER`, `COGNITO_CLIENT_ID` — enable the `/api` routes; the service
  verifies Cognito ID tokens against the issuer. Without them the API is disabled.

## Run

```bash
go build ./... && go vet ./...
DATABASE_URL=... RUN_MIGRATIONS=1 go run .
curl localhost:8080/healthz   # ok
curl localhost:8080/readyz    # ready (after DB ping)
```

## Endpoints

- `GET /healthz` — liveness.
- `GET /readyz` — readiness (DB ping).
- `POST /api/proposals` — create a proposal (authenticated; author from token).
- `GET /api/proposals[?status=]` — list (admin).
- `GET /api/proposals/{id}` — fetch one (admin).
- `POST /api/proposals/{id}/status` — set status (admin).

Auth: a Cognito **ID token** via `Authorization: Bearer <token>` or the
`ea_session` cookie; admin = the `admins` group claim. Authoritative change-set
validation runs in CI, not here.
