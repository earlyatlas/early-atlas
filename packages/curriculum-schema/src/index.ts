import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * EarlyAtlas curriculum schemas.
 *
 * Records are authored as a structured `record.yaml` (validated here) plus an
 * optional human-readable `body.mdx`. IDs are permanent and independent of file
 * location — see docs/02-curriculum-model.md.
 */

export const RECORD_KINDS = [
  "domain",
  "skill",
  "activity",
  "citation",
  "assessment",
  "printable",
  "media",
  "methodology",
  "standard",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** e.g. ea.skill.mathematics.classification.sorts-by-color */
export const idSchema = z
  .string()
  .regex(
    /^ea\.(domain|skill|activity|citation|assessment|printable|media|methodology|standard)\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    "Invalid EarlyAtlas id (expected e.g. ea.skill.<domain>.<...>)",
  );

export const statusSchema = z.enum(["draft", "review", "accepted", "deprecated"]);

export const ageRangeSchema = z
  .object({
    min: z.number().int().min(0).max(216),
    max: z.number().int().min(0).max(216),
  })
  .refine((a) => a.max >= a.min, { message: "age_range_months.max must be >= min" });

export const reviewSchema = z
  .object({
    status: statusSchema.optional(),
    rationale: z.string().optional(),
    reviewed_by: z.string().optional(),
  })
  .optional();

export const domainSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  age_coverage: ageRangeSchema.optional(),
  subdomains: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: statusSchema.default("draft"),
  references: z.array(idSchema).optional(),
  locale: z.string().default("en-US"),
});
export type Domain = z.infer<typeof domainSchema>;

export const skillSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  short_description: z.string().min(1),
  developmental_purpose: z.string().optional(),
  domain_ids: z.array(idSchema).min(1, "a skill must belong to at least one domain"),
  age_range_months: ageRangeSchema,
  developmental_stage: z.string().optional(),
  prerequisite_skill_ids: z.array(idSchema).optional(),
  related_skill_ids: z.array(idSchema).optional(),
  mastery_criteria: z.array(z.string()).optional(),
  observation_prompts: z.array(z.string()).optional(),
  supporting_activity_ids: z.array(idSchema).optional(),
  materials: z.array(z.string()).optional(),
  accessibility_notes: z.array(z.string()).optional(),
  common_misconceptions: z.array(z.string()).optional(),
  safety_notes: z.array(z.string()).optional(),
  research_reference_ids: z.array(idSchema).optional(),
  media_ids: z.array(idSchema).optional(),
  printable_ids: z.array(idSchema).optional(),
  tags: z.array(z.string()).optional(),
  /** Pedagogical approach(es): e.g. montessori, waldorf, reggio-emilia, play-based. */
  methodologies: z.array(z.string()).optional(),
  /** External-standard alignment. Each id references a `standard` record
   *  (ea.standard.<framework>.<code>). Alignment is OPTIONAL and lives on the
   *  skill (the objective); activities/worksheets inherit it via the skill. A
   *  skill may map to several standards across several frameworks. */
  standard_ids: z.array(idSchema).optional(),
  status: statusSchema.default("draft"),
  review: reviewSchema,
  locale: z.string().default("en-US"),
});
export type Skill = z.infer<typeof skillSchema>;

export const activitySchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  supported_skill_ids: z.array(idSchema).min(1, "an activity must support at least one skill"),
  age_range_months: ageRangeSchema,
  group_size: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  materials: z.array(z.string()).optional(),
  setup: z.string().optional(),
  steps: z.array(z.string()).optional(),
  variations: z.array(z.string()).optional(),
  differentiation: z.array(z.string()).optional(),
  assessment_opportunities: z.array(z.string()).optional(),
  safety_notes: z.array(z.string()).optional(),
  accessibility_notes: z.array(z.string()).optional(),
  research_reference_ids: z.array(idSchema).optional(),
  media_ids: z.array(idSchema).optional(),
  tags: z.array(z.string()).optional(),
  methodologies: z.array(z.string()).optional(),
  status: statusSchema.default("draft"),
  locale: z.string().default("en-US"),
});
export type Activity = z.infer<typeof activitySchema>;

export const citationSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  doi: z.string().optional(),
  license: z.string().optional(),
  notes: z.string().optional(),
  evidence_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * Media is content for human viewers (lessons can have associated videos). The
 * first provider is YouTube; the shape is provider-discriminated so others
 * (e.g. Vimeo, self-hosted) can be added without breaking existing records.
 */
export const youtubeMediaSchema = z.object({
  id: idSchema, // ea.media.youtube.<slug>
  slug: z.string().min(1),
  title: z.string().min(1),
  provider: z.literal("youtube"),
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "youtube_id must be an 11-char video id"),
  description: z.string().optional(),
  duration_seconds: z.number().int().positive().optional(),
  /** Reverse links: skills/activities this video supports (optional — records
   *  may also reference media via their own media_ids). */
  supported_skill_ids: z.array(idSchema).optional(),
  attribution: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: statusSchema.default("draft"),
  locale: z.string().default("en-US"),
});
export const mediaSchema = z.discriminatedUnion("provider", [youtubeMediaSchema]);
export type Media = z.infer<typeof mediaSchema>;

