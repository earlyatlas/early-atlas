import type { McpContext } from "./context.js";
import { listTools, callTool } from "./tools.js";
import { listResources, readResource } from "./resources.js";

/**
 * A minimal, spec-compliant MCP server over JSON-RPC 2.0. The HTTP route runs it
 * statelessly: POST a request, get a single JSON response. (Streamable HTTP's SSE
 * stream is optional for a tools/resources server, so GET returns 405.)
 */

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "earlyatlas-authoring-gateway", version: "0.1.0" };

const PROMPTS = [
  {
    name: "plan_activity_for_child",
    description: "Help a caregiver choose a developmentally appropriate activity.",
    arguments: [
      { name: "age", description: "Child age, such as 30 months or 3 years", required: false },
      { name: "domain", description: "Optional learning area, such as language", required: false },
      {
        name: "approach",
        description: "Optional methodology, such as Montessori",
        required: false,
      },
    ],
    render: (args: any) =>
      `Help the human choose an Early Atlas activity. First read ` +
      `earlyatlas://guide/lesson-planning. Known context: age="${args?.age ?? ""}", ` +
      `domain="${args?.domain ?? ""}", approach="${args?.approach ?? ""}". ` +
      `If age is missing, ask for it. Offer compact domain and approach choices, ` +
      `then call recommend_activity. Present activity options in plain language ` +
      `without record ids or schema terms.`,
  },
  {
    name: "propose_new_skill",
    description: "Draft a well-formed new skill from an educator's plain-language idea.",
    arguments: [{ name: "idea", description: "What the child is learning", required: true }],
    render: (args: any) =>
      `An educator wants to add a skill: "${args?.idea ?? ""}".\n` +
      `First read earlyatlas://schema/skill and earlyatlas://guide/changesets. ` +
      `Search the curriculum for duplicates and for ids to link. Then build a ` +
      `create_draft_changeset, validate it, and preview it for the author.`,
  },
  {
    name: "improve_existing_record",
    description: "Suggest evidence-based improvements to an existing record.",
    arguments: [{ name: "id", description: "The record id to improve", required: true }],
    render: (args: any) =>
      `Review record ${args?.id ?? ""}. Use get_record and get_related, check it ` +
      `against earlyatlas://style-guide, then propose update_fields / replace_body ` +
      `operations in a draft change set and validate them.`,
  },
];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

function ok(id: any, result: any) {
  return { jsonrpc: "2.0" as const, id, result };
}
function err(id: any, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

export function handleRpc(msg: RpcRequest, ctx: McpContext) {
  const isNotification = msg.id === undefined || msg.id === null;

  switch (msg.method) {
    case "initialize":
      return ok(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Curriculum authoring gateway. Read resource earlyatlas://guide first; " +
          "tool descriptions point to the resources that document them.",
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notifications get no response body

    case "ping":
      return ok(msg.id, {});

    case "tools/list":
      return ok(msg.id, { tools: listTools() });

    case "tools/call": {
      const { name, arguments: args } = msg.params ?? {};
      return ok(msg.id, callTool(name, args, ctx));
    }

    case "resources/list":
      return ok(msg.id, { resources: listResources() });

    case "resources/read": {
      const contents = readResource(msg.params?.uri, ctx);
      if (!contents) return err(msg.id, -32602, `Unknown resource: ${msg.params?.uri}`);
      return ok(msg.id, { contents: [contents] });
    }

    case "prompts/list":
      return ok(msg.id, {
        prompts: PROMPTS.map(({ name, description, arguments: a }) => ({
          name,
          description,
          arguments: a,
        })),
      });

    case "prompts/get": {
      const prompt = PROMPTS.find((p) => p.name === msg.params?.name);
      if (!prompt) return err(msg.id, -32602, `Unknown prompt: ${msg.params?.name}`);
      return ok(msg.id, {
        description: prompt.description,
        messages: [
          { role: "user", content: { type: "text", text: prompt.render(msg.params?.arguments) } },
        ],
      });
    }

    default:
      if (isNotification) return null;
      return err(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Handle a parsed JSON-RPC body (single message or batch). */
export function handleBody(body: unknown, ctx: McpContext) {
  if (Array.isArray(body)) {
    return body.map((m) => handleRpc(m as RpcRequest, ctx)).filter((r) => r !== null);
  }
  return handleRpc(body as RpcRequest, ctx);
}
