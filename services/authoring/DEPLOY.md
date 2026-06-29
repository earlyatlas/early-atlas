# Deploying the authoring service

The authoring service is a single static Go binary shipped as a small distroless
container image. It needs only:

- `DATABASE_URL` — an in-VPC PostgreSQL connection to the `authoring` schema (the
  runtime role has DML only; schema migrations run out-of-band as an admin, so the
  container runs with `RUN_MIGRATIONS=0`).
- `COGNITO_*` — issuer + client id so the API can verify Cognito JWTs.
- `AUTHORING_CORS_ORIGINS` — comma-separated UI origins allowed to call the API.
- `STRIPE_SECRET_KEY` + `DONATE_RETURN_URL` — donations (optional).
- `GITHUB_TOKEN` + `GITHUB_REPO` — proposal → PR materialization (optional).

See `.env.example` for the full list.

## Build & run

```bash
cd services/authoring
docker build -t earlyatlas-authoring:latest .
docker run -d --name authoring --restart unless-stopped \
  --env-file .env -e PORT=8080 -e RUN_MIGRATIONS=0 \
  earlyatlas-authoring:latest

# health
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/readyz   # 200
```

`deploy/docker-compose.yml` captures the same container definition.

## Hosting

The service runs as a container behind a reverse proxy that terminates TLS and
proxies to it over a private network; in production it is reachable at
`https://api.earlyatlas.com`. **Host provisioning, the secret/env bundle, IAM, DNS,
and the edge proxy configuration are defined as infrastructure-as-code in a separate
private repository** — they are intentionally not in this repo (see
`docs/standards/infrastructure.md`). Runtime configuration is injected from a secrets
manager at deploy time; secrets are never committed here.
