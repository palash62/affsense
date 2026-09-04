import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "src/modules/fraud/__tests__/**/*.test.ts",
      "src/modules/autoresponder/__tests__/**/*.test.ts",
      "src/modules/page-builder/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@cpl/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@cpl/database": path.resolve(__dirname, "../../packages/database/src/index.ts"),
      "@cpl/tracking-core": path.resolve(__dirname, "../../packages/tracking-core/src/index.ts"),
    },
  },
});
