# Content model

The schema (`packages/curriculum-schema`) is the single source of truth — see
[source-of-truth.md](source-of-truth.md). This doc is the operative summary;
[02-curriculum-model.md](../02-curriculum-model.md) has the long form.

## Records

- Each record is `curriculum/<kind>/<path>/record.yaml` (validated by a Zod schema)
  plus an optional `body.mdx` narrative (educator-facing notes).
- **Kinds:** `domain`, `skill`, `activity`, `citation`, `media`, `printable`,
  `methodology`, `standard` (and reserved `assessment`). The authoritative field
  list per kind is the Zod schema;
  never hand-copy it — read it from the schema (or the MCP `schema/<kind>` resource).
- **Ids are permanent:** `ea.<kind>.<segments>`, mapping 1:1 to the directory.
  Never reuse or rename an id — deprecate and link a replacement.

## The model is a graph, not a containment tree

Records relate through **typed id references**, not by nesting one kind inside
another. The hierarchy you see in the UI (Domain → Skill → leaves) is _rendered_
from these references; it is not how the data is stored.

- **Skill** is the primary unit. **Activities**, **worksheets**, and **videos** are
  resources that reference a skill — they are siblings, not parents/children of
  each other.
- A **worksheet** practices a skill (`supported_skill_ids`) and **may also** belong
  to a specific activity (`supported_activity_ids`) — then it renders nested under
  that activity as a supporting document; otherwise it renders standalone under the
  skill. This is why we don't force worksheets to live under activities: the
  relationship is optional and per-record.
- Other reference fields: `prerequisite_skill_ids`, `related_skill_ids`,
  `supporting_activity_ids`, `printable_ids`, `media_ids`, `research_reference_ids`.
  The validation gate rejects dangling references and prerequisite cycles.

## Sequencing skills (how order is decided)

Skills are **not** hand-ordered. Their order is computed from two signals
(`lib/hierarchy.ts`):

1. **Prerequisites are a hard constraint** — a skill never appears before a skill
   it requires (`prerequisite_skill_ids`).
2. **Age is the soft signal** — among skills free to place, the youngest
   (`age_range_months.min`) comes first.

So to add a skill in the right place, give it a realistic `age_range_months` and
list any genuine `prerequisite_skill_ids`. It then slots itself in — e.g. "Sorts by
color" (24mo) precedes "Adds single-digit" (48mo) automatically. Use prerequisites
only for real dependencies, not just to force order; age handles ordering.

## Video / media (YouTube)

Lessons can have associated videos, modeled as first-class `media` records so they
can be reused, reviewed, and validated like any other content.

- A media record: `ea.media.youtube.<slug>` with `provider: youtube` and an
  11-char `youtube_id`. The schema is provider-discriminated, so other providers
  can be added later without breaking existing records.
- **Association is two-way and either direction is valid:** a skill/activity may
  list `media_ids`, and/or a media record may list `supported_skill_ids`. The
  record page renders both.
- Videos render via a click-to-load facade (`components/VideoEmbed.astro`) — see
  [ui.md](ui.md) for the privacy/performance rule.

## Printables (worksheets)

A `printable` record (`ea.printable.<...>`) is a worksheet. It does **not** list
its content by hand — it carries a `generator` spec, and a deterministic engine
(`generateWorksheet`, seeded from the id) produces the problems at build time, so
the static output is reproducible. Current generator types:

- `arithmetic` — addition/subtraction problem sets (operand range, count, layout,
  optional answer key on its own print page).
- `handwriting` — dotted letter/word tracing rows (SVG: three-line guide, a solid
  model glyph + dashed copies to trace), for early writers.

Associate a worksheet with a skill via `supported_skill_ids` (and/or the skill's
`printable_ids`). Optionally add `supported_activity_ids` to make it a supporting
document for specific activities (then it renders nested under that activity).
Worksheets render at `/r/<id>` and print through the lesson **Download PDF** button.
Add a new worksheet type by adding a generator variant to the schema + a branch in
`generateWorksheet` and the `Worksheet` component — the record model itself does
not change.

