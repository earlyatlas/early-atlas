import type { RecordKind } from "@earlyatlas/curriculum-schema";

/** A loaded curriculum record: validated front-matter plus optional MDX body. */
export interface LoadedRecord {
  id: string;
  kind: RecordKind;
  /** The validated structured record (record.yaml). */
  data: Record<string, any>;
  /** Raw MDX body, if a body.mdx exists alongside record.yaml. */
  body: string | null;
  /** Absolute path to record.yaml (the loader's home for this record). */
  recordPath: string;
  /** Absolute path to body.mdx (whether or not it exists). */
  bodyPath: string;
}

export interface LoadIssue {
  /** File the issue came from (record.yaml path), or "" for store-level checks. */
  file: string;
  id?: string;
  message: string;
}

export interface CurriculumStore {
  /** Absolute path to the curriculum/ root. */
  root: string;
  records: Map<string, LoadedRecord>;
  /** Validation/parse issues collected while loading. Empty means a clean load. */
  issues: LoadIssue[];
}
