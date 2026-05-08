import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig uses jsx: "preserve" for Next; Vitest runs through esbuild,
  // so opt into the automatic JSX runtime to avoid React imports in
  // every test file.
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
