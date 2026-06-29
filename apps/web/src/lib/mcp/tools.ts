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
      // Phase 1 stub: a real GitHub App would create a branch + draft PR here.
      return {
        text: JSON.stringify(
          {
            submitted: true,
            status: "pending_github_app",
            message:
              "Change set validated. The GitHub App that materializes files and opens the draft PR is not yet configured in this scaffold.",
            would_branch: `ai-drafts/${args.author ?? "anon"}/${args.changeset_id}`,
            affected: result.affected,
          },
          null,
          2,
        ),
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
