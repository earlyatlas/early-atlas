import { getCurriculum } from "./curriculum.js";
import type { LoadedRecord, CurriculumStore } from "@earlyatlas/curriculum-core";

export interface Crumb {
  title: string;
  href: string;
}

/** Human-facing type word for a record kind (used in search + breadcrumbs). */
export function typeLabel(kind: string): string {
  const map: Record<string, string> = {
    domain: "Domain",
    skill: "Skill",
    activity: "Activity",
    printable: "Worksheet",
    media: "Video",
    citation: "Source",
    methodology: "Approach",
  };
  return map[kind] ?? kind;
}

function domainOf(rec: LoadedRecord, store: CurriculumStore): LoadedRecord | undefined {
  const ids: string[] = Array.isArray(rec.data.domain_ids) ? rec.data.domain_ids : [];
  return ids
    .map((id) => store.records.get(id))
    .find((r): r is LoadedRecord => !!r && r.kind === "domain");
}

/** The skill a record belongs to: itself if it's a skill, else its first supported skill. */
export function parentSkill(rec: LoadedRecord, store: CurriculumStore): LoadedRecord | undefined {
  if (rec.kind === "skill") return rec;
  const sid = (Array.isArray(rec.data.supported_skill_ids) ? rec.data.supported_skill_ids : [])[0];
  const s = sid ? store.records.get(sid) : undefined;
  return s && s.kind === "skill" ? s : undefined;
}

/** Ancestors above a record — [Domain?, Skill?], excluding the record itself. */
export function ancestorsOf(rec: LoadedRecord, store: CurriculumStore = getCurriculum()): Crumb[] {
  const crumbs: Crumb[] = [];
  if (rec.kind === "domain") return crumbs;
  const skill = parentSkill(rec, store);
  const domain = domainOf(skill ?? rec, store);
  if (domain) crumbs.push({ title: domain.data.title ?? domain.id, href: `/r/${domain.id}` });
  if (skill && rec.kind !== "skill")
    crumbs.push({ title: skill.data.title ?? skill.id, href: `/r/${skill.id}` });
  return crumbs;
}

/**
 * Sequence skills with two signals:
 *  - prerequisites are a HARD constraint — a skill never sorts before a skill it
 *    requires (topological order over `prerequisite_skill_ids`);
 *  - among skills that are otherwise free to place, the YOUNGEST (lowest
 *    `age_range_months.min`, then max, then title) goes first.
 *
 * So adding a skill just needs a realistic age range and any real prerequisites;
 * it slots itself in. A new skill never has to be hand-ordered.
 */
let _orderCache: { store: CurriculumStore; order: Map<string, number> } | null = null;
function skillOrder(store: CurriculumStore): Map<string, number> {
  if (_orderCache?.store === store) return _orderCache.order;
  const skills = [...store.records.values()].filter((r) => r.kind === "skill");
  const ids = new Set(skills.map((s) => s.id));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const prereqs = (s: LoadedRecord): string[] =>
    (Array.isArray(s.data.prerequisite_skill_ids) ? s.data.prerequisite_skill_ids : []).filter(
      (p: string) => ids.has(p),
    );
  const indeg = new Map<string, number>(skills.map((s) => [s.id, prereqs(s).length]));
  const remaining = new Set(ids);
  const minAge = (id: string) => byId.get(id)?.data.age_range_months?.min ?? 999;
  const maxAge = (id: string) => byId.get(id)?.data.age_range_months?.max ?? 999;
  const title = (id: string) => byId.get(id)?.data.title ?? id;
  const cmp = (a: string, b: string) =>
    minAge(a) - minAge(b) || maxAge(a) - maxAge(b) || title(a).localeCompare(title(b));

  const order = new Map<string, number>();
  let i = 0;
  while (remaining.size > 0) {
    const avail = [...remaining].filter((id) => (indeg.get(id) ?? 0) === 0);
    const pickFrom = (avail.length ? avail : [...remaining]).sort(cmp); // cycle-safety fallback
    const pick = pickFrom[0];
    order.set(pick, i++);
    remaining.delete(pick);
    for (const s of skills)
      if (remaining.has(s.id) && prereqs(s).includes(pick))
        indeg.set(s.id, (indeg.get(s.id) ?? 1) - 1);
  }
  _orderCache = { store, order };
  return order;
}

/** Skills in a domain, ordered by prerequisite flow (not alphabetically). */
export function skillsInDomain(
  domainId: string,
  store: CurriculumStore = getCurriculum(),
): LoadedRecord[] {
  const order = skillOrder(store);
  return [...store.records.values()]
    .filter(
      (r) =>
        r.kind === "skill" &&
        Array.isArray(r.data.domain_ids) &&
        r.data.domain_ids.includes(domainId),
    )
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** The resources (activities, worksheets, videos) that hang off a skill. */
export function resourcesForSkill(
  skill: LoadedRecord,
  store: CurriculumStore = getCurriculum(),
): LoadedRecord[] {
  const all = [...store.records.values()];
  const supports = (r: LoadedRecord) =>
    (Array.isArray(r.data.supported_skill_ids) ? r.data.supported_skill_ids : []).includes(
      skill.id,
    );
  const linked = (field: string, r: LoadedRecord) =>
    (Array.isArray(skill.data[field]) ? skill.data[field] : []).includes(r.id);

  const out = [
    ...all.filter((r) => r.kind === "activity" && supports(r)),
    ...all.filter((r) => r.kind === "printable" && (supports(r) || linked("printable_ids", r))),
    ...all.filter((r) => r.kind === "media" && (supports(r) || linked("media_ids", r))),
  ];
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
