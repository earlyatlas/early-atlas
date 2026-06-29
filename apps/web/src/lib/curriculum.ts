import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadCurriculum, type CurriculumStore } from "@earlyatlas/curriculum-core";

/**
 * Resolve the curriculum/ directory. The bundled prod server lives in a
 * different place than the source, so don't anchor to import.meta.url: prefer an
 * explicit env override, then walk up from the working directory looking for a
 * `curriculum/` folder (works for both `astro dev` and the built server, which
 * are both launched from apps/web or the repo root).
 */
function resolveCurriculumRoot(): string {
  if (process.env.EARLYATLAS_CURRICULUM) return resolve(process.env.EARLYATLAS_CURRICULUM);
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "curriculum");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last resort: assume repo-root/curriculum relative to a deep cwd.
  return resolve(process.cwd(), "curriculum");
}

export const CURRICULUM_ROOT = resolveCurriculumRoot();

let cached: CurriculumStore | null = null;

/** Cached curriculum store. Call {@link reloadCurriculum} after a write. */
export function getCurriculum(): CurriculumStore {
  if (!cached) cached = loadCurriculum(CURRICULUM_ROOT);
  return cached;
}

export function reloadCurriculum(): CurriculumStore {
  cached = loadCurriculum(CURRICULUM_ROOT);
  return cached;
}
