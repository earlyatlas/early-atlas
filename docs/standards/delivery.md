# Delivery: GitHub → publish pipeline

Two independent loops: **CI validates**, **a deploy step publishes**. CI never
touches the cloud, so you never wait on Actions to publish.

## Environments

| Env  | Domain                            | Branch    |
| ---- | --------------------------------- | --------- |
| prod | `earlyatlas.com` (+ `www` → apex) | `main`    |
| dev  | `dev.earlyatlas.com`              | `develop` |

Both UI surfaces share the one backend (`api.earlyatlas.com`).

## Code flow

1. Work on `develop` → make the change → `pnpm check` locally.
2. Open a PR. GitHub Actions runs the same gate (`.github/workflows/ci.yml`).
   Green is required to merge.
3. Merge `develop` → `main`. `main` is the prod state; `develop` is the dev state.

## Publish

The site is a static, prerendered build (`pnpm build`) synced to a CDN-backed
bucket. **The deploy step and all of its infrastructure-as-code live in a separate,
private infrastructure repository** (see `docs/standards/infrastructure.md`); this
repo only produces the build artifact. Deploys are deterministic — the same commit
produces the same site — and run from that repo, not from CI here.

## Content flow

Curriculum edits reach production the same way as code:

- A maintainer edits via the dev editor (`pnpm dev`, writes to `curriculum/`), or
- a contributor proposes a change through the authoring queue → a reviewed draft PR.

Either way: PR → CI gate → merge → publish. Git stays the source of truth; nothing
is published that didn't pass the gate.
