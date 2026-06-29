import { describe, it, expect } from "vitest";
import { handleRpc } from "./server.js";
import { getCurriculum } from "../curriculum.js";
import type { McpContext } from "./context.js";

function ctx(): McpContext {
  return { store: getCurriculum(), drafts: new Map(), baseUrl: "http://test" };
}
const rpc = (method: string, params?: any, id: number | null = 1) =>
  handleRpc({ jsonrpc: "2.0", id, method, params } as any, ctx());

describe("MCP server", () => {
  it("initializes with server info", () => {
    const r: any = rpc("initialize", { protocolVersion: "2025-06-18" });
    expect(r.result.serverInfo.name).toBe("earlyatlas-authoring-gateway");
  });

  it("returns notifications with no body", () => {
    expect(
      handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" } as any, ctx()),
    ).toBeNull();
  });

  it("keeps the tool list small (token-lean gate)", () => {
    const r: any = rpc("tools/list");
    expect(r.result.tools).toHaveLength(8);
    // Objective gate: the whole tool list must stay well under the budget that
    // motivated the resource-pointer design. ~4 chars/token.
    const bytes = JSON.stringify(r.result.tools).length;
    expect(bytes).toBeLessThan(4000);
    for (const t of r.result.tools) {
      expect(t.description.length).toBeLessThan(160); // one line each
    }
  });

  it("reads a resource", () => {
    const r: any = rpc("resources/read", { uri: "earlyatlas://guide" });
    expect(r.result.contents[0].text).toContain("authoring gateway");
  });

  it("reads lesson-planning guidance", () => {
    const r: any = rpc("resources/read", { uri: "earlyatlas://guide/lesson-planning" });
    expect(r.result.contents[0].text).toContain("recommend_activity");
  });

  it("recommends activities without creating a draft", () => {
    const c = ctx();
    const r: any = handleRpc(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "recommend_activity",
          arguments: {
            age_months: 36,
            domain_id: "ea.domain.mathematics",
            methodology: "play-based",
            limit: 2,
          },
        },
      } as any,
      c,
    );
    const payload = JSON.parse(r.result.content[0].text);
    expect(payload.recommendations.length).toBeGreaterThan(0);
    expect(payload.recommendations[0].present_to_human.title).toBeTruthy();
    expect(c.drafts.size).toBe(0);
  });

  it("drafts and validates a change set server-side", () => {
    const c = ctx();
    const create: any = handleRpc(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "create_draft_changeset",
          arguments: {
            operations: [
              {
                op: "create_record",
                record: {
                  id: "ea.skill.mathematics.classification.sorts-by-shape",
                  slug: "sorts-by-shape",
                  title: "Sorts By Shape",
                  short_description: "Groups by shape.",
                  domain_ids: ["ea.domain.mathematics"],
                  age_range_months: { min: 30, max: 54 },
                },
              },
            ],
          },
        },
      } as any,
      c,
    );
    const payload = JSON.parse(create.result.content[0].text);
    expect(payload.valid).toBe(true);
    expect(payload.changeset_id).toBeTruthy();
  });

  it("rejects a bad change set", () => {
    const r: any = rpc("tools/call", {
      name: "validate_changeset",
      arguments: {
        changeset: {
          id: "x",
          operations: [
            {
              op: "add_edge",
              from_id: "ea.skill.nope",
              to_id: "ea.domain.language",
              type: "related_to",
            },
          ],
        },
      },
    });
    expect(JSON.parse(r.result.content[0].text).valid).toBe(false);
  });
});
