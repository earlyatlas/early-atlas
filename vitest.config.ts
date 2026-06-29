import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
    // Workspace packages ship TypeScript source; inline them so Vitest transforms
    // rather than externalizing (Node can't import their .ts directly).
    server: { deps: { inline: [/@earlyatlas\//] } },
  },
});
