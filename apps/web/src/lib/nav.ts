import { getCurriculum } from "./curriculum.js";
import { skillsInDomain } from "./hierarchy.js";

export interface NavLesson {
  id: string;
  title: string;
  href: string;
}
export interface NavGroup {
  id: string;
  title: string;
  href: string;
  lessons: NavLesson[];
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

/** The sidebar tree: each domain with its skills, ordered by prerequisite flow. */
export function buildNav(): NavGroup[] {
  const store = getCurriculum();
  return [...store.records.values()]
    .filter((r) => r.kind === "domain")
    .map((d) => ({
      id: d.id,
      title: d.data.title ?? d.id,
      href: `/r/${d.id}`,
      lessons: skillsInDomain(d.id, store).map((s) => ({
        id: s.id,
        title: s.data.title ?? s.id,
        href: `/r/${s.id}`,
      })),
    }))
    .sort(byTitle);
}

/** Sidebar list of pedagogical approaches (each links to its explainer page). */
export function buildMethodologyNav(): NavLesson[] {
  const store = getCurriculum();
  return [...store.records.values()]
    .filter((r) => r.kind === "methodology")
    .map((m) => ({ id: m.id, title: m.data.title ?? m.id, href: `/r/${m.id}` }))
    .sort(byTitle);
}