## Methodologies (pedagogical approaches)

`methodology` is its own record kind (`ea.methodology.<slug>`, e.g.
`ea.methodology.montessori`). Each approach has exactly one explanatory page, and
`methodologies: [<slug>]` on a skill/activity/worksheet is a **controlled
reference** — the loader rejects any key that has no methodology record, so the
vocabulary can't drift or be misspelled.

- **Methodology is a property of the leaf (the activity/worksheet), not the
  skill.** A skill is approach-neutral; the _approach_ describes how a particular
  activity is done. Tag the activity/worksheet that embodies the approach.
- **Topical tags vs. methodology are separate axes.** Do not repeat a methodology
  slug inside `tags` — `tags` are topical (color, rhyming, fine-motor);
  `methodologies` are the approach. Search treats methodology as matching only the
  record that owns it (it does not inherit down to leaves).
- **Independence / "inspired by" framing is mandatory.** Early Atlas is not
  affiliated with, endorsed by, or certified by any methodology organization.
  Lessons are _inspired by_ these traditions and are original works. The record
  page renders a standard non-affiliation disclaimer on every methodology page and
  labels approaches as "Inspired by" everywhere — never imply affiliation,
  certification, or official curriculum, and avoid trademark/copyright risk.

## Standards & alignment (background layer)

`standard` is its own record kind (`ea.standard.<framework>.<code>`, e.g.
`ea.standard.elof.p-math-1`) — one record per external goal (Head Start ELOF, a
state standard, Common Core-K). A skill may declare `standard_ids` to align to one
or more standards across one or more frameworks; the loader rejects ids with no
standard record (same reference check as everything else).

- **Alignment lives on the skill (the objective), not on activities/worksheets.**
  Leaves inherit coverage transitively through `supported_skill_ids`. This is the
  mirror of methodology, which lives on the leaf. Two separate axes: methodology =
  how it's taught; standard = which external objective it meets.
- **A standard captures the goal's full structure, not just its title.** ELOF is
  Domain → Sub-domain → Goal → developmental-progression **Indicators**. So a
  `standard` record carries `domain_area`, `sub_domain`, the goal `title`, and an
  `indicators[]` list (each `{ text, age_period? }`). Infant/toddler goals give the
  progression across age periods (Birth–9mo, 8–18mo, 16–36mo) → `age_period` is set;
  preschooler indicators omit it. ELOF has BOTH an infant/toddler goal set
  (`age_band: infant-toddler`, e.g. math under Cognition → Emergent Mathematical
  Thinking) and a preschooler set (`age_band: preschooler`, e.g. Mathematics
  Development); `related_standard_ids` links a goal to its counterpart across that
  continuum. Indicators are the high-value payload — they seed/strengthen skills'
  `mastery_criteria` and `observation_prompts` and reveal where to split skills.
- **Reliability:** a standard's `title` and every indicator are _verbatim_ from the
  framework's authoritative source, with `source_url`. Seed ONLY from that source —
  secondary reproductions drift (a fetched "ELOF" PDF listed coin/time goals that
  aren't in the federal framework). HeadStart.gov blocks automated clients (the data
  is public to a browser, not to a fetcher), so indicator bodies are transcribed
  from the official ELOF, not scraped. ELOF is a U.S. federal work (public domain);
  CCSS is reproducible with attribution; state standards are per-state.
- **No UI yet (by product decision):** standards are a background data layer.
  `pnpm coverage` reports, per framework, which standards are covered vs. gaps and
  which skills are unmapped — the data a future curriculum-builder queries.

## Changing content

Run `pnpm validate` (schema + graph) — it is the content gate. Add new fields to
the schema first, then the content, then a test if the rule is non-trivial.
