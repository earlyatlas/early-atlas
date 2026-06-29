import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { kindFromId, type RecordKind } from "@earlyatlas/curriculum-schema";
import type { CurriculumStore } from "./types.js";

const DIR_BY_KIND: Record<RecordKind, string> = {
  domain: "domains",
  skill: "skills",
  activity: "activities",
  citation: "citations",
  assessment: "assessments",
  printable: "printables",
  media: "media",
  methodology: "methodologies",
  standard: "standards",
};

/**
 * Compute the canonical `record.yaml` path for an id, independent of any
 * existing file. e.g. ea.skill.math.classification.sorts-by-color ->
 * curriculum/skills/math/classification/sorts-by-color/record.yaml
 */
export function pathForId(root: string, id: string): string {
  const kind = kindFromId(id);
  if (!kind) throw new Error(`Cannot derive a path for invalid id: ${id}`);
  const segments = id.split(".").slice(2); // drop "ea" and the kind
  return join(root, DIR_BY_KIND[kind], ...segments, "record.yaml");
}

export interface WriteResult {
  recordPath: string;
  bodyPath: string | null;
}

/**
 * Write a record (and optional MDX body) to the working tree. This is the
 * editor's "local preview" write path — production changes flow through change
 * sets and pull requests instead. Existing records keep their current file
 * location; new records are placed by {@link pathForId}.
 */
export function writeRecord(
  store: CurriculumStore,
  id: string,
  data: Record<string, any>,
  body?: string | null,
): WriteResult {
  const existing = store.records.get(id);
  const recordPath =
    existing?.recordPath.startsWith("<") || !existing
      ? pathForId(store.root, id)
      : existing.recordPath;

  mkdirSync(dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, yaml.dump(data, { lineWidth: 100, noRefs: true }), "utf8");

  let bodyPath: string | null = null;
  if (typeof body === "string") {
    bodyPath = join(dirname(recordPath), "body.mdx");
    writeFileSync(bodyPath, body, "utf8");
  }

  return { recordPath, bodyPath };
}
