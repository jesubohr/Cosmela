import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "edge-runtime",
    // The rate limiter's test helper ships as TypeScript source.
    server: { deps: { inline: ["convex-test", "@convex-dev/rate-limiter", "@convex-dev/batch-worker"] } },
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
