import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // The spec test reads files and runs no DOM code.
    environmentMatchGlobs: [["openapi/**", "node"]],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      // Only the code that carries logic. Config files and the Prisma client
      // wrapper have nothing to assert, and counting them would flatter the
      // number without telling us anything.
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: ["lib/db.ts", "**/*.test.{ts,tsx}"],
      // CI fails below these. Raise them as coverage grows; never lower them
      // to make a red build go green.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 75,
        lines: 85,
      },
    },
  },
  // Next compiles JSX with the automatic runtime, so components never import
  // React. The test runner has to be told the same, or every render throws
  // "React is not defined".
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
