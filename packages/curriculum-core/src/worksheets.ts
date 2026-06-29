import type { WorksheetGenerator } from "@earlyatlas/curriculum-schema";

/**
 * Turn a printable's generator spec into concrete content. Generation is
 * deterministic — seeded from the record id — so the static build is
 * reproducible and diffs are meaningful. Add a new worksheet type by adding a
 * branch here plus a generator variant in the schema.
 */

export interface ArithmeticProblem {
  a: number;
  b: number;
  op: "+" | "−";
  answer: number;
}
export interface MathWorksheet {
  kind: "arithmetic";
  problems: ArithmeticProblem[];
  layout: "vertical" | "horizontal";
  answerKey: boolean;
}
export interface HandwritingWorksheet {
  kind: "handwriting";
  rows: { target: string; traces: number }[];
}
export type WorksheetModel = MathWorksheet | HandwritingWorksheet;

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (next: () => number, min: number, max: number) =>
  min + Math.floor(next() * (max - min + 1));

export function generateWorksheet(gen: WorksheetGenerator, seed: string): WorksheetModel {
  if (gen.type === "handwriting") {
    const rows = gen.targets.flatMap((target) =>
      Array.from({ length: gen.rows_per_target }, () => ({
        target,
        traces: gen.traces_per_row,
      })),
    );
    return { kind: "handwriting", rows };
  }

  const next = rng(hashSeed(seed));
  const op = gen.operation === "subtraction" ? "−" : "+";
  const problems: ArithmeticProblem[] = [];
  let guard = 0;
  while (problems.length < gen.count && guard++ < gen.count * 50) {
    let a = randInt(next, gen.operand_min, gen.operand_max);
    let b = randInt(next, gen.operand_min, gen.operand_max);
    if (gen.operation === "subtraction" && b > a) [a, b] = [b, a]; // no negatives
    const answer = gen.operation === "subtraction" ? a - b : a + b;
    if (gen.max_result !== undefined && answer > gen.max_result) continue;
    problems.push({ a, b, op, answer });
  }
  return { kind: "arithmetic", problems, layout: gen.layout, answerKey: gen.answer_key };
}
