#!/usr/bin/env node
// Objective gate: every docs/**/*.md must be referenced in docs/INDEX.md, so the
// index stays the reliable map agents use to find (and update) documentation.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const docsDir = join(root, "docs");
const indexPath = join(docsDir, "INDEX.md");

if (!existsSync(indexPath)) {
  console.error("✗ docs/INDEX.md is missing.");
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const index = readFileSync(indexPath, "utf8");
const missing = walk(docsDir)
  .filter((f) => f.endsWith(".md") && f !== indexPath)
  .map((f) => relative(docsDir, f))
  .filter((rel) => !index.includes(rel));

if (missing.length > 0) {
  console.error("✗ These docs are not listed in docs/INDEX.md:");
  for (const m of missing) console.error(`  - ${m}`);
  console.error("\nAdd a one-line entry for each, then re-run.");
  process.exit(1);
}

console.log("✓ docs/INDEX.md references every doc.");
