import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// SSR so the site can render the working-tree curriculum, accept edits, and host
// the MCP endpoint in the same app. Workspace packages ship TypeScript source,
// so they must be transpiled by Vite rather than treated as external.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: {
    ssr: {
      noExternal: ["@earlyatlas/curriculum-core", "@earlyatlas/curriculum-schema"],
    },
  },
});
