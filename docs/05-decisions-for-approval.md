# Decisions For Approval

These are the decisions I recommend you approve before implementation starts.

Status: approved by project owner, with the AI authoring and preview workflow added as a required architectural feature.

## 1. Start With The Open Curriculum

Recommendation: approve.

Build the public curriculum repository, schema, validation, graph, and website first. Do not start with the SaaS platform.

Reason: the platform's long-term advantage depends on a structured curriculum foundation.

## 2. Use Git As The Canonical Curriculum Source

Recommendation: approve.

The curriculum should be authored as files in a public Git repository. A future authoring studio can create pull requests, but should not replace Git as the source of truth.

Reason: version history, transparency, public review, offline copies, and community contribution are core to the vision.

## 3. Use Structured Records Plus MDX Bodies

Recommendation: approve.

Each curriculum object should have structured metadata plus a human-readable body.

Reason: EarlyAtlas needs both machine-readable precision and educator-friendly explanation.

## 4. Use Stable IDs And Typed Graph Edges

Recommendation: approve.

Every domain, skill, activity, assessment, citation, printable, and media asset should have a stable ID. Relationships should be explicit typed edges.

Reason: planning, observations, recommendations, reports, AI retrieval, and release upgrades all depend on stable identifiers.

## 5. License The Curriculum Under CC BY 4.0 Unless Legal Review Says Otherwise

Recommendation: approve as provisional.

CC BY 4.0 maximizes adoption and reuse. CC BY-SA 4.0 is the main alternative if you want derivatives to remain share-alike.

Reason: the business model depends on the software experience, not restricting curriculum access.

## 6. Keep Commercial Platform Code Separate

Recommendation: approve.

Public curriculum and public site code can be open. The commercial platform should be private/proprietary unless you later decide otherwise.

Reason: this preserves the business model while keeping the curriculum genuinely open.

## 7. Use Astro For The Public Curriculum Site

Recommendation: approve.

Astro is a strong fit for a content-heavy, mostly static public curriculum site with interactive islands for graph views, search, and filters.

Reason: the public site should be fast, accessible, printable, and SEO-friendly.

## 8. Use Next.js And PostgreSQL For The Commercial Platform

Recommendation: approve for Phase 3.

Use Next.js for the app and PostgreSQL for operational data, curriculum imports, observations, reporting, and early AI retrieval.

Reason: it is a pragmatic default for a multi-tenant web application with strong data requirements.

## 9. Build The Platform As A Modular Monolith First

Recommendation: approve.

Avoid microservices early. Enforce module boundaries in code and schema, but deploy one application.

Reason: fewer operational failure modes and faster iteration.

## 10. Treat Child Data Privacy As Architecture, Not Compliance Paperwork

Recommendation: approve.

Before collecting child data, build consent, retention, audit logging, role-based permissions, data export, deletion workflows, and media access controls.

Reason: child data and education records are central to the product and high-risk if handled casually.

## 11. Add An MCP Authoring Gateway

Recommendation: approve.

Expose an MCP-compatible authoring endpoint so ChatGPT, Claude, Codex, and other agents can help non-technical authors propose curriculum additions and edits.

Reason: AI authoring should be a first-class contribution path, but agents should work through safe tools, not direct repository access.

## 12. Use Change Sets For AI Authored Drafts

Recommendation: approve.

Agents should create structured, schema-aware change sets. The server validates those change sets and materializes files only when submitting a GitHub pull request.

Reason: this gives authors a friendly AI workflow while keeping diffs deterministic and reviewable.

## 13. Separate Local, Draft, PR, And Production Previews

Recommendation: approve.

Use four preview states:

- Local preview for developer machines.
- Temporary draft preview before pull request creation.
- Pull request preview for editorial review.
- Production site after merge.

Reason: authors need to see their proposed update before it becomes permanent, and reviewers need a stable preview tied to GitHub review.

## Open Questions For You

1. Do you prefer CC BY 4.0 for maximum adoption, or CC BY-SA 4.0 for reciprocal sharing?
2. Should the first pilot curriculum target birth to 3, ages 3 to 5, or kindergarten readiness?
3. Do you want the first public repo to be named `curriculum`, `earlyatlas`, or something else?
4. Should the first implementation include only the public curriculum site, or also a small hidden authoring preview?
5. Do you want GitHub issues and discussions to be the initial community workflow?
6. Which preview host do you prefer for the first public site and PR previews: Vercel, Cloudflare Pages, or Netlify?

## Proposed Approval Statement

If approved, implementation should begin with:

```text
Build Phase 1 using Git as the canonical curriculum source, structured records plus MDX, stable IDs, typed graph edges, Astro for the public site, CC BY 4.0 as the provisional curriculum license, and an MCP-compatible authoring gateway that creates validated change sets, temporary previews, and draft GitHub pull requests.
```
