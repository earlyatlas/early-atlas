import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCurriculum } from "./load.js";

/**
 * `pnpm coverage` — standards-alignment report. Shows, per framework, which
 * standards are covered by at least one skill (and which are gaps), plus how many
 * skills carry no alignment yet. This is the background-layer payoff: the data a
 * curriculum-builder queries to check coverage. It is informational (exit 0).
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? resolve(here, "../../../curriculum"));
const store = loadCurriculum(root);

const records = [...store.records.values()];
const standards = records.filter((r) => r.kind === "standard");
const skills = records.filter((r) => r.kind === "skill");

// standard id -> skills that align to it
const coveredBy = new Map<string, string[]>();
for (const s of standards) coveredBy.set(s.id, []);
let mappedSkills = 0;
for (const sk of skills) {
  const ids: string[] = Array.isArray(sk.data.standard_ids) ? sk.data.standard_ids : [];
  if (ids.length) mappedSkills++;
  for (const id of ids) coveredBy.get(id)?.push(sk.id);
}

const byFramework = new Map<string, typeof standards>();
for (const s of standards) {
  const fw = String(s.data.framework ?? "(none)");
  (byFramework.get(fw) ?? byFramework.set(fw, []).get(fw)!).push(s);
}

console.log(
  `Standards-alignment coverage  (${standards.length} standards, ${skills.length} skills)\n`,
);
for (const [fw, list] of byFramework) {
  const covered = list.filter((s) => (coveredBy.get(s.id) ?? []).length > 0);
  console.log(`Framework "${fw}" — ${covered.length}/${list.length} standards covered`);
  for (const s of list.sort((a, b) => String(a.data.code).localeCompare(String(b.data.code)))) {
    const skillsFor = coveredBy.get(s.id) ?? [];
    const mark = skillsFor.length ? "✓" : "·";
    const who = skillsFor.length
      ? skillsFor.map((id) => id.split(".").pop()).join(", ")
      : "— GAP (no skill yet)";
    console.log(`  ${mark} ${s.data.code}  ${s.data.title}`);
    console.log(`      ${who}`);
  }
  console.log("");
}

const unmapped = skills.filter(
  (sk) => !(Array.isArray(sk.data.standard_ids) && sk.data.standard_ids.length),
);
console.log(`Skills with at least one alignment: ${mappedSkills}/${skills.length}`);
console.log(`Skills not yet aligned to any standard: ${unmapped.length}`);
for (const sk of unmapped.slice(0, 40)) console.log(`  · ${sk.id}`);
if (unmapped.length > 40) console.log(`  …and ${unmapped.length - 40} more`);
