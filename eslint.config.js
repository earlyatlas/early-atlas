import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Lint TypeScript/JavaScript logic. .astro files are covered by `astro check`
// (types/templates) and Prettier (formatting), so they're excluded here to keep
// the lint gate fast and free of parser-version fragility.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.astro/**",
      "**/cdk.out/**",
      "**/node_modules/**",
      "**/*.astro",
      "**/env.d.ts", // Astro-generated
      ".claude/**", // local agent tooling
      ".agents/**", // local agent tooling
      ".impeccable/**", // local agent tooling
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Node scripts (plain ESM, not type-checked by tsc).
    files: ["**/*.mjs", "**/*.cjs", "scripts/**"],
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
  },
);
