# Curriculum Model

## Principle

Skills are the primary unit. Activities, assessments, media, printables, and guidance exist to support skills.

The curriculum should answer:

- What is the child developing?
- What comes before this?
- What comes next?
- How can an educator observe it?
- What activities help practice it?
- What evidence supports this guidance?

## Canonical Object Types

### Domain

Examples:

- Language
- Literacy
- Mathematics
- Science
- Fine Motor
- Gross Motor
- Executive Function
- Social Emotional Development
- Practical Life
- Music
- Art
- Outdoor Exploration
- Health and Safety

Fields:

- `id`
- `slug`
- `title`
- `description`
- `age_coverage`
- `subdomains`
- `status`
- `references`

### Skill

Fields:

- `id`
- `slug`
- `title`
- `short_description`
- `developmental_purpose`
- `domain_ids`
- `age_range_months`
- `developmental_stage`
- `prerequisite_skill_ids`
- `related_skill_ids`
- `mastery_criteria`
- `observation_prompts`
- `supporting_activity_ids`
- `materials`
- `estimated_duration_minutes`
- `accessibility_notes`
- `common_misconceptions`
- `safety_notes`
- `research_reference_ids`
- `media_ids`
- `printable_ids`
- `locale`
- `status`
- `review`

### Activity

Fields:

- `id`
- `slug`
- `title`
- `summary`
- `supported_skill_ids`
- `age_range_months`
- `group_size`
- `duration_minutes`
- `materials`
- `setup`
- `steps`
- `variations`
- `differentiation`
- `assessment_opportunities`
- `safety_notes`
- `cleanup`
- `printable_ids`
- `media_ids`
- `research_reference_ids`

### Assessment Rubric

Observational states:

- `not_introduced`
- `emerging`
- `practicing`
- `consistently_demonstrates`
- `mastered`

Fields:

- `id`
- `skill_id`
- `state_descriptors`
- `evidence_examples`
- `anti_patterns`
- `requires_human_confirmation`

### Citation

Fields:

- `id`
- `title`
- `authors`
- `publisher`
- `year`
- `url`
- `doi`
- `license`
- `notes`
- `evidence_type`

## ID Strategy

IDs should be permanent, readable, and independent of file location.

Examples:

```text
ea.domain.language
ea.skill.language.receptive.follows-one-step-direction
ea.activity.practical-life.sorting-socks
ea.citation.cdc.milestones.2026
```

Rules:

- Never reuse an ID for a different concept.
- Slugs can change if titles improve; IDs should not.
- Deprecated records remain in the repository with replacement links.
- Releases freeze exact curriculum versions.

## Relationship Model

Relationships should be typed edges, not loose prose.

Example edge types:

- `prerequisite_of`
- `related_to`
- `supports`
- `assesses`
- `adapts`
- `aligned_to`
- `replaces`

Every edge should include:

- `from_id`
- `to_id`
- `type`
- `rationale`
- `strength`
- `review_status`

For Phase 1, edges can live inside records and be materialized into graph exports during validation.

## Example Skill Record

```yaml
id: ea.skill.math.classification.sorts-by-color
slug: sorts-by-color
title: Sorts Objects By Color
short_description: Child groups familiar objects by visible color.
domain_ids:
  - ea.domain.mathematics
  - ea.domain.executive-function
age_range_months:
  min: 24
  max: 48
developmental_stage: toddler_to_preschool
prerequisite_skill_ids:
  - ea.skill.language.receptive.identifies-common-colors
related_skill_ids:
  - ea.skill.math.patterning.copies-simple-pattern
mastery_criteria:
  - Sorts at least six familiar objects into two or more color groups.
  - Explains or gestures why items belong together when prompted.
observation_prompts:
  - During cleanup, does the child group similar colors without direct instruction?
supporting_activity_ids:
  - ea.activity.practical-life.sorting-socks
accessibility_notes:
  - Provide texture or shape alternatives for children with color vision differences.
research_reference_ids:
  - ea.citation.headstart.elof
status: draft
locale: en-US
```

## Directory Structure

Recommended Phase 1 shape:

```text
curriculum/
  domains/
    language/
      record.yaml
      body.mdx
  skills/
    mathematics/
      classification/
        sorts-by-color/
          record.yaml
          body.mdx
  activities/
    practical-life/
      sorting-socks/
        record.yaml
        body.mdx
  assessments/
  citations/
  media/
  printables/
  locales/
```

## Validation Rules

CI should reject changes when:

- Required fields are missing.
- IDs are duplicated.
- Referenced IDs do not exist.
- Prerequisite cycles are introduced.
- Age ranges are invalid.
- A skill has no domain.
- An activity supports no skills.
- A claim requiring evidence has no citation or editorial rationale.
- Accessibility notes are missing on activities or printables.
- Media lacks alt text, captions, transcript, or licensing metadata where applicable.

## AI Readiness

Every release should generate:

- A normalized JSON export.
- A graph edge export.
- Search index records.
- AI chunk manifests.
- Citation maps.
- License metadata.
- Locale maps.

AI chunks should include stable source IDs so generated plans and answers can cite the underlying curriculum.

## Contribution Workflow

1. Contributor opens an issue or proposal.
2. Contributor adds or edits records.
3. CI validates schema, graph, links, citations, and accessibility metadata.
4. Domain reviewer checks developmental quality.
5. Editorial reviewer checks clarity and consistency.
6. Maintainer merges.
7. Release notes describe curriculum changes.
