import {
  changesetSchema,
  schemaByKind,
  kindFromId,
  type Changeset,
} from "@earlyatlas/curriculum-schema";
import { checkGraph } from "./load.js";
import type { CurriculumStore, LoadedRecord } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Ids the change set creates, updates, or deprecates. */
  affected: string[];
}

/**
 * Validate a change set against the schemas and the *resulting* graph, without
 * writing any files. Server-side validation runs even when an agent claims it
 * already validated — see docs/06 safety rules.
 */
export function validateChangeset(store: CurriculumStore, input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const affected = new Set<string>();

  const parsed = changesetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      warnings,
      affected: [],
    };
  }
  const changeset = parsed.data;

  // Apply onto a clone so we can validate the resulting world.
  const draft = cloneRecords(store.records);

  for (const [i, op] of changeset.operations.entries()) {
    const where = `operations[${i}] (${op.op})`;
    switch (op.op) {
      case "create_record": {
        const id = (op.record as any).id;
        const kind = typeof id === "string" ? kindFromId(id) : null;
        if (!kind) {
          errors.push(`${where}: record has missing/invalid id`);
          break;
        }
        if (draft.has(id)) errors.push(`${where}: id already exists: ${id}`);
        const schema = schemaByKind[kind as keyof typeof schemaByKind];
        if (schema) {
          const r = schema.safeParse(op.record);
          if (!r.success) {
            for (const issue of r.error.issues)
              errors.push(`${where}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
            break;
          }
          draft.set(id, syntheticRecord(id, kind, r.data));
        } else {
          draft.set(id, syntheticRecord(id, kind, op.record));
        }
        affected.add(id);
        break;
      }
      case "update_fields": {
        const target = draft.get(op.id);
        if (!target) {
          errors.push(`${where}: unknown id ${op.id}`);
          break;
        }
        const merged = { ...target.data, ...op.fields };
        const schema = schemaByKind[target.kind as keyof typeof schemaByKind];
        if (schema) {
          const r = schema.safeParse(merged);
          if (!r.success) {
            for (const issue of r.error.issues)
              errors.push(`${where}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
            break;
          }
          draft.set(op.id, { ...target, data: r.data });
        } else {
          draft.set(op.id, { ...target, data: merged });
        }
        affected.add(op.id);
        break;
      }
      case "replace_body": {
        const target = draft.get(op.id);
        if (!target) errors.push(`${where}: unknown id ${op.id}`);
        else draft.set(op.id, { ...target, body: op.body });
        affected.add(op.id);
        break;
      }
      case "deprecate_record": {
        const target = draft.get(op.id);
        if (!target) {
          errors.push(`${where}: unknown id ${op.id}`);
          break;
        }
        if (op.replaced_by && !draft.has(op.replaced_by))
          warnings.push(`${where}: replaced_by points at not-yet-existing id ${op.replaced_by}`);
        draft.set(op.id, {
          ...target,
          data: { ...target.data, status: "deprecated", replaced_by: op.replaced_by },
        });
        affected.add(op.id);
        break;
      }
      case "add_edge": {
        if (!draft.has(op.from_id)) errors.push(`${where}: unknown from_id ${op.from_id}`);
        if (!draft.has(op.to_id)) errors.push(`${where}: unknown to_id ${op.to_id}`);
        affected.add(op.from_id);
        break;
      }
    }
  }

  // Re-run graph checks on the resulting world (cycles, dangling refs).
  for (const issue of checkGraph(draft)) {
    errors.push(`graph: ${issue.id ?? ""} ${issue.message}`.trim());
  }

  return { valid: errors.length === 0, errors, warnings, affected: [...affected] };
}

/** A merged view of the curriculum with the change set applied (for previews). */
export function applyChangeset(store: CurriculumStore, changeset: Changeset): CurriculumStore {
  const draft = cloneRecords(store.records);
  for (const op of changeset.operations) {
    switch (op.op) {
      case "create_record": {
        const id = (op.record as any).id;
        const kind = kindFromId(id);
        if (id && kind) draft.set(id, syntheticRecord(id, kind, op.record));
        break;
      }
      case "update_fields": {
        const t = draft.get(op.id);
        if (t) draft.set(op.id, { ...t, data: { ...t.data, ...op.fields } });
        break;
      }
      case "replace_body": {
        const t = draft.get(op.id);
        if (t) draft.set(op.id, { ...t, body: op.body });
        break;
      }
      case "deprecate_record": {
        const t = draft.get(op.id);
        if (t)
          draft.set(op.id, {
            ...t,
            data: { ...t.data, status: "deprecated", replaced_by: op.replaced_by },
          });
        break;
      }
    }
  }
  return { ...store, records: draft, issues: [] };
}

function cloneRecords(src: Map<string, LoadedRecord>): Map<string, LoadedRecord> {
  const out = new Map<string, LoadedRecord>();
  for (const [id, rec] of src) out.set(id, { ...rec, data: { ...rec.data } });
  return out;
}

function syntheticRecord(id: string, kind: string, data: any): LoadedRecord {
  return {
    id,
    kind: kind as any,
    data,
    body: null,
    recordPath: `<changeset:${id}>`,
    bodyPath: `<changeset:${id}>`,
  };
}
