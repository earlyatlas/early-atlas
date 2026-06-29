# AI Authoring And Preview Workflow

## Goal

EarlyAtlas should let non-technical authors use ChatGPT, Claude, Codex, or another AI agent to propose curriculum additions and edits.

The authoring experience should feel conversational, but the system boundary should remain strict:

- The curriculum repository remains canonical.
- Agents create draft proposals, not permanent curriculum.
- Authors can preview before submission.
- GitHub pull requests remain the review boundary.
- Admins and editors approve what becomes public.

## Recommendation

Build an MCP-compatible authoring gateway.

This gateway should expose safe curriculum tools to AI clients and translate AI-authored proposals into validated curriculum change sets. A change set can be previewed as a temporary draft and, when the author chooses to submit, materialized into a GitHub branch and draft pull request.

The gateway is not a general repository automation service. It is a curriculum contribution service.

## Core Architecture

```text
AI client
  ChatGPT App, Claude, Codex, local MCP client
      |
      v
Authoring Gateway
  MCP tools, resources, prompts, auth, audit
      |
      v
Curriculum Change Set
  schema-aware proposed changes
      |
      +--> Temporary draft preview
      |
      +--> GitHub App creates branch, commit, draft PR
                 |
                 +--> CI validation
                 +--> PR preview deployment
                 +--> editor/admin review
                 +--> merge to main
                 +--> production deployment
```

## Why MCP

MCP is the right integration surface because it is becoming the common way for AI clients to call external tools and read external resources.

For ChatGPT, the OpenAI Apps SDK uses an MCP server as the required tool surface, with an optional iframe UI for richer interactions. For Claude and other clients, the same MCP server can expose tools, resources, and prompts without building a separate integration for each model provider.

The public interface should be MCP-first. ChatGPT-specific UI should be an optional layer, not the only authoring path.

## Authoring Gateway Capabilities

### MCP Resources

Resources are read-only context the agent can inspect.

Recommended resources:

- Curriculum contribution guide.
- Skill schema.
- Activity schema.
- Citation schema.
- Style guide.
- Accessibility checklist.
- Domain taxonomy.
- Current release manifest.
- Example high-quality records.

### MCP Prompts

Prompts help the user start common authoring tasks.

Recommended prompts:

- Propose a new skill.
- Improve an existing skill.
- Create an activity for a skill.
- Add accessibility adaptations.
- Add or improve citations.
- Translate or localize a record.
- Convert educator notes into a structured proposal.

### MCP Tools

Read tools:

- `search_curriculum`
- `get_curriculum_record`
- `get_related_records`
- `get_schema`
- `get_style_guide`
- `get_validation_rules`

Draft tools:

- `create_draft_changeset`
- `revise_draft_changeset`
- `validate_changeset`
- `preview_changeset`
- `compare_changeset`

Submission tools:

- `submit_changeset_as_pull_request`
- `get_submission_status`
- `request_editor_review`

Tools that should not exist:

- `merge_pull_request`
- `push_to_main`
- `delete_curriculum_record`
- `run_shell_command`
- `write_file`
- `grant_admin_access`

Deletion and deprecation should be handled through explicit schema-aware operations, not arbitrary file removal.

## Change Set Format

Agents should not directly write repository files. They should produce a curriculum change set.

A change set is a structured proposal containing:

- Author identity.
- Base curriculum release or commit SHA.
- Proposed operations.
- Rationale.
- Citations.
- Accessibility notes.
- Expected affected records.
- Validation results.
- Preview URL.

Example operations:

- `create_skill`
- `update_skill_field`
- `replace_skill_body`
- `add_prerequisite_edge`
- `create_activity`
- `link_activity_to_skill`
- `add_citation`
- `deprecate_record`
- `add_locale_variant`

The server materializes the change set into files only after validation and user submission.

## Preview Model

EarlyAtlas needs four separate environments.

### 1. Local Preview

Audience: maintainers and technical contributors.

Runs on the contributor's computer.

Expected command:

```bash
pnpm dev
```

The local site should load:

- Current working tree curriculum.
- Optional local draft overlays.
- Generated search and graph indexes.

Recommended URL shape:

```text
http://localhost:4321/
http://localhost:4321/drafts/<draft-id>/
```

