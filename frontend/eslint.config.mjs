// ESLint 9 flat config (Phase 6.1).
//
// Next 15 deprecated `next lint`; we use the ESLint CLI directly.
// The Next.js eslint-config-next package ships its own flat-config
// helpers, but `eslint-config-next/flat` is still in flux as of
// 15.5.x. Until that lands, we extend the legacy config block by
// hand via FlatCompat.
//
// Rules of note:
//   - `@typescript-eslint/no-explicit-any: error` — catches the
//     `as any` casts the action plan flagged.
//   - `react-hooks/exhaustive-deps: error` — bumped from `warn` so
//     a missing dep fails CI instead of merging with a yellow line.

import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": [
        "error",
        // `fixToUnknown` lets `eslint --fix` rewrite `any` to `unknown`
        // automatically. Tightening to a real type is preferable but
        // beyond the scope of a single PR; `unknown` forces every
        // reader to narrow before use, which is what the rule cares
        // about.
        { fixToUnknown: true },
      ],
      "react-hooks/exhaustive-deps": "error",
    },
  },
];

export default config;
