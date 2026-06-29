import { describe, it, expect } from "vitest";
import { schemaKinds, changesetOperationNames } from "@earlyatlas/curriculum-schema";
import { listResources, readResource } from "./resources.js";
import { getCurriculum } from "../curriculum.js";
import type { McpContext } from "./context.js";

const ctx = (): McpContext => ({
  store: getCurriculum(),
  drafts: new Map(),
  baseUrl: "http://test",
});

/**
 * Anti-drift gate: the MCP gateway must stay grounded in the Zod schema so an
 * agent that discovers the model through the server gets the truth. These fail
 * the build if the schema gains a kind or change-set op that the gateway (and
 * thus the docs agents read) doesn't reflect.
 */
describe("MCP surface is grounded in the schema (anti-drift)", () => {
  it("exposes a generated schema resource for every validating kind", () => {
    const uris = new Set(listResources().map((r) => r.uri));
    for (const kind of schemaKinds()) {
      expect(uris.has(`earlyatlas://schema/${kind}`)).toBe(true);
    }
  });

  it("each schema resource is valid generated JSON Schema", () => {
    for (const kind of schemaKinds()) {
      const res = readResource(`earlyatlas://schema/${kind}`, ctx());
      expect(res).not.toBeNull();
      expect(() => JSON.parse(res!.text)).not.toThrow();
    }
  });

  it("documents every change-set operation, with none left undocumented", () => {
    const text = readResource("earlyatlas://guide/changesets", ctx())!.text;
    for (const op of changesetOperationNames()) expect(text).toContain(op);
    expect(text).not.toContain("undocumented operation");
  });
});
