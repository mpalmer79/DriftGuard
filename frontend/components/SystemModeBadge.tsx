import type { SystemMode } from "@/types/api";

const MODE_VAR: Record<SystemMode, string> = {
  NORMAL: "--status-nominal",
  DEGRADED: "--status-degraded",
  SAFE_MODE: "--status-safemode",
  FAILED: "--status-failed",
};

export function SystemModeBadge({ mode }: { mode: SystemMode }) {
  const cssVar = MODE_VAR[mode];
  const tint = `color-mix(in srgb, var(${cssVar}) 15%, transparent)`;
  const borderTint = `color-mix(in srgb, var(${cssVar}) 50%, transparent)`;
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 rounded-md border font-mono uppercase text-xs tracking-wider transition-colors duration-200 ease-out motion-reduce:transition-none"
      style={{
        color: `var(${cssVar})`,
        backgroundColor: tint,
        borderColor: borderTint,
      }}
    >
      {mode}
    </span>
  );
}
