-- Authoring proposal queue (ADR 0005). A logically separate schema in the
-- existing Aurora Postgres cluster. Untrusted proposals live here as inert
-- rows; only an admin approval ever materializes one into git.

create schema if not exists authoring;

create table if not exists authoring.proposals (
  id            uuid primary key default gen_random_uuid(),
  -- draft: created, not yet submitted for review
  -- submitted: contributor submitted; awaiting admin review
  -- approved: admin approved; PR materialization pending/in flight
  -- rejected: admin declined
  -- merged: PR merged to main
  status        text not null default 'draft'
                  check (status in ('draft', 'submitted', 'approved', 'rejected', 'merged')),
  author_sub    text,          -- Cognito subject (identity), null for anonymous drafts
  author_email  text,
  title         text,
  rationale     text,
  changeset     jsonb not null, -- the full curriculum change set (changesetSchema)
  base_commit   text,           -- curriculum release/SHA the proposal was authored against
  validation    jsonb,          -- last deterministic validateChangeset() result
  review_notes  jsonb,          -- advisory AI editorial review notes
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Admin queue reads pending proposals newest-first.
create index if not exists proposals_status_idx
  on authoring.proposals (status, created_at desc);
