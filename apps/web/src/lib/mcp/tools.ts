import {
  search,
  validateChangeset,
  changesetSchema,
  type Changeset,
} from "@earlyatlas/curriculum-core";
import type { McpContext } from "./context.js";

/**
 * Tool definitions are deliberately terse. Each description is one line and ends
 * with a pointer to an MCP resource that documents it fully. The input schemas
 * carry only the essential parameters; the operation catalog, field references,
 * and examples live in resources, not here — so `tools/list` stays small.
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any, ctx: McpContext) => { text: string; isError?: boolean };
}

function obj(properties: Record<string, any>, required: string[] = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function normalizeMethodology(v?: string): string | undefined {
  return v
    ?.trim()
    .toLowerCase()
    .replace(/^ea\.methodology\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function coversAge(data: Record<string, any>, months?: number): boolean {
  if (typeof months !== "number") return true;
  const range = data.age_range_months ?? data.age_coverage;
  return Boolean(
    range && typeof range.min === "number" && months >= range.min && months <= range.max,
  );
}

function recordText(data: Record<string, any>): string {
  const parts: string[] = [];
  for (const v of Object.values(data)) {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) parts.push(v.filter((x) => typeof x === "string").join(" "));
  }
  return parts.join(" ").toLowerCase();
}

function titleOf(ctx: McpContext, id: string): string {
  return ctx.store.records.get(id)?.data.title ?? id;
}

function activityDomains(ctx: McpContext, activity: Record<string, any>) {
  const domainIds = new Set<string>();
  for (const skillId of arr(activity.supported_skill_ids)) {
    const skill = ctx.store.records.get(skillId);
    for (const domainId of arr(skill?.data.domain_ids)) domainIds.add(domainId);
  }
  return [...domainIds].map((id) => ({ id, title: titleOf(ctx, id) }));
}

function lessonOptions(ctx: McpContext, ageMonths?: number) {
  const activities = [...ctx.store.records.values()].filter(
    (r) =>
      r.kind === "activity" &&
      (r.data.status ?? "draft") === "accepted" &&
      coversAge(r.data, ageMonths),
  );
  const domainIds = new Set<string>();
  const methodologySlugs = new Set<string>();
  for (const activity of activities) {
    for (const domain of activityDomains(ctx, activity.data)) domainIds.add(domain.id);
    for (const methodology of arr(activity.data.methodologies)) methodologySlugs.add(methodology);
  }
  return {
    domains: [...domainIds]
      .sort((a, b) => titleOf(ctx, a).localeCompare(titleOf(ctx, b)))
      .map((id) => ({ id, title: titleOf(ctx, id) })),
    methodologies: [...methodologySlugs]
      .sort((a, b) =>
        titleOf(ctx, `ea.methodology.${a}`).localeCompare(titleOf(ctx, `ea.methodology.${b}`)),
      )
      .map((slug) => ({
        slug,
        title: titleOf(ctx, `ea.methodology.${slug}`),
        description: ctx.store.records.get(`ea.methodology.${slug}`)?.data.short_description ?? "",
      })),
  };
}

const TOOLS: McpTool[] = [
  {
    name: "search_curriculum",
    description:
      "Find existing domains, skills, activities, or citations. Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({
      query: { type: "string" },
      kind: { type: "string", enum: ["domain", "skill", "activity", "citation"] },
      domain_id: { type: "string" },
      age_months: { type: "integer" },
      limit: { type: "integer" },
    }),
    handler: (args, ctx) => {
      const hits = search(ctx.store, {
        text: args.query,
        kind: args.kind,
        domainId: args.domain_id,
        ageMonths: args.age_months,
        limit: args.limit ?? 25,
      });
      return { text: JSON.stringify(hits, null, 2) };
    },
  },
  {
    name: "get_record",
    description: "Fetch one record (fields + body) by id. Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({ id: { type: "string" } }, ["id"]),
    handler: (args, ctx) => {
      const rec = ctx.store.records.get(args.id);
      if (!rec) return { text: `No record with id ${args.id}`, isError: true };
      return { text: JSON.stringify({ ...rec.data, _body: rec.body }, null, 2) };
    },
  },
  {
    name: "get_related",
    description:
      "Resolve a record's prerequisites, related skills, activities, and citations. Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({ id: { type: "string" } }, ["id"]),
    handler: (args, ctx) => {
      const rec = ctx.store.records.get(args.id);
      if (!rec) return { text: `No record with id ${args.id}`, isError: true };
      const resolve = (ids?: string[]) =>
        (ids ?? []).map((id) => ({ id, title: ctx.store.records.get(id)?.data.title ?? null }));
      return {
        text: JSON.stringify(
          {
            prerequisites: resolve(rec.data.prerequisite_skill_ids),
            related: resolve(rec.data.related_skill_ids),
            supporting_activities: resolve(rec.data.supporting_activity_ids),
            supported_skills: resolve(rec.data.supported_skill_ids),
            citations: resolve(rec.data.research_reference_ids),
          },
          null,
          2,
        ),
      };
    },
  },
  {
    name: "recommend_activity",
    description:
      "Choose a child-ready activity by age, domain, and approach. Usage: read earlyatlas://guide/lesson-planning.",
    inputSchema: obj({
      age_months: { type: "integer" },
      domain_id: { type: "string" },
      methodology: { type: "string" },
      query: { type: "string" },
      limit: { type: "integer" },
    }),
    handler: (args, ctx) => {
      const ageMonths = typeof args.age_months === "number" ? args.age_months : undefined;
      const methodology = normalizeMethodology(args.methodology);
      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const limit = Math.min(Math.max(args.limit ?? 3, 1), 8);
      const options = lessonOptions(ctx, ageMonths);

      if (typeof ageMonths !== "number") {
        return {
          text: JSON.stringify(
            {
              needs_input: ["age_months"],
              ask_human:
                "How old is the child in months? If they give years, convert to months before searching.",
              options,
            },
            null,
            2,
          ),
        };
      }

      const candidates = [...ctx.store.records.values()]
        .filter((r) => r.kind === "activity")
        .filter((r) => (r.data.status ?? "draft") === "accepted")
        .filter((r) => coversAge(r.data, ageMonths))
        .filter((r) => !methodology || arr(r.data.methodologies).includes(methodology))
        .filter((r) => {
          if (!args.domain_id) return true;
          return activityDomains(ctx, r.data).some((d) => d.id === args.domain_id);
        })
        .filter((r) => !query || recordText(r.data).includes(query));

      const recommendations = candidates
        .sort((a, b) => {
          const durationA = a.data.duration_minutes ?? 999;
          const durationB = b.data.duration_minutes ?? 999;
          return durationA - durationB || String(a.data.title).localeCompare(String(b.data.title));
        })
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          title: r.data.title,
          summary: r.data.summary,
          age_range_months: r.data.age_range_months,
          duration_minutes: r.data.duration_minutes ?? null,
          group_size: r.data.group_size ?? null,
          domains: activityDomains(ctx, r.data),
          methodologies: arr(r.data.methodologies).map((slug) => ({
            slug,
            title: titleOf(ctx, `ea.methodology.${slug}`),
          })),
          supported_skills: arr(r.data.supported_skill_ids).map((id) => ({
            id,
            title: titleOf(ctx, id),
          })),
          materials: arr(r.data.materials),
          steps: arr(r.data.steps),
          safety_notes: arr(r.data.safety_notes),
          accessibility_notes: arr(r.data.accessibility_notes),
          present_to_human: {
            title: r.data.title,
            why_it_fits: r.data.summary,
            time: r.data.duration_minutes ? `${r.data.duration_minutes} minutes` : "Flexible",
            materials: arr(r.data.materials).slice(0, 5),
            steps: arr(r.data.steps).slice(0, 6),
          },
        }));

      return {
        text: JSON.stringify(
          {
            filters: {
              age_months: ageMonths,
              domain_id: args.domain_id ?? null,
              methodology: methodology ?? null,
              query: query || null,
            },
            options,
            recommendations,
            guidance:
              "Show the human 2-3 choices when possible, using titles and plain descriptions. Do not show record ids unless asked.",
          },
          null,
          2,
        ),
      };
    },
  },
  {
    name: "create_draft_changeset",
    description:
      "Draft a proposal (no files written). Operation catalog: read earlyatlas://guide/changesets.",
    inputSchema: obj(
      {
        title: { type: "string" },
        rationale: { type: "string" },
        operations: { type: "array", items: { type: "object" } },
      },
      ["operations"],
    ),
    handler: (args, ctx) => {
      const id = `cs_${crypto.randomUUID().slice(0, 8)}`;
      const candidate = {
        id,
        title: args.title,
        rationale: args.rationale,
        operations: args.operations,
      };
      const parsed = changesetSchema.safeParse(candidate);
      if (!parsed.success) {
        return {
          text: JSON.stringify(
            {
              changeset_id: null,
              errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
            },
            null,
            2,
          ),
          isError: true,
        };
      }
      ctx.drafts.set(id, parsed.data as Changeset);
      const result = validateChangeset(ctx.store, parsed.data);
      return {
        text: JSON.stringify(
          {
            changeset_id: id,
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
          },
          null,
          2,
        ),
      };
    },
  },
  {
    name: "validate_changeset",
    description:
      "Re-check a draft against schemas and graph rules. Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({
      changeset_id: { type: "string" },
      changeset: { type: "object" },
    }),
    handler: (args, ctx) => {
      const cs = args.changeset ?? ctx.drafts.get(args.changeset_id);
      if (!cs) return { text: `Unknown changeset_id ${args.changeset_id}`, isError: true };
      return { text: JSON.stringify(validateChangeset(ctx.store, cs), null, 2) };
    },
  },
  {
    name: "preview_changeset",
    description:
      "Get a temporary browser preview URL for a draft. Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({ changeset_id: { type: "string" } }, ["changeset_id"]),
    handler: (args, ctx) => {
      const cs = ctx.drafts.get(args.changeset_id);
      if (!cs) return { text: `Unknown changeset_id ${args.changeset_id}`, isError: true };
      const result = validateChangeset(ctx.store, cs);
      return {
        text: JSON.stringify(
          {
            preview_url: `${ctx.baseUrl}/drafts/${args.changeset_id}`,
            valid: result.valid,
            affected: result.affected,
            note: "Preview is unlisted and not part of the published curriculum.",
          },
          null,
          2,
        ),
      };
    },
  },
  {
    name: "submit_changeset",
    description:
      "Open a draft GitHub pull request for editorial review (never merges). Usage: read earlyatlas://guide/tools.",
    inputSchema: obj({ changeset_id: { type: "string" }, author: { type: "string" } }, [
      "changeset_id",
    ]),
    handler: (args, ctx) => {
      const cs = ctx.drafts.get(args.changeset_id);
      if (!cs) return { text: `Unknown changeset_id ${args.changeset_id}`, isError: true };
      const result = validateChangeset(ctx.store, cs);
      if (!result.valid) {
        return {
          text: JSON.stringify({ submitted: false, errors: result.errors }, null, 2),
          isError: true,
        };
      }
      // This /mcp endpoint is a dev-only, unauthenticated scaffold — it does NOT
      // persist proposals. Be honest about that instead of claiming success: real
      // submission goes through the authenticated POST /api/proposals.
      return {
        text: JSON.stringify(
          {
            submitted: false,
            status: "not_implemented",
            validated: true,
            affected: result.affected,
            message:
              "This MCP endpoint is a dev-only scaffold and does not persist proposals. " +
              "To submit for review, call the authenticated POST /api/proposals on the authoring service.",
          },
          null,
          2,
        ),
        isError: true,
      };
    },
  },
];

export function listTools() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function callTool(name: string, args: any, ctx: McpContext) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  const result = tool.handler(args ?? {}, ctx);
  return { content: [{ type: "text", text: result.text }], isError: result.isError ?? false };
}
