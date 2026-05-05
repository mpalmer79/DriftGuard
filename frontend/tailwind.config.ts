import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: "#0b0f17",
          panel: "#111827",
          border: "#1f2937",
          accent: "#38bdf8",
          good: "#22c55e",
          warn: "#f59e0b",
          bad: "#ef4444",
          critical: "#b91c1c",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
