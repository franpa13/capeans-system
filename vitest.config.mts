import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ holds Playwright Test specs, run by `npx playwright test`,
    // not Vitest — exclude them so this config only picks up src/**/*.test.ts.
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // Test files share one real Postgres database and clean up with
    // deleteMany() in afterEach; running files in parallel lets one
    // file's cleanup wipe rows another concurrently-running file just
    // created. Sequential file execution trades some speed for
    // correctness at this project's scale.
    fileParallelism: false,
  },
});
