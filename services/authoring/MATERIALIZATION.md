# Approve → GitHub PR (materialization)

How an admin-approved proposal becomes a reviewable PR, and why it's structured
this way (ADR 0005, the trust boundary).

## Flow

```
admin clicks Approve (/admin)
   → POST api.earlyatlas.com/api/proposals/{id}/status {approved}
   → Go service sets status=approved, then fires a GitHub repository_dispatch
       (event: materialize-proposal, payload: the validated change set + metadata)
   → GitHub Action `.github/workflows/materialize-proposal.yml`:
       - materializes the change set into curriculum files with the canonical
         writeRecord (pnpm --filter @earlyatlas/curriculum-core materialize)
       - runs the FULL `pnpm check` gate
       - commits to branch proposals/<proposal-id> (contributor co-authored)
       - opens a DRAFT PR with a structured body + labels
   → a human reviews the PR on GitHub and merges to main → published
```

## Why this shape (repeatable / auditable / safe / fits the project)

- **Safe** — the authoring service can only _trigger_ the workflow; it never writes
  files or opens PRs. The git writes happen inside GitHub Actions onto a
  `proposals/*` branch. `main` is branch-protected; only a human merges.
- **No drift** — materialization uses the repo's own `writeRecord`, so files match
  conventions exactly and the existing CI gate passes.
- **Auditable** — every approval = one Actions run + one branch + one PR. The PR
  body carries the proposal id, submitter, rationale, and op summary; the commit
  co-authors the contributor; the proposal id links back to the DB row.
- **Repeatable** — the materializer is deterministic and the workflow is idempotent
  on `proposals/<id>` (force-updates the branch). Re-approving safely re-runs it,
  so a failed dispatch is recoverable (the proposal stays `approved`).
- **Fits the project** — the PR is the review boundary the repo already uses; CI
  (`pnpm check`) is the same gate; `main` stays the source of truth.

## What the PR looks like

- Branch `proposals/<id>`, **draft** PR titled `Proposal: <title>`.
- Body: submitter + rationale + per-op change summary + a review checklist.
- Diff: the actual `curriculum/**/record.yaml` (+ `body.mdx`) changes.
- Labels `proposal`, `needs-review` (auto-created).

## One-time activation (requires GitHub-side access)

The code + workflow are in place; to turn it on:

1. **Workflow on the default branch** — `repository_dispatch` runs the workflow
   from `main`, so this branch must be merged to `main`.
2. **Branch protection on `main`** — require a PR + review, disallow direct pushes
   (so even the trigger token can't bypass review).
3. **A trigger credential** for the authoring service — a **GitHub App installation
   token** (preferred: distinct bot identity, short-lived, repo-scoped) or a
   fine-grained **PAT** with `contents: write` on `earlyatlas/early-atlas`. It is
   used only to call the dispatch endpoint; the workflow's own `GITHUB_TOKEN` does
   the commit + PR.
4. **Configure the service** — add `GITHUB_TOKEN` (the credential above) and
   `GITHUB_REPO=earlyatlas/early-atlas` to the service's secret/env bundle, then
   redeploy (`services/authoring/DEPLOY.md`). Until then, approve sets status and logs
   `materialization=skipped` (no PR) — the rest of the system is unaffected.

The service reports the outcome in the approve response
(`materialization: dispatched | skipped | error: …`).
