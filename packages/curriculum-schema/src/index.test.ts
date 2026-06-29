import { describe, it, expect } from "vitest";
import {
  idSchema,
  skillSchema,
  youtubeMediaSchema,
  printableSchema,
  changesetSchema,
  kindFromId,
} from "./index.js";

describe("idSchema", () => {
  it("accepts well-formed ids", () => {
    expect(idSchema.safeParse("ea.skill.mathematics.classification.sorts-by-color").success).toBe(
      true,
    );
    expect(idSchema.safeParse("ea.media.youtube.demo").success).toBe(true);
  });
  it("rejects malformed ids", () => {
    expect(idSchema.safeParse("skill.foo").success).toBe(false);
    expect(idSchema.safeParse("ea.unknown.foo").success).toBe(false);
    expect(idSchema.safeParse("ea.skill.Has.Caps").success).toBe(false);
  });
});

describe("kindFromId", () => {
  it("derives the kind", () => {
    expect(kindFromId("ea.activity.practical-life.x")).toBe("activity");
    expect(kindFromId("ea.bogus.x")).toBeNull();
  });
});

describe("skillSchema", () => {
  const base = {
    id: "ea.skill.language.receptive.x",
    slug: "x",
    title: "X",
    short_description: "desc",
    domain_ids: ["ea.domain.language"],
    age_range_months: { min: 12, max: 24 },
  };
  it("accepts a minimal valid skill", () => {
    expect(skillSchema.safeParse(base).success).toBe(true);
  });
  it("requires at least one domain", () => {
    expect(skillSchema.safeParse({ ...base, domain_ids: [] }).success).toBe(false);
  });
  it("accepts tags and methodologies", () => {
    const parsed = skillSchema.safeParse({
      ...base,
      tags: ["colors", "sorting"],
      methodologies: ["montessori"],
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects an inverted age range", () => {
    expect(skillSchema.safeParse({ ...base, age_range_months: { min: 24, max: 12 } }).success).toBe(
      false,
    );
  });
});

describe("youtubeMediaSchema", () => {
  it("requires an 11-char video id", () => {
    const ok = {
      id: "ea.media.youtube.x",
      slug: "x",
      title: "X",
      provider: "youtube",
      youtube_id: "aqz-KE-bpKQ",
    };
    expect(youtubeMediaSchema.safeParse(ok).success).toBe(true);
    expect(youtubeMediaSchema.safeParse({ ...ok, youtube_id: "tooShort" }).success).toBe(false);
  });
});

describe("printableSchema", () => {
  it("accepts an arithmetic worksheet", () => {
    const ok = printableSchema.safeParse({
      id: "ea.printable.mathematics.x",
      slug: "x",
      title: "X",
      generator: {
        type: "arithmetic",
        operation: "addition",
        operand_min: 0,
        operand_max: 9,
        count: 20,
      },
    });
    expect(ok.success).toBe(true);
  });
  it("accepts a handwriting worksheet", () => {
    expect(
      printableSchema.safeParse({
        id: "ea.printable.literacy.y",
        slug: "y",
        title: "Y",
        generator: { type: "handwriting", targets: ["A", "B"] },
      }).success,
    ).toBe(true);
  });
  it("rejects an unknown operation and inverted operand range", () => {
    expect(
      printableSchema.safeParse({
        id: "ea.printable.mathematics.x",
        slug: "x",
        title: "X",
        generator: {
          type: "arithmetic",
          operation: "division",
          operand_min: 0,
          operand_max: 9,
          count: 5,
        },
      }).success,
    ).toBe(false);
    expect(
      printableSchema.safeParse({
        id: "ea.printable.mathematics.x",
        slug: "x",
        title: "X",
        generator: {
          type: "arithmetic",
          operation: "addition",
          operand_min: 9,
          operand_max: 0,
          count: 5,
        },
      }).success,
    ).toBe(false);
  });
});

describe("changesetSchema", () => {
  it("accepts a create_record operation", () => {
    const cs = {
      id: "cs1",
      operations: [{ op: "create_record", record: { id: "ea.skill.x.y" } }],
    };
    expect(changesetSchema.safeParse(cs).success).toBe(true);
  });
  it("rejects an unknown op and an empty operation list", () => {
    expect(changesetSchema.safeParse({ id: "cs1", operations: [] }).success).toBe(false);
    expect(changesetSchema.safeParse({ id: "cs1", operations: [{ op: "nope" }] }).success).toBe(
      false,
    );
  });
});
