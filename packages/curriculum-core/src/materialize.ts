// Materialize a validated change set into curriculum files, using the canonical
// writeRecord (so the output matches repo conventions exactly — no drift). Run by
// the GitHub Action that turns an approved proposal into a reviewable PR.
//
//   node --import tsx src/materialize.ts <changeset.json> [curriculumRoot]
//
// Prints the written file paths to stderr; exits non-zero on any unknown id so
// the workflow fails loudly instead of producing a half-applied PR.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Changeset } from "@earlyatlas/curriculum-schema";
import { loadCurriculum } from "./load.js";
import { writeRecord } from "./write.js";

const changesetPath = process.argv[2];
const root = resolve(process.argv[3] ?? "curriculum");
if (!changesetPath) {
  console.error("usage: materialize <changeset.json> [curriculumRoot]");
  process.exit(1);
}

const changeset = JSON.parse(readFileSync(changesetPath, "utf8")) as Changeset;
const store = loadCurriculum(root);
const written: string[] = [];

function must(id: string) {
  const ex = store.records.get(id);
  if (!ex) throw new Error(`unknown id: ${id}`);
  return ex;
}

for (const op of changeset.operations) {
  switch (op.op) {
    case "create_record": {
      const rec = op.record as Record<string, unknown> & { id: string };
      written.push(writeRecord(store, rec.id, rec).recordPath);
      break;
    }
    case "update_fields": {
      const ex = must(op.id);
      written.push(writeRecord(store, op.id, { ...ex.data, ...op.fields }, ex.body).recordPath);
      break;
    }
    case "replace_body": {
      const ex = must(op.id);
      written.push(writeRecord(store, op.id, ex.data, op.body).recordPath);
      break;
    }
    case "deprecate_record": {
      const ex = must(op.id);
      const data = {
        ...ex.data,
        status: "deprecated",
        ...(op.replaced_by ? { replaced_by: op.replaced_by } : {}),
      };
      written.push(writeRecord(store, op.id, data, ex.body).recordPath);
      break;
    }
    default:
      // add_edge isn't materialized here (relationship-field mapping is ambiguous);
      // the contributor form never emits it. Flagged for a reviewer.
      console.error(`! op "${(op as { op: string }).op}" not materialized (skipped)`);
  }
}

console.error(`materialized ${written.length} record(s):`);
for (const w of written) console.error("  " + w);
