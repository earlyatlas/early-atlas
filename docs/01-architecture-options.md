# Architecture Options

## Decision 1: Curriculum Source Of Truth

### Option A: Git first, website generated from repo

Pros:

- Transparent version history.
- Strong open-source contribution workflow.
- Works offline.
- Easy releases and changelogs.
- Good fit for structured content and AI extraction.
- Public trust is built into the process.

Cons:

- Non-technical educators may find raw Git intimidating.
- Editorial workflow needs tooling over time.
- Media management needs conventions.

Recommendation: choose this.

### Option B: Database or CMS first

Pros:

- Easier visual editing.
- Built-in media management.
- Non-technical authoring can start earlier.

Cons:

- Weaker public version history.
- Harder to treat curriculum as an open-source artifact.
- Export formats become an afterthought.
- Community review is less native.

Recommendation: avoid as the canonical source of truth.

### Option C: Hybrid Git plus authoring studio

Pros:

- Git remains canonical.
- Non-technical editors get a UI.
- Good long-term editorial model.

Cons:

- More engineering work.
- Requires conflict handling and review UX.

Recommendation: target for Phase 2.

## Decision 2: Repository Shape

### Option A: One public monorepo forever

Pros:

- Simple early development.
- Shared types and validation.
- Easier local development.

Cons:

- Commercial code cannot live there unless it is also public.
- Permission boundaries get awkward later.

Recommendation: useful locally and for Phase 1, but not forever.

### Option B: Separate repos from day one

Pros:

- Clean ownership and visibility boundaries.
- Public curriculum and private platform stay separate.
- Easier external contribution governance.

Cons:

- More setup overhead.
- Shared package versioning matters earlier.

Recommendation: target GitHub organization shape.

### Option C: Start monorepo, split when platform begins

Pros:

- Fast start.
- Clear path to separation.
- Avoids premature package publishing.

Cons:

- Requires discipline around directory boundaries.

Recommendation: choose this locally, with explicit boundaries.

## Decision 3: Public Website Stack

### Option A: Astro

Pros:

- Strong fit for content-heavy public sites.
- Static-first output.
- Type-safe content collections.
- Low client-side JavaScript by default.
- Interactive islands can support graph views and search.

Cons:

- The commercial app will likely use a separate framework.

Recommendation: choose for the public curriculum site.

### Option B: Next.js

Pros:

- Excellent for app-like experiences.
- Shared mental model with eventual SaaS platform.
- Strong server rendering and routing.

Cons:

- More app framework than needed for a mostly public curriculum site.
- Easy to overbuild the public site around runtime services.

Recommendation: choose later for the commercial platform.

### Option C: Docusaurus or Starlight

Pros:

- Fast docs site setup.
- Navigation and search patterns are mostly solved.

Cons:

- EarlyAtlas is more than documentation.
- Skill graph, activities, printables, and domain browsing need a richer IA.

Recommendation: consider only if speed matters more than custom curriculum UX.

## Decision 4: Content Format

### Option A: Markdown or MDX frontmatter only

Pros:

- Familiar to contributors.
- Easy to render.

Cons:

- Large structured records become messy.
- Relationships, rubrics, and citations are hard to validate cleanly.

Recommendation: not enough by itself.

### Option B: YAML or JSON record plus MDX body

Pros:

- Structured fields stay machine-readable.
- Human explanation remains pleasant to write.
- Validation can be strict.
- Good fit for graph building, search, print, and AI.

Cons:

- Two files per content object.
- Requires conventions.

Recommendation: choose this.

### Option C: Database exports only

Pros:

- Easy for app ingestion.

Cons:

- Poor human authoring experience.
- Weak public contribution story.

Recommendation: avoid for canonical curriculum.

## Decision 5: Graph Storage

### Option A: Typed edges in curriculum records

Pros:

- Simple.
- Reviewable in pull requests.
- Can generate static graph exports.
- Avoids infrastructure too early.

Cons:

- Complex graph queries need build-time tooling.

Recommendation: choose for Phase 1.

### Option B: Dedicated graph database

Pros:

- Powerful relationship queries.
- Useful for recommendation engines at scale.

Cons:

- Extra operational complexity.
- Premature before the graph exists.

Recommendation: defer.

### Option C: PostgreSQL edge tables

