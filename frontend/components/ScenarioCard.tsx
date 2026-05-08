"use client";

import { useState } from "react";
import type { Scenario, ScenarioResult, SystemMode } from "@/types/api";
import { api } from "@/lib/api";
import { SystemModeBadge } from "./SystemModeBadge";

const SEVERITY_RANK: Record<SystemMode, number> = {
  NORMAL: 1,
  DEGRADED: 2,
  SAFE_MODE: 3,
  FAILED: 4,
};

const STATUS_TOKEN: Record<SystemMode, string> = {
  NORMAL: "status-nominal",
  DEGRADED: "status-degraded",
  SAFE_MODE: "status-safemode",
  FAILED: "status-failed",
};

// Static map so Tailwind's content scanner can see every concrete
// class. Dynamic `bg-${token}` strings would be tree-shaken away.
const STRIPE_CLASS: Record<string, string> = {
  "status-nominal": "bg-status-nominal",
  "status-degraded": "bg-status-degraded",
  "status-safemode": "bg-status-safemode",
  "status-failed": "bg-status-failed",
  border: "bg-border",
};

export function statusColorFor(modes: SystemMode[]): string {
  if (!modes || modes.length === 0) return "border";
  let worst: SystemMode | null = null;
  for (const m of modes) {
    const rank = SEVERITY_RANK[m];
    if (rank === undefined) continue;
    if (worst === null || rank > SEVERITY_RANK[worst]) worst = m;
  }
  if (worst === null) return "border";
  return STATUS_TOKEN[worst];
}

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const stripeToken = statusColorFor(scenario.expected_final_modes as SystemMode[]);
  const stripeClass = STRIPE_CLASS[stripeToken] ?? "bg-border";

  const faultCount = scenario.faults.length;
  const faultLabel = `${faultCount} ${faultCount === 1 ? "FAULT" : "FAULTS"}`;

  async function run(steps?: number) {
    setRunning(true);
    setError(null);
    try {
      const r = await api.runScenario(scenario.name, steps);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="relative bg-surface-elevated border border-border rounded-md overflow-hidden transition duration-150 hover:-translate-y-0.5 hover:border-accent/40 motion-reduce:transform-none motion-reduce:transition-none">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${stripeClass}`} aria-hidden />
      <div className="p-5 pl-6 space-y-3">
        <h2 className="font-mono uppercase font-semibold text-text-primary tracking-wide break-words">
          {scenario.name.toUpperCase()}
        </h2>

        <p className="text-sm text-text-primary leading-relaxed">{scenario.description}</p>

        <div className="border-l-2 border-accent/40 bg-surface/40 rounded-r-md pl-3 py-2 -ml-1">
          <p className="font-mono uppercase text-[10px] text-text-muted tracking-wider mb-1">
            {"// EXPECTED OPERATOR OBSERVATION"}
          </p>
          <p className="text-sm text-text-primary leading-relaxed">{scenario.expected_behavior}</p>
          {scenario.expected_final_modes.length > 0 && (
            <p className="font-mono text-[11px] text-text-muted tracking-wide pt-2">
              expected final mode →{" "}
              <span className="text-text-primary">
                {scenario.expected_final_modes.join(" | ")}
              </span>
            </p>
          )}
        </div>

        <p className="font-mono text-xs uppercase text-text-muted tracking-wide">
          {faultLabel}
          <span className="opacity-50 px-2">/</span>
          {scenario.steps} STEPS
          <span className="opacity-50 px-2">/</span>
          SEED {scenario.seed}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => run()}
            disabled={running}
            className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md bg-accent text-bg hover:opacity-90 transition disabled:opacity-50"
          >
            Run ({scenario.steps})
          </button>
          <button
            type="button"
            onClick={() => run(scenario.steps * 2)}
            disabled={running}
            className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md border border-border text-text-primary hover:border-accent transition disabled:opacity-50"
          >
            Run Extended
          </button>
        </div>

        {error && <p className="font-mono text-xs text-status-failed pt-1 break-words">{error}</p>}

        {result && (
          <div className="border-t border-border pt-3 space-y-1 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-text-muted uppercase tracking-wide">Final Mode:</span>
              <SystemModeBadge mode={result.final_mode} />
              <a
                className="ml-auto text-accent hover:underline"
                href={`/simulations/${result.simulation_id}`}
              >
                view →
              </a>
            </div>
            <div className="text-text-muted uppercase tracking-wide">
              Steps Run: {result.steps_run}
            </div>
            <div className="text-text-muted uppercase tracking-wide break-words">
              Final Action: {result.final_action}
            </div>
            <div className="text-text-muted uppercase tracking-wide break-words">
              Mode Counts:{" "}
              {Object.entries(result.decision_counts)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
