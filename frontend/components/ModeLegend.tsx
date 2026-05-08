// ModeLegend — inline operator-friendly explanations for each safety
// mode the system can occupy. The chips use the same status color
// tokens as SystemModeBadge so the visual mapping is consistent
// wherever the legend appears (dashboard, simulation detail, etc.).

import type { SystemMode } from "@/types/api";

interface ModeEntry {
  mode: SystemMode;
  description: string;
  tokenClasses: string;
}

const ENTRIES: ModeEntry[] = [
  {
    mode: "NORMAL",
    description: "All components healthy. Controllers in consensus.",
    tokenClasses: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  },
  {
    mode: "DEGRADED",
    description:
      "Component unhealthy. System still producing actions; restricted action set may apply downstream.",
    tokenClasses: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  },
  {
    mode: "SAFE_MODE",
    description:
      "Insufficient consensus or invalid sensor. System restricts to {HOLD, STABILIZE, DECELERATE, ABORT}.",
    tokenClasses: "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
  },
  {
    mode: "FAILED",
    description: "Multiple critical failures. Final action forced to ABORT.",
    tokenClasses: "text-status-failed border-status-failed/40 bg-status-failed/10",
  },
];

export function ModeLegend({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Safety mode legend"
      data-testid="mode-legend"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {ENTRIES.map((entry) => (
        <span
          key={entry.mode}
          title={entry.description}
          className={`inline-flex items-baseline gap-2 px-2.5 py-1 rounded-md border font-mono text-[11px] ${entry.tokenClasses}`}
        >
          <span className="uppercase tracking-wider">{entry.mode}</span>
          <span className="opacity-80 normal-case font-sans text-[11px]">
            — {entry.description}
          </span>
        </span>
      ))}
    </section>
  );
}