Pros:

- Good for platform runtime.
- Keeps data infrastructure simple.

Cons:

- Less natural for open curriculum authoring.

Recommendation: use in the platform when consuming curriculum releases.

## Decision 6: Commercial Platform Architecture

### Option A: Modular monolith

Pros:

- Fastest path to a reliable SaaS.
- Easier transactions and debugging.
- Lower infrastructure overhead.
- Can still enforce module boundaries.

Cons:

- Requires discipline to avoid tangled domains.

Recommendation: choose for Phase 3.

### Option B: Microservices from day one

Pros:

- Independent scaling and ownership.

Cons:

- Operational cost is too high early.
- More failure modes.
- Harder privacy and audit story for a small team.

Recommendation: avoid early.

### Option C: Serverless-only architecture

Pros:

- Low operations burden.
- Good for spiky workloads.

Cons:

- More vendor lock-in.
- Background jobs, media processing, and audit-heavy workflows can get fragmented.

Recommendation: use selectively, not as the whole architecture.

## Decision 7: AI Architecture

### Option A: Prompt-only AI

Pros:

- Fastest prototype.

Cons:

- Weak reliability.
- Hard to cite sources.
- High risk for education claims.

Recommendation: avoid.

### Option B: Retrieval-augmented AI over versioned curriculum

Pros:

- Citable answers.
- Release-aware responses.
- Better guardrails.
- Works with open curriculum and platform-specific context.

Cons:

- Requires chunking, embeddings, evals, and source attribution.

Recommendation: choose.

### Option C: Fine-tuned model first

Pros:

- Could produce more domain-specific style.

Cons:

- Harder to update as curriculum changes.
- Less transparent.
- Not necessary early.

Recommendation: defer.

## Decision 8: AI Authoring Integration

### Option A: Let agents edit repository files directly

Pros:

- Simple for technical users.
- Works well inside coding agents that already have Git access.

Cons:

- Poor fit for non-technical educators.
- Too much filesystem and Git power for remote AI clients.
- Harder to validate intent before file mutation.
- Easy to create noisy diffs or broken references.

Recommendation: avoid for public authoring.

### Option B: MCP server with schema-aware change sets

Pros:

- Works across MCP-compatible AI clients.
- Good fit for ChatGPT Apps, Claude, Codex, and local agents.
- Lets the server expose safe, purpose-built tools.
- Validation can happen before any Git commit exists.
- Draft previews can be generated from proposed changes.
- Pull requests remain the review boundary.

Cons:

- Requires an authoring gateway service.
- Requires auth, rate limits, audit logs, and spam controls.
- Needs careful tool design so agents do not produce low-quality changes.

Recommendation: choose this.

### Option C: Custom web authoring app only

Pros:

- Best controlled UX for non-technical users.
- Easier to guide contributors through required fields.

Cons:

- Does not meet the goal of letting users author from ChatGPT, Claude, or other agents.
- More UI work before validating the workflow.

Recommendation: build later as an authoring studio, using the same change-set API.

## Decision 9: Preview Environments

### Option A: Only local preview

Pros:

- Simple.
- Good for maintainers and developers.

Cons:

- Not enough for non-technical contributors using ChatGPT or Claude.
- Hard to share with reviewers.

Recommendation: include, but do not rely on it alone.

### Option B: Only pull request preview

Pros:

- Standard GitHub workflow.
- Preview is tied to a reviewable branch.

Cons:

- User cannot safely preview before submitting a PR.
- Creates PR noise for rough drafts.

Recommendation: include, but add an earlier draft preview.

### Option C: Draft preview plus PR preview plus production

Pros:

- Authors can inspect changes before submission.
- Reviewers get standard PR previews.
- Production is clearly separated from unreviewed content.
- Works for both local and hosted workflows.

Cons:

- Requires a draft overlay loader.
- Requires cleanup and TTL policies for drafts.

Recommendation: choose this.

## Summary Recommendation

Start with:

- Git as the canonical curriculum source.
- YAML or JSON records plus MDX bodies.
- Astro public site.
- Build-time graph validation and exports.
- RAG-ready AI manifests.
- MCP authoring gateway with schema-aware change sets.
- Local, draft, PR, and production previews.
- Later Next.js plus PostgreSQL modular monolith for the paid platform.
