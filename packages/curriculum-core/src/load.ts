import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import fg from "fast-glob";
import yaml from "js-yaml";
import { kindFromId, schemaByKind, type RecordKind } from "@earlyatlas/curriculum-schema";
import type { CurriculumStore, LoadIssue, LoadedRecord } from "./types.js";

/**
 * Load and validate every `record.yaml` under `root`. Always returns a store;
 * parse/validation problems are collected into `store.issues` rather than thrown,
 * so the site and gateway can render partial content and surface errors.
 */
export function loadCurriculum(root: string): CurriculumStore {
  const issues: LoadIssue[] = [];
  const records = new Map<string, LoadedRecord>();

  const files = fg.sync("**/record.yaml", { cwd: root, absolute: true });

  for (const recordPath of files) {
    let raw: unknown;
    try {
      raw = yaml.load(readFileSync(recordPath, "utf8"));
    } catch (err) {
      issues.push({ file: recordPath, message: `YAML parse error: ${(err as Error).message}` });
      continue;
    }

    if (!raw || typeof raw !== "object") {
      issues.push({ file: recordPath, message: "record.yaml is empty or not an object" });
      continue;
    }

    const id = (raw as any).id;
    const kind = typeof id === "string" ? kindFromId(id) : null;
    if (!kind) {
      issues.push({ file: recordPath, message: `Missing or unrecognized id: ${String(id)}` });
      continue;
    }

    const schema = schemaByKind[kind as keyof typeof schemaByKind];
    if (schema) {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({
            file: recordPath,
            id,
            message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          });
        }
        continue;
      }
      raw = parsed.data;
    }

    if (records.has(id)) {
      issues.push({
        file: recordPath,
        id,
        message: `Duplicate id (already defined in ${records.get(id)!.recordPath})`,
      });
      continue;
    }

    const bodyPath = join(dirname(recordPath), "body.mdx");
    const body = existsSync(bodyPath) ? readFileSync(bodyPath, "utf8") : null;

    records.set(id, {
      id,
      kind: kind as RecordKind,
      data: raw as Record<string, any>,
      body,
      recordPath,
      bodyPath,
    });
  }

  issues.push(...checkGraph(records));

  return { root, records, issues };
}

/** Cross-record integrity checks (referenced ids exist, no prerequisite cycles). */
export function checkGraph(records: Map<string, LoadedRecord>): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const has = (id: string) => records.has(id);

  const refFields = [
    "domain_ids",
    "prerequisite_skill_ids",
    "related_skill_ids",
    "supported_skill_ids",
    "supported_activity_ids",
    "supporting_activity_ids",
    "research_reference_ids",
    "media_ids",
    "printable_ids",
    "references",
    "standard_ids",
    "related_standard_ids",
  ];

  for (const rec of records.values()) {
    for (const field of refFields) {
      const ids = rec.data[field];
      if (!Array.isArray(ids)) continue;
      for (const ref of ids) {
        if (!has(ref)) {
          issues.push({
            file: rec.recordPath,
            id: rec.id,
            message: `${field} references unknown id: ${ref}`,
          });
        }
      }
    }
  }

  // Controlled methodology vocabulary: every `methodologies` key must resolve to
  // a methodology record (ea.methodology.<key>), so the approach has an
  // explanatory page and the term can't be misspelled or invented ad hoc.
  const methodologyKeys = new Set<string>();
  for (const rec of records.values()) {
    if (rec.kind === "methodology") {
      methodologyKeys.add(rec.data.slug ?? rec.id.split(".").pop());
    }
  }
  for (const rec of records.values()) {
    const ms = rec.data.methodologies;
    if (!Array.isArray(ms)) continue;
    for (const key of ms) {
      if (!methodologyKeys.has(key)) {
        issues.push({
          file: rec.recordPath,
          id: rec.id,
          message: `methodologies references unknown approach "${key}" (add a curriculum/methodologies/${key} record, i.e. ea.methodology.${key})`,
        });
      }
    }
  }

  // Prerequisite cycle detection across skills.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) {
      issues.push({
        file: records.get(id)?.recordPath ?? "",
        id,
        message: `Prerequisite cycle: ${[...stack, id].join(" -> ")}`,
      });
      return true;
    }
    visiting.add(id);
    stack.push(id);
    const prereqs = records.get(id)?.data.prerequisite_skill_ids ?? [];
    for (const p of prereqs) {
      if (records.has(p) && visit(p)) break;
    }
    stack.pop();
    visiting.delete(id);
    done.add(id);
    return false;
  };
  for (const rec of records.values()) {
    if (rec.kind === "skill") visit(rec.id);
  }

  return issues;
}
