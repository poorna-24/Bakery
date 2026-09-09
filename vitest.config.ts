import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // No DOM needed: the admin's testable logic is all server-side.
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/db.ts", "**/*.test.ts"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 70,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
