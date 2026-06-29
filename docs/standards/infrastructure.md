# Infrastructure standards

> **Infrastructure-as-code lives in a separate, private repository — NOT here.**
> All cloud infrastructure (compute, database, secrets, IAM, DNS, CDN, the edge
> proxy) is defined and applied there through a reviewed change ledger. **Do not
> add CDK, Terraform, or CloudFormation to this repository**, and never commit
> account ids, resource ids, host addresses, or secret values.

This repo contains the **application and curriculum** only. It consumes infrastructure
through configuration injected at deploy time (env vars / a secrets manager); it does
not provision it.

## Deploy

This repo produces a static build (`pnpm build`); the deploy step that publishes it
lives in the private infrastructure repo. CI here validates but never deploys — see
`docs/standards/delivery.md`.

## Domains

- `earlyatlas.com` — production site (`www` 301-redirects to the apex).
- `dev.earlyatlas.com` — a separate UI surface that shares the one backend.
- `api.earlyatlas.com` — the authoring API (the Go service in `services/authoring`).

## Identity & admins (ADR 0005)

Authoring identity (the Cognito user pool, the `admins` group, the hosted-UI/OAuth
domain, the PKCE web client) is provisioned in the private infrastructure repo. The
web app consumes the resulting issuer / client id / hosted-UI domain via env
(`COGNITO_*`, see `apps/web/.env.example`) — never hand-copied into source.

Admin access is an allow-list: membership in the Cognito `admins` group grants
review/approval (the app checks the `cognito:groups` claim).