// ---------------------------------------------------------------------------
// Printables — worksheets and other printable handouts. The content is described
// by a `generator` spec (not hand-listed), so one record produces a full sheet
// and the type is extensible (add a generator variant, not a new record model).
// ---------------------------------------------------------------------------

export const arithmeticGeneratorSchema = z.object({
  type: z.literal("arithmetic"),
  operation: z.enum(["addition", "subtraction"]),
  operand_min: z.number().int().min(0).max(9),
  operand_max: z.number().int().min(0).max(9),
  /** Cap the result (e.g. keep addition sums ≤ 10 for early learners). */
  max_result: z.number().int().min(0).optional(),
  count: z.number().int().min(1).max(60),
  layout: z.enum(["vertical", "horizontal"]).default("vertical"),
  answer_key: z.boolean().default(true),
});

export const handwritingGeneratorSchema = z.object({
  type: z.literal("handwriting"),
  /** Each target is a glyph/word to trace, e.g. "A", "Aa", or "cat". */
  targets: z.array(z.string().min(1)).min(1),
  rows_per_target: z.number().int().min(1).max(8).default(2),
  /** Number of letters per row: 1 solid model + the rest dashed to trace. */
  traces_per_row: z.number().int().min(2).max(12).default(6),
  style: z.literal("dotted-thirds").default("dotted-thirds"),
});

export const worksheetGeneratorSchema = z.discriminatedUnion("type", [
  arithmeticGeneratorSchema,
  handwritingGeneratorSchema,
]);
export type WorksheetGenerator = z.infer<typeof worksheetGeneratorSchema>;

export const printableSchema = z
  .object({
    id: idSchema, // ea.printable.<...>
    slug: z.string().min(1),
    title: z.string().min(1),
    printable_type: z.literal("worksheet").default("worksheet"),
    instructions: z.string().optional(),
    supported_skill_ids: z.array(idSchema).optional(),
    /** Optional: a worksheet may belong to specific activities (a supporting
     *  document for that activity), in addition to practicing the skill. */
    supported_activity_ids: z.array(idSchema).optional(),
    age_range_months: ageRangeSchema.optional(),
    generator: worksheetGeneratorSchema,
    tags: z.array(z.string()).optional(),
    methodologies: z.array(z.string()).optional(),
    status: statusSchema.default("draft"),
    locale: z.string().default("en-US"),
  })
  .superRefine((p, ctx) => {
    if (p.generator.type === "arithmetic" && p.generator.operand_max < p.generator.operand_min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "operand_max must be >= operand_min",
        path: ["generator", "operand_max"],
      });
    }
  });
export type Printable = z.infer<typeof printableSchema>;

/**
 * A pedagogical approach (Montessori, Waldorf, Reggio Emilia, play-based, …).
 * It is its OWN record kind so each approach has one explanatory page and a
 * controlled key. Records reference an approach by its `slug` in their
 * `methodologies` array; the loader rejects keys with no methodology record.
 *
 * Early Atlas is independent and unaffiliated: a methodology record describes a
 * tradition our lessons are *inspired by*, never an endorsement or official
 * curriculum. The UI always renders the non-affiliation disclaimer.
 */
export const methodologySchema = z.object({
  id: idSchema, // ea.methodology.<slug>
  slug: z.string().min(1),
  title: z.string().min(1),
  short_description: z.string().min(1),
  /** Key tenets of the approach, in plain language. */
  principles: z.array(z.string()).optional(),
  /** Factual origin (founder, era) — descriptive, not promotional. */
  origin: z.string().optional(),
  /** How Early Atlas lessons relate to this approach ("inspired by" framing). */
  inspiration_note: z.string().optional(),
  research_reference_ids: z.array(idSchema).optional(),
  tags: z.array(z.string()).optional(),
  status: statusSchema.default("draft"),
  locale: z.string().default("en-US"),
});
export type Methodology = z.infer<typeof methodologySchema>;

/**
 * An external standard/goal a skill can align to (Head Start ELOF goal, a state
 * early-learning standard, Common Core-K, …). It is its own record kind so each
 * standard is transcribed ONCE from its authoritative source (with `source_url`),
 * gets a stable id, and can be referenced without drift. Alignment is a separate
 * axis from methodology: methodology = how a lesson is taught (on the leaf);
 * standard = which external objective a skill meets (on the skill).
 *
 * Reliability rule: `title` is the verbatim official goal text; never paraphrase
 * from memory or a secondary reproduction — seed from the framework's own source.
 */