### 2. Temporary Draft Preview

Audience: non-technical authors using ChatGPT, Claude, or the future authoring studio.

The draft preview is created before a pull request exists. It should render the public site with the proposed change set overlaid on top of the current curriculum release.

Properties:

- Private or unlisted.
- No-index.
- Time-limited.
- Not part of the canonical curriculum.
- Can be revised repeatedly.
- Can be deleted without Git history.

This is the answer to: "I want to see my update in the browser before it becomes permanent."

### 3. Pull Request Preview

Audience: editors, admins, and public contributors.

After the author submits the change set, the gateway creates:

- A branch.
- One or more commits.
- A draft pull request.
- Labels such as `ai-authored`, `curriculum`, and `needs-editorial-review`.
- A PR body with validation results, preview links, citations, and author attestation.

The hosting provider should generate a preview URL for the PR branch. This is the review preview.

### 4. Production

Audience: public users.

Production deploys only from the protected production branch after:

- Required schema checks pass.
- Graph validation passes.
- Accessibility checks pass.
- Editor or admin approval is recorded.
- The pull request is merged.

## GitHub Integration

Use a GitHub App, not a personal access token, for automation.

Recommended permissions:

- Repository metadata: read.
- Contents: read and write.
- Pull requests: read and write.
- Issues: read and write for comments and labels.
- Checks: read.

The GitHub App should:

- Create branches like `ai-drafts/<short-user-id>/<topic>-<timestamp>`.
- Commit materialized curriculum files.
- Open draft pull requests.
- Request review from CODEOWNERS or an editorial team.
- Comment with validation and preview links.

The GitHub App should not:

- Merge pull requests.
- Modify branch protection.
- Admin repositories.
- Access unrelated repositories.

## Author Identity

The system should support two author paths.

### Logged-In Contributor

Best for recurring contributors.

- User signs in to EarlyAtlas.
- Optional GitHub OAuth links their GitHub identity.
- User accepts contribution and license terms.
- Pull request body credits the contributor.
- Commit can be authored by the bot with co-author metadata or by the GitHub-linked identity where practical.

### Lightweight Public Suggestion

Best for low-friction feedback.

- No PR is created.
- The system creates a suggestion record or GitHub issue.
- Editors can convert it into a change set later.

This prevents anonymous users from generating PR spam while still allowing broad participation.

## Review Workflow

1. Author asks an AI client to create or edit curriculum.
2. Agent searches existing curriculum and schemas.
3. Agent creates a change set.
4. Gateway validates the change set.
5. Author opens a temporary draft preview.
6. Author revises until satisfied.
7. Author submits the draft.
8. Gateway creates a branch and draft PR.
9. CI runs validation.
10. PR preview is generated.
11. Editor reviews content, evidence, accessibility, and graph relationships.
12. Admin or editor merges.
13. Production site rebuilds from `main`.

## Safety Rules

The authoring gateway should enforce:

- No direct write to `main`.
- No merge tool.
- No arbitrary filesystem access.
- No arbitrary shell execution.
- No hidden tool side effects.
- Explicit confirmation before PR creation.
- Rate limits and spam controls.
- Audit logs for write tools.
- Required license attestation before submission.
- Prompt injection resistance by treating curriculum content as untrusted input.
- Server-side schema validation even if the AI claims it already validated the draft.

## First Implementation Scope

Build the smallest useful version:

- MCP read tools for search, record fetch, schema fetch, and style guide fetch.
- Change-set schema.
- `create_draft_changeset`.
- `validate_changeset`.
- Local draft preview support in the Astro site.
- Hosted temporary draft preview stub.
- GitHub App branch and draft PR creation.

Defer:

- Full authoring studio.
- Public ChatGPT App directory submission.
- Complex editorial dashboard.
- AI grading of curriculum quality.
- Automatic merge.

## Recommended Hosting

Initial recommendation:

- Local development: `pnpm dev`.
- Public site and PR previews: Vercel or Cloudflare Pages.
- Authoring gateway: Vercel functions, Cloudflare Workers, or a small Node service, depending on MCP SDK and streaming support during implementation.

Vercel is the simplest first choice if the authoring gateway and preview site are deployed together. Cloudflare Pages is a strong alternative for static hosting plus edge services.
