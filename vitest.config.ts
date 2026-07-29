import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "packages/frontend/src"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["packages/**/*.spec.ts", "packages/**/*.test.ts"],
  },
});
