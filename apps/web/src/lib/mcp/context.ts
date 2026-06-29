import type { CurriculumStore, Changeset } from "@earlyatlas/curriculum-core";

/** Per-request context handed to every tool and resource handler. */
export interface McpContext {
  store: CurriculumStore;
  /** In-memory draft change sets, keyed by change-set id (scaffold storage). */
  drafts: Map<string, Changeset>;
  /** Absolute base URL of this server, e.g. http://localhost:4321 */
  baseUrl: string;
}

/** Process-wide draft store. A real deployment would persist + scope these. */
export const drafts = new Map<string, Changeset>();
