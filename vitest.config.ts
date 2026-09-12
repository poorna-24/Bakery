import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      // Only the code that carries logic. Config files and the Prisma client
      // wrapper have nothing to assert, and counting them would flatter the
      // number without telling us anything.
      include: ["lib/**/*.ts", "components/**/*.tsx", "app/**/route.ts"],
      exclude: ["lib/db.ts", "**/*.test.{ts,tsx}"],
      // Every line and branch the apps actually run is covered. The few
      // branches short of 100 are guards sitting behind a stronger check
      // upstream — unreachable through the public API, kept as a backstop.
      // Raise these as coverage grows; never lower them to make a red build
      // go green.
      thresholds: {
        statements: 100,
        branches: 99,
        functions: 100,
        lines: 100,
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
