# Roadmap

## Phase 0: Foundation Planning

Goal: decide architecture before implementation.

Deliverables:

- Architecture plan.
- Curriculum model.
- Repository strategy.
- Licensing recommendation.
- Platform architecture.
- Approval decisions.

Status: in progress in this local workspace.

## Phase 1: Open Curriculum

Goal: publish a credible public curriculum foundation.

Recommended first scope:

- 3 to 5 domains.
- 30 to 50 skills.
- 20 to 30 activities.
- 10 to 20 citations.
- 5 to 10 printables or printable templates.
- Basic public website.
- Browse by domain, age, skill, and activity.
- Search.
- Graph validation.
- Contribution workflow.

Core engineering deliverables:

- Curriculum file structure.
- Schema package.
- Validation CLI.
- Graph export.
- Search index generation.
- Public website.
- CI validation.
- Contributor guide.

Success criteria:

- Educators can read and use the pilot curriculum without logging in.
- Developers can validate and consume the curriculum.
- Contributors can propose changes through pull requests.
- Every skill and activity has stable IDs and valid relationships.

## Phase 2: Curriculum Publishing System

Goal: make curriculum creation sustainable.

Deliverables:

- Authoring studio.
- Editorial workflow.
- Reviewer roles.
- Citation management.
- Media management.
- Translation workflow.
- Release notes.
- Deprecated and replacement skill workflow.

The authoring studio should still commit to Git or create pull requests. Git remains the canonical source of truth.

## Phase 3: Commercial Platform MVP

Goal: launch the first paid product.

Recommended first customers:

- Home daycares.
- Homeschool families.
- Small childcare centers.

MVP modules:

- Organization setup.
- Users and roles.
- Child profiles.
- Classrooms.
- Attendance.
- Daily reports.
- Basic parent communication.
- Curriculum planning.
- Observation tracking.
- Developmental progress dashboard.
- AI-assisted weekly plan draft.

Success criteria:

- A small provider can run weekly curriculum planning and daily reporting in the product.
- Observations connect to skill progress.
- Parent reports cite real activities and observed skills.
- AI saves planning time without replacing teacher review.

## Phase 4: Intelligence And Ecosystem

Goal: turn curriculum plus usage data into a smarter education platform.

Deliverables:

- Personalized weekly plans.
- Classroom gap analysis.
- Cross-domain recommendations.
- Parent summaries.
- AI educator coaching.
- Third-party integrations.
- Public developer docs.
- Curriculum API.

Success criteria:

- Recommendations are explainable.
- AI outputs cite curriculum and observed evidence.
- Partners can integrate with stable APIs.
- The open curriculum attracts independent contributors.

## First 30 Days After Approval

Week 1:

- Scaffold repository.
- Add schema package.
- Define domain, skill, activity, citation, and edge schemas.
- Add validation CLI.
- Define curriculum change-set format.

Week 2:

- Add pilot curriculum records.
- Add graph validation.
- Add normalized export generation.
- Add contribution guide.
- Add draft overlay loader.

Week 3:

- Scaffold public site.
- Build domain, skill, activity, and search pages.
- Add basic print stylesheet.
- Add accessibility checks.
- Add local draft preview route.

Week 4:

- Add AI chunk export.
- Scaffold MCP authoring gateway with read tools and draft validation.
- Add release process.
- Add CI.
- Review pilot with educators or domain experts.

## First Build Milestone

The first milestone should be:

> A public website generated from a validated curriculum repository, containing a small but high-quality developmental skill graph.

This milestone proves the foundation before the commercial platform starts.

## AI Authoring Milestone

The first AI authoring milestone should be:

> A ChatGPT/Claude-compatible MCP endpoint can search the curriculum, draft a schema-valid change set, render a temporary preview, and submit a draft GitHub pull request without granting any agent merge access.

This milestone proves the non-technical authoring loop while preserving admin review.