/**
 * One indicator from a standard's developmental progression — an observable
 * behavior. Verbatim from the source. For infant/toddler goals, ELOF gives the
 * progression across age periods, captured in `age_period`; preschooler
 * indicators omit it.
 */
export const standardIndicatorSchema = z.object({
  text: z.string().min(1),
  age_period: z.string().optional(), // e.g. "Birth to 9 Months", "8 to 18 Months", "16 to 36 Months"
});

export const standardSchema = z.object({
  id: idSchema, // ea.standard.<framework>.<code-slug>, e.g. ea.standard.elof.p-math-1
  framework: z.string().min(1), // e.g. "elof", "ccss-k", "state-ca-plf"
  framework_title: z.string().optional(), // e.g. "Head Start Early Learning Outcomes Framework"
  code: z.string().min(1), // official code, e.g. "P-MATH 1"
  title: z.string().min(1), // verbatim official goal statement
  description: z.string().optional(),
  domain_area: z.string().optional(), // framework's domain, e.g. "Mathematics Development"
  sub_domain: z.string().optional(), // framework's sub-domain, e.g. "Counting and Cardinality"
  age_band: z.string().optional(), // "preschooler" | "infant-toddler" | ...
  /** The goal's developmental progression — its observable indicators, verbatim. */
  indicators: z.array(standardIndicatorSchema).optional(),
  /** Continuum + relationships: e.g. an infant/toddler goal linked to its
   *  preschooler counterpart, or related goals in adjacent sub-domains. */
  related_standard_ids: z.array(idSchema).optional(),
  source_url: z.string().url().optional(),
  attribution: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: statusSchema.default("draft"),
  locale: z.string().default("en-US"),
});
export type StandardIndicator = z.infer<typeof standardIndicatorSchema>;
export type Standard = z.infer<typeof standardSchema>;

/** Map a record kind to its schema. */
export const schemaByKind = {
  domain: domainSchema,
  skill: skillSchema,
  activity: activitySchema,
  citation: citationSchema,
  media: mediaSchema,
  printable: printableSchema,
  methodology: methodologySchema,
  standard: standardSchema,
} as const;

/** Derive the record kind from an id. */
export function kindFromId(id: string): RecordKind | null {
  const m = /^ea\.([a-z]+)\./.exec(id);
  const k = m?.[1] as RecordKind | undefined;
  return k && (RECORD_KINDS as readonly string[]).includes(k) ? k : null;
}

// ---------------------------------------------------------------------------
// Change sets — the structured proposal format AI agents and the editor produce.
// Files are materialized only after validation. See docs/06-ai-authoring-...md.
// ---------------------------------------------------------------------------

export const EDGE_TYPES = [
  "prerequisite_of",
  "related_to",
  "supports",
  "assesses",
  "adapts",
  "aligned_to",
  "replaces",
] as const;

export const operationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_record"),
    record: z.record(z.any()),
  }),
  z.object({
    op: z.literal("update_fields"),
    id: idSchema,
    fields: z.record(z.any()),
  }),
  z.object({
    op: z.literal("replace_body"),
    id: idSchema,
    body: z.string(),
  }),
  z.object({
    op: z.literal("deprecate_record"),
    id: idSchema,
    replaced_by: idSchema.optional(),
  }),
  z.object({
    op: z.literal("add_edge"),
    from_id: idSchema,
    to_id: idSchema,
    type: z.enum(EDGE_TYPES),
    rationale: z.string().optional(),
  }),
]);
export type Operation = z.infer<typeof operationSchema>;

export const changesetSchema = z.object({
  id: z.string().min(1),
  author: z.string().optional(),
  base: z.string().optional(),
  title: z.string().optional(),
  rationale: z.string().optional(),
  operations: z.array(operationSchema).min(1, "a change set needs at least one operation"),
});
export type Changeset = z.infer<typeof changesetSchema>;

// ---------------------------------------------------------------------------
// Derived truth. These functions generate machine-readable artifacts FROM the
// Zod schemas above, so anything that documents the model (the MCP gateway, the
// site, generated docs) reads from one source and cannot drift. Do not hand-copy
// field lists or operation names elsewhere — derive them from here.
// ---------------------------------------------------------------------------

/** Kinds that have a validating schema (vs. reserved-but-unmodeled kinds). */
export function schemaKinds(): RecordKind[] {
  return Object.keys(schemaByKind) as RecordKind[];
}

/** JSON Schema for a record kind, generated from its Zod schema. */
export function jsonSchemaFor(kind: RecordKind): unknown | null {
  const schema = (schemaByKind as Record<string, z.ZodTypeAny>)[kind];
  return schema ? zodToJsonSchema(schema, { name: kind, $refStrategy: "none" }) : null;
}

/** The change-set operation names, derived from `operationSchema`. */
export function changesetOperationNames(): string[] {
  return (operationSchema.options as readonly z.ZodObject<{ op: z.ZodLiteral<string> }>[]).map(
    (o) => o.shape.op.value,
  );
}
