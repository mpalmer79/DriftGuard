"use client";

import { useState } from "react";
import type { Scenario, ScenarioResult } from "@/types/api";
import { api } from "@/lib/api";
import { Card } from "./Card";
import { SystemModeBadge } from "./SystemModeBadge";

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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
    <Card title={scenario.name}>
      <p className="text-sm mb-1">{scenario.description}</p>
      <p className="text-xs text-gray-400 mb-3">
        Expected: {scenario.expected_behavior}
      </p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => run()}
          disabled={running}
          className="px-3 py-1 rounded bg-sentinel-accent/20 border border-sentinel-accent/40 hover:bg-sentinel-accent/30 text-xs disabled:opacity-50"
        >
          run ({scenario.steps} steps)
        </button>
        <button
          onClick={() => run(scenario.steps * 2)}
          disabled={running}
          className="px-3 py-1 rounded border border-sentinel-border hover:bg-sentinel-border/40 text-xs disabled:opacity-50"
        >
          run extended
        </button>
      </div>

      {scenario.faults.length > 0 && (
        <div className="text-xs text-gray-400 mb-3">
          {scenario.faults.length} fault(s) scheduled
        </div>
      )}

      {error && <p className="text-sentinel-bad text-xs">{error}</p>}

      {result && (
        <div className="text-xs space-y-1 border-t border-sentinel-border pt-2">
          <div className="flex items-center gap-2">
            <span>final mode:</span>
            <SystemModeBadge mode={result.final_mode} />
            <a
              className="ml-auto text-sentinel-accent"
              href={`/simulations/${result.simulation_id}`}
            >
              view →
            </a>
          </div>
          <div>steps run: {result.steps_run}</div>
          <div>final action: {result.final_action}</div>
          <div className="text-gray-400">
            mode counts:{" "}
            {Object.entries(result.decision_counts)
              .map(([k, v]) => `${k}:${v}`)
              .join(", ")}
          </div>
        </div>
      )}
    </Card>
  );
}
