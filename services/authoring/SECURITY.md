# Authoring API — security model

The authoring backend (`https://api.earlyatlas.com`) is the one place that gates
access to the proposal queue. This is the security audit + the decisions behind it.

## Identity: stateless Cognito JWT bearer tokens (not server sessions)

There is **one** backend consumed by **several browser origins** (localhost, the
LAN, `dev.earlyatlas.com`, `earlyatlas.com`) **and by agents**. For that shape,
**bearer JWTs beat HTTP session cookies**:

- Cookies are origin-bound and break cross-origin (third-party-cookie blocking),
  and using them cross-origin forces credentialed CORS — a CSRF surface.
- A Cognito JWT is origin-agnostic, **stateless** (no server session store),
  verified per request, and works identically for **humans** (the SPA gets a token
  from the Cognito hosted UI via OAuth 2.1 + PKCE) and **agents** (OAuth 2.1).

So: clients send `Authorization: Bearer <Cognito ID token>`. The `ea_session`
cookie path exists only for the same-origin SSR dev proxy; it is **never** accepted
cross-origin (see CORS).

### What every request is checked for

`internal/auth` verifies the token with `go-oidc` against the Cognito pool:
signature (JWKS), **issuer**, **audience = our app client id**, **expiry**, and
`token_use = id`. A forged, expired, wrong-pool, or wrong-audience token fails →
the caller is anonymous.

## Gating (audit result)

- **All `/api/*` data routes require a valid token.** `POST /api/proposals` →
  `requireUser`; `GET` list/one and `POST .../status` → `requireAdmin`
  (admin = the `admins` group in the `cognito:groups` claim). Verified live:
  no token / bad token → `401`; non-admin → `403`.
- `/healthz`, `/readyz` are intentionally public (no data).
- Agents and humans are gated identically — there is no anonymous write path.

### Fixed during this audit

- **Removed the legacy `/edit` + `/api/save` route** (Astro): it was unauthenticated
  and wrote straight to the working tree, bypassing the proposal/review trust
  boundary. Superseded by `/contribute` → `/api/proposals`.

### Known, accepted, or deferred

- `/mcp` (Astro) is unauthenticated but **dev-only and non-persisting** (in-memory);
  it is not deployed. Gate it with Cognito when the agent-OAuth flow lands.
- `/api/search` (Astro) is an open read over the already-public curriculum.

## CORS — cross-origin without a security hole

`internal/api/cors.go`: an **allowlist** (from `AUTHORING_CORS_ORIGINS`) of the UI
origins. Only an allowlisted `Origin` gets an `Access-Control-Allow-Origin` echo;
anything else is blocked by the browser. **`Access-Control-Allow-Credentials` is
never set** — so the browser never sends cookies to the API across origins, and
there is no cross-origin CSRF surface. Cross-origin auth is therefore **bearer
only**, exactly the token the SPA chooses to attach.

Allowed origins are config (secret bundle), so a new UI surface is added without a
code change.

## Transport & abuse

- TLS terminated at the shared edge nginx (Let's Encrypt, auto-renew); HSTS set.
- Basic rate limiting at the edge (`limit_req zone=api`, `limit_conn perip`).
- DB access is a least-privilege role (`earlyatlas_app`, DML only); credentials
  live in a `0600` env file rendered from Secrets Manager, never in the image.

## The SPA (frontend) — `apps/web/src/lib/auth/browser.ts`

The static UI surfaces do client-side OAuth 2.1 + PKCE against the Cognito hosted
UI; the ID token is kept in **`sessionStorage`** (per-tab, cleared when the tab
closes — narrower than `localStorage`) and attached as `Authorization: Bearer …`
to `api.earlyatlas.com`. **One build serves every origin**: the OAuth redirect URI
is derived from `location.origin` at runtime, and `api.earlyatlas.com` is the same
backend everywhere. Tokens are short-lived (60 min). Cookies are never used
cross-origin.

The `dev` in the Cognito pool name is just the account tier — the **same** pool /
backend / schema serves localhost, dev.earlyatlas.com, and earlyatlas.com. (Login
needs HTTPS for non-localhost origins, so LAN-IP login isn't possible; use
`localhost` locally.)
