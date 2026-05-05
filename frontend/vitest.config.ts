// Vitest config (Phase 6.2a).
//
// `environment: jsdom` so component tests can render. The path alias
// `@/*` mirrors `tsconfig.json` so test code imports the same way
// app code does.

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    css: false,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
