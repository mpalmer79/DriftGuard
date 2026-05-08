// Vitest config (Phase 6.2a).
//
// `environment: jsdom` so component tests can render. The path alias
// `@/*` mirrors `tsconfig.json` so test code imports the same way
// app code does.

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The repo's tsconfig uses `jsx: "preserve"` so Next can transform
  // it. Vitest goes through esbuild instead, so we explicitly opt
  // into the automatic JSX runtime here — that way component test
  // files (CausalityPanel.test.tsx, ModeLegend.test.tsx) don't need
  // an explicit `import * as React from "react"` at the top.
  esbuild: {
    jsx: "automatic",
  },
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
