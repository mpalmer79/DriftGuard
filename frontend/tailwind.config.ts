import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        dg: {
          bg: "#0b0f17",
          panel: "#111827",
          border: "#1f2937",
          accent: "#38bdf8",
          good: "#22c55e",
          warn: "#f59e0b",
          bad: "#ef4444",
          critical: "#b91c1c",
        },
        bg: "var(--bg-base)",
        surface: "var(--surface-base)",
        "surface-elevated": "var(--surface-elevated-base)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "text-primary": "var(--text-primary)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-glow": "var(--accent-glow)",
        "status-nominal": "var(--status-nominal)",
        "status-degraded": "var(--status-degraded)",
        "status-failed": "var(--status-failed)",
        "status-safemode": "var(--status-safemode)",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
