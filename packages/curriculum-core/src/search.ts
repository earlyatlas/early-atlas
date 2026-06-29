import type { CurriculumStore, LoadedRecord } from "./types.js";
import type { RecordKind } from "@earlyatlas/curriculum-schema";

export interface SearchQuery {
  text?: string;
  kind?: RecordKind;
  domainId?: string;
  /** Age in months the record must cover. */
  ageMonths?: number;
  status?: string;
  limit?: number;
}

export interface SearchHit {
  id: string;
  kind: RecordKind;
  title: string;
  snippet: string;
  status: string;
}

const TEXT_FIELDS = [
  "title",
  "short_description",
  "summary",
  "description",
  "developmental_purpose",
];

/** Lightweight in-memory search. Pagefind/Meilisearch replace this at scale. */
export function search(store: CurriculumStore, q: SearchQuery): SearchHit[] {
  const text = q.text?.trim().toLowerCase();
  const hits: SearchHit[] = [];

  for (const rec of store.records.values()) {
    if (q.kind && rec.kind !== q.kind) continue;
    if (q.status && (rec.data.status ?? "draft") !== q.status) continue;
    if (q.domainId && !recordInDomain(rec, q.domainId)) continue;
    if (typeof q.ageMonths === "number" && !coversAge(rec, q.ageMonths)) continue;

    if (text) {
      const haystack = textOf(rec).toLowerCase();
      if (!haystack.includes(text)) continue;
    }

    hits.push({
      id: rec.id,
      kind: rec.kind,
      title: rec.data.title ?? rec.id,
      snippet: (rec.data.short_description ?? rec.data.summary ?? rec.data.description ?? "").slice(
        0,
        200,
      ),
      status: rec.data.status ?? "draft",
    });
  }

  hits.sort((a, b) => a.title.localeCompare(b.title));
  return typeof q.limit === "number" ? hits.slice(0, q.limit) : hits;
}

function textOf(rec: LoadedRecord): string {
  const parts: string[] = [rec.id];
  for (const f of TEXT_FIELDS) if (typeof rec.data[f] === "string") parts.push(rec.data[f]);
  if (rec.body) parts.push(rec.body);
  return parts.join("\n");
}

function recordInDomain(rec: LoadedRecord, domainId: string): boolean {
  if (rec.kind === "domain") return rec.id === domainId;
  if (Array.isArray(rec.data.domain_ids)) return rec.data.domain_ids.includes(domainId);
  return false;
}

function coversAge(rec: LoadedRecord, months: number): boolean {
  const range = rec.data.age_range_months ?? rec.data.age_coverage;
  if (!range || typeof range.min !== "number") return false;
  return months >= range.min && months <= range.max;
}
