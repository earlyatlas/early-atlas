# EarlyAtlas Architecture Planning Summary

## Recommendation

Build EarlyAtlas in two connected but distinct tracks:

1. A public open curriculum system.
2. A commercial multi-tenant software platform that consumes the curriculum.

The first implementation should not be a SaaS app. It should be the curriculum foundation: schema, IDs, graph, validation, public site, publishing workflow, and a small high-quality pilot curriculum. The paid platform should begin after the curriculum has enough structure to drive planning, observations, and recommendations.

## Why This Order

The defensible asset is the combination of:

- A trusted public curriculum.
- A machine-readable developmental skill graph.
- A platform built around that graph from the beginning.

If the platform comes first, the curriculum risks becoming app content. If the curriculum comes first but is not structured for software, the platform will need to retrofit structure later. The first phase should therefore produce a curriculum repository that is readable by humans, enforceable by machines, printable, searchable, translatable, and usable by AI.

## Recommended Repository Strategy

Initial GitHub organization target: `https://github.com/earlyatlas`

Recommended repositories:

- `earlyatlas/curriculum`: public canonical curriculum, schemas, validation, contribution workflow, releases.
- `earlyatlas/site`: public website generated from versioned curriculum releases. This can start inside the curriculum repo and split later if that keeps Phase 1 faster.
- `earlyatlas/platform`: private commercial SaaS platform when Phase 3 begins.
- `earlyatlas/schemas`: optional later split if external developers need stable package-level access to schema contracts.

For the local first implementation, start with one monorepo-style directory and keep boundaries clear:

```text
earlyatlas/
  curriculum/
    domains/
    skills/
    activities/
    assessments/
    citations/
    media/
    printables/
    locales/
  apps/
    public-site/
    authoring-studio/
    platform/
  packages/
    curriculum-schema/
    curriculum-loader/
    curriculum-graph/
    curriculum-search/
    ai-context/
    ui/
  docs/
```

Only `curriculum/`, `apps/public-site/`, and core schema packages need to exist in Phase 1.

## Recommended Technical Shape

Phase 1 public curriculum:

- Content source of truth: Git.
- Content format: structured YAML or JSON metadata plus MDX narrative bodies.
- Validation: TypeScript plus JSON Schema or Zod.
- Public website: Astro with TypeScript for a content-heavy, mostly static site.
- Search: Pagefind initially, Typesense or Meilisearch when search facets and scale require it.
- Graph: typed curriculum edges materialized at build time, stored as JSON exports first.
- AI readiness: generated chunk manifests with stable IDs, citations, license metadata, age ranges, and relation context.
- Authoring gateway: MCP-compatible server that lets ChatGPT, Claude, Codex, and other agents search curriculum, create schema-validated change sets, preview drafts, and submit GitHub pull requests.
- Preview workflow: local dev preview, private hosted draft preview, PR preview deployment, and production deployment as separate states.

Phase 3 commercial platform:

- App: Next.js with TypeScript.
- Database: PostgreSQL.
- Tenancy: `organization_id` on tenant data, role-based access control, audit events, and PostgreSQL row-level security where practical.
- Media: object storage with signed URLs, consent records, retention policies, and audit logs.
- AI: retrieval-augmented generation over versioned curriculum releases and tenant-safe child/classroom context.

## Curriculum Model Thesis

The primary entity is the skill.

Activities, materials, printables, assessments, and videos are supporting entities. A child progresses through a graph of skills, not through a calendar of lessons.

Core entities:

- Domain
- Skill
- Activity
- Assessment rubric
- Observation prompt
- Material
- Printable
- Media asset
- Citation
- Alignment
- Locale
- Release

Core relationships:

- `prerequisite_of`
- `related_to`
- `supports`
- `assesses`
- `adapts`
- `aligned_to`
- `replaces`

## Licensing Recommendation

Recommended default:

- Curriculum content: Creative Commons Attribution 4.0 International, subject to legal review.
- Public code: Apache-2.0 or MIT.
- Commercial platform: proprietary/private.

CC BY 4.0 best supports broad adoption, translation, reuse, and platform integrations. CC BY-SA 4.0 is worth considering if reciprocal sharing is more important than broad commercial reuse.

## Governance Recommendation

Use a visible editorial workflow from the beginning:

- Draft
- Review
- Accepted
- Deprecated

Every curriculum contribution should require:

- Schema validation.
- Citation or rationale.
- Age range.
- Domain and skill linkage.
- Accessibility notes.
- Locale readiness.
- Review status.

## AI Authoring Recommendation

Treat AI authoring as a first-class contribution path, not as admin automation.

The recommended design is:

- Agents do not write directly to `main`.
- Agents do not get a merge tool.
- Agents create structured curriculum change sets.
- The server validates the change set against schemas, graph rules, style rules, citation rules, and safety rules.
- Authors can preview the draft in a temporary browser view before it is submitted.
- Submission creates a GitHub branch and draft pull request through a limited GitHub App.
- Editors review and merge through normal GitHub protections.

This gives non-technical authors a conversational authoring experience while preserving the public Git repository as the source of truth.

Preview states should be explicit:

- Local preview: runs on a developer computer.
- Draft preview: private, temporary, not indexed, not canonical.
- PR preview: generated from a GitHub pull request branch.
- Production: generated only from reviewed and merged content.

## Main Risks

- Curriculum quality risk: solved with editorial review, citations, and small pilot scope.
- Licensing risk: solved with early legal review and contributor license terms.
- Graph complexity risk: solved by starting with typed edges and generated graph exports, not a dedicated graph database.
- Platform privacy risk: solved by designing consent, retention, audit logging, and tenant isolation before collecting child data.
- AI trust risk: solved by citation-first RAG, no unreviewed claims, and educator confirmation for child progress.

## Proposed First Build After Approval

1. Scaffold the repo structure.
2. Add curriculum schema definitions.
3. Create sample domains, skills, activities, and citations.
4. Build graph validation.
5. Build the first public website browse/search experience.
6. Add draft overlay preview support.
7. Add MCP authoring gateway contracts.
8. Add contribution docs and CI validation.

The first milestone should be a credible public curriculum slice, not a thin SaaS prototype.
