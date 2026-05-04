import type { SystemMode } from "@/types/api";

const styles: Record<SystemMode, string> = {
  NORMAL: "bg-sentinel-good/20 text-sentinel-good border-sentinel-good/40",
  DEGRADED: "bg-sentinel-warn/20 text-sentinel-warn border-sentinel-warn/40",
  SAFE_MODE: "bg-sentinel-bad/20 text-sentinel-bad border-sentinel-bad/40",
  FAILED: "bg-sentinel-critical/30 text-white border-sentinel-critical/60",
};

export function SystemModeBadge({ mode }: { mode: SystemMode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold tracking-wide ${styles[mode]}`}
    >
      {mode}
    </span>
  );
}
