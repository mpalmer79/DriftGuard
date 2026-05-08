"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import type { Scenario, SystemMode } from "@/types/api";

type Mode = "grid" | "list";

export interface LandingScenarioPreviewProps {
  scenario: Scenario;
  mode?: Mode;
}

const SEVERITY_RANK: Record<SystemMode, number> = {
  NORMAL: 1,
  DEGRADED: 2,
  SAFE_MODE: 3,
  FAILED: 4,
};

// Static class map — Tailwind's content scanner can't see dynamic
// `bg-${token}` strings.
const STRIPE_CLASS: Record<string, string> = {
  "status-nominal": "bg-status-nominal",
  "status-degraded": "bg-status-degraded",
  "status-safemode": "bg-status-safemode",
  "status-failed": "bg-status-failed",
  border: "bg-border",
};

const MODE_TEXT_CLASS: Record<SystemMode, string> = {
  NORMAL: "text-status-nominal",
  DEGRADED: "text-status-degraded",
  SAFE_MODE: "text-status-safemode",
  FAILED: "text-status-failed",
};

function stripeForModes(modes: string[]): string {
  if (!modes || modes.length === 0) return "border";
  let worstRank = 0;
  let worstToken = "border";
  for (const m of modes) {
    const rank = SEVERITY_RANK[m as SystemMode];
    if (rank === undefined) continue;
    if (rank > worstRank) {
      worstRank = rank;
      switch (m as SystemMode) {
        case "NORMAL":
          worstToken = "status-nominal";
          break;
        case "DEGRADED":
          worstToken = "status-degraded";
          break;
        case "SAFE_MODE":
          worstToken = "status-safemode";
          break;
        case "FAILED":
          worstToken = "status-failed";
          break;
      }
    }
  }
  return worstToken;
}

function formatScenarioName(name: string): string {
  return name
    .split("_")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

export function LandingScenarioPreview({ scenario, mode = "grid" }: LandingScenarioPreviewProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeToken = stripeForModes(scenario.expected_final_modes);
  const stripeClass = STRIPE_CLASS[stripeToken] ?? "bg-border";

  const firstFault = scenario.faults[0];
  const faultLabel = firstFault?.type ?? null;

  const escalation =
    scenario.expected_final_modes.length > 0 ? scenario.expected_final_modes.join(" → ") : null;

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const result = await api.runScenario(scenario.name);
      router.push(`/simulations/${result.simulation_id}`);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  }

  const containerClass =
    mode === "list"
      ? "relative bg-surface-elevated border border-border rounded-md overflow-hidden flex flex-col sm:flex-row sm:items-stretch transition duration-150 hover:border-accent/40 motion-reduce:transition-none"
      : "relative bg-surface-elevated border border-border rounded-md overflow-hidden flex flex-col transition duration-150 hover:border-accent/40 motion-reduce:transition-none";

  return (
    <article className={containerClass} data-testid="landing-scenario-preview">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${stripeClass}`} aria-hidden />
      <div className="flex-1 p-4 pl-5 space-y-2.5">
        <h3 className="font-mono uppercase text-sm font-semibold tracking-wide text-text-primary break-words">
          {formatScenarioName(scenario.name)}
        </h3>
        <p className="text-sm text-text-primary leading-snug">{scenario.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          {faultLabel ? (
            <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-status-degraded/40 text-status-degraded bg-status-degraded/10">
              {faultLabel}
            </span>
          ) : (
            <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-text-muted">
              NO FAULT
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {scenario.steps} steps
          </span>
        </div>
        {escalation && (
          <p className="font-mono text-[11px] tracking-wide text-text-muted">
            <span className="opacity-70">Expected escalation</span>{" "}
            <span className="opacity-50">→</span>{" "}
            {scenario.expected_final_modes.map((m, i) => (
              <span key={`${m}-${i}`}>
                <span className={MODE_TEXT_CLASS[m as SystemMode] ?? "text-text-primary"}>{m}</span>
                {i < scenario.expected_final_modes.length - 1 && (
                  <span className="opacity-50"> → </span>
                )}
              </span>
            ))}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="font-mono text-[11px] text-status-failed pt-1 break-words"
            data-testid="landing-scenario-preview-error"
          >
            {error}
          </p>
        )}
      </div>
      <div className="px-4 pb-4 pl-5 sm:flex sm:items-end">
        <button
          type="button"
          onClick={run}
          disabled={running}
          aria-label={`Run ${formatScenarioName(scenario.name)} scenario`}
          className="w-full sm:w-auto inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md bg-accent text-bg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>
    </article>
  );
}

export default LandingScenarioPreview;
