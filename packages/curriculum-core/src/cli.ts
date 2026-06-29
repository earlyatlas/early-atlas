import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCurriculum } from "./load.js";

/** `pnpm validate` — load the curriculum and exit non-zero on any issue. */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? resolve(here, "../../../curriculum"));

const store = loadCurriculum(root);
const count = store.records.size;

if (store.issues.length === 0) {
  console.log(`✓ ${count} record(s) loaded from ${root}, no issues.`);
  process.exit(0);
}

console.error(`✗ ${store.issues.length} issue(s) across ${count} record(s):\n`);
for (const issue of store.issues) {
  const loc = issue.id ? `[${issue.id}]` : issue.file;
  console.error(`  - ${loc}: ${issue.message}`);
}
process.exit(1);
