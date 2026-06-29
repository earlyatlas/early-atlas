import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { loadCurriculum } from "./load.js";
import { checkGraph } from "./load.js";
import { search } from "./search.js";
import { validateChangeset } from "./changeset.js";
import { pathForId } from "./write.js";
import { generateWorksheet } from "./worksheets.js";
import type { LoadedRecord } from "./types.js";
import type { WorksheetGenerator } from "@earlyatlas/curriculum-schema";

const CURRICULUM_ROOT = fileURLToPath(new URL("../../../curriculum", import.meta.url));

function rec(id: string, kind: any, data: Record<string, any>): LoadedRecord {
  return { id, kind, data: { id, ...data }, body: null, recordPath: id, bodyPath: id };
}

describe("loadCurriculum", () => {
  const store = loadCurriculum(CURRICULUM_ROOT);
  it("loads the sample curriculum with no issues", () => {
    expect(store.records.size).toBeGreaterThanOrEqual(8);
    expect(store.issues).toEqual([]);
  });
  it("includes the sample video media record", () => {
    expect(store.records.get("ea.media.youtube.sorting-colors-demo")?.kind).toBe("media");
  });
});

describe("checkGraph", () => {
  it("flags dangling references", () => {
    const m = new Map<string, LoadedRecord>([
      ["ea.skill.a.b", rec("ea.skill.a.b", "skill", { domain_ids: ["ea.domain.missing"] })],
    ]);
    expect(checkGraph(m).some((i) => /unknown id/.test(i.message))).toBe(true);
  });
  it("detects prerequisite cycles", () => {
    const m = new Map<string, LoadedRecord>([
      ["ea.skill.a", rec("ea.skill.a", "skill", { prerequisite_skill_ids: ["ea.skill.b"] })],
      ["ea.skill.b", rec("ea.skill.b", "skill", { prerequisite_skill_ids: ["ea.skill.a"] })],
    ]);
    expect(checkGraph(m).some((i) => /cycle/i.test(i.message))).toBe(true);
  });
});

describe("search", () => {
  const store = loadCurriculum(CURRICULUM_ROOT);
  it("matches by text", () => {
    const hits = search(store, { text: "color" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => typeof h.title === "string")).toBe(true);
  });
  it("filters by kind", () => {
    expect(search(store, { kind: "domain" }).every((h) => h.kind === "domain")).toBe(true);
  });
});

describe("validateChangeset", () => {
  const store = loadCurriculum(CURRICULUM_ROOT);
  it("accepts a valid new skill", () => {
    const result = validateChangeset(store, {
      id: "cs",
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
    });
    expect(result.valid).toBe(true);
  });
  it("rejects an edge to an unknown id", () => {
    const result = validateChangeset(store, {
      id: "cs",
      operations: [
        {
          op: "add_edge",
          from_id: "ea.skill.nope",
          to_id: "ea.domain.language",
          type: "related_to",
        },
      ],
    });
    expect(result.valid).toBe(false);
  });
});

describe("generateWorksheet", () => {
  const addition: WorksheetGenerator = {
    type: "arithmetic",
    operation: "addition",
    operand_min: 0,
    operand_max: 9,
    count: 20,
    layout: "vertical",
    answer_key: true,
  };

  it("is deterministic for a given id", () => {
    const a = generateWorksheet(addition, "ea.printable.math.x");
    const b = generateWorksheet(addition, "ea.printable.math.x");
    expect(a).toEqual(b);
  });

  it("produces in-range problems with correct answers", () => {
    const w = generateWorksheet(addition, "ea.printable.math.x");
    if (w.kind !== "arithmetic") throw new Error("expected arithmetic");
    expect(w.problems).toHaveLength(20);
    for (const p of w.problems) {
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.b).toBeLessThanOrEqual(9);
      expect(p.answer).toBe(p.a + p.b);
    }
  });

  it("never produces negative subtraction answers", () => {
    const sub: WorksheetGenerator = { ...addition, operation: "subtraction" };
    const w = generateWorksheet(sub, "ea.printable.math.sub");
    if (w.kind !== "arithmetic") throw new Error("expected arithmetic");
    expect(w.problems.every((p) => p.answer >= 0)).toBe(true);
  });

  it("expands handwriting targets into rows", () => {
    const hand: WorksheetGenerator = {
      type: "handwriting",
      targets: ["A", "B"],
      rows_per_target: 2,
      traces_per_row: 6,
      style: "dotted-thirds",
    };
    const w = generateWorksheet(hand, "ea.printable.lit.y");
    if (w.kind !== "handwriting") throw new Error("expected handwriting");
    expect(w.rows).toHaveLength(4);
    expect(w.rows.every((r) => r.traces === 6)).toBe(true);
  });
});

describe("pathForId", () => {
  it("maps ids to record.yaml paths", () => {
    expect(pathForId("/root", "ea.skill.mathematics.classification.sorts-by-color")).toBe(
      "/root/skills/mathematics/classification/sorts-by-color/record.yaml",
    );
    expect(pathForId("/root", "ea.media.youtube.demo")).toBe(
      "/root/media/youtube/demo/record.yaml",
    );
  });
});
