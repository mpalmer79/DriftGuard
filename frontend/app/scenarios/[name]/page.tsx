"use client";

// /scenarios/[name] — operator-facing scenario detail route.
//
// The page reads the scenario from the backend via api.getScenario,
// renders the full ScenarioNarrative, and lets the operator run the
// scenario in-place. After a run completes:
//
//   * we fetch the per-step decisions for the produced simulation so
//     the ModeTimeline can render the segment band;
//   * we render the ExecutionSummaryCard with the scenario prop so
//     expected-vs-actual is included.
//
// Errors fall through to a friendly 404 surface when getScenario
// returns a non-2xx response. We keep the loading state lightweight —
// no skeleton — so the route renders cleanly even on cold-start.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { DecisionRecord, Scenario, ScenarioResult } from "@/types/api";
import { ScenarioNarrative } from "@/components/ScenarioNarrative";
import { ExecutionSummaryCard } from "@/components/ExecutionSummaryCard";
import { ModeTimeline } from "@/components/ModeTimeline";
import { ErrorState } from "@/components/ui/EmptyState";

export default function ScenarioDetailPage() {
  const params = useParams<{ name: string }>();
  const name = params.name;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[] | null>(null);

  useEffect(() => {
    if (!name) return;
    let active = true;
    api
      .getScenario(name)
      .then((s) => {
        if (active) setScenario(s);
      })
      .catch((e) => {
        if (!active) return;
        const status = (e as { status?: number }).status;
        if (status === 404) setNotFound(true);
        else setLoadError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [name]);

  async function run(steps?: number) {
    if (!scenario) return;
    setRunning(true);
    setRunError(null);
    setResult(null);
    setDecisions(null);
    try {
      const r = await api.runScenario(scenario.name, steps);
      setResult(r);
      // Pull the per-step decisions so the ModeTimeline can render
      // segments. The /scenarios/{name}/run endpoint returns the
      // result but not the decision stream — we fetch it separately.
      try {
        const ds = await api.getDecisions(r.simulation_id);
        setDecisions(ds);
      } catch {
        // Best-effort. The summary card still renders without it.
        setDecisions([]);
      }
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="bg-surface-elevated border border-status-failed/40 rounded-md p-6 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            {"// 404"}
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">Scenario not found</h1>
          <p className="text-text-muted">
            No scenario named <code className="font-mono text-text-primary">{name}</code> is
            registered. It may have been deleted or never existed.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={loadError} retry={() => location.reload()} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="font-mono text-xs uppercase tracking-wider text-text-muted">
          Loading scenario brief…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <ScenarioNarrative scenario={scenario} />

      <section
        aria-label="Run scenario"
        className="bg-surface-elevated border border-border rounded-md p-5 space-y-3"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {"// RUN THIS SCENARIO"}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Execute deterministically against the registered seed. Run extended doubles the step count
          to surface long-window recovery and re-escalation behavior.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
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
            Run Extended ({scenario.steps * 2})
          </button>
        </div>
        {running && (
          <p className="font-mono text-xs text-text-muted">Running deterministic simulation…</p>
        )}
        {runError && <p className="font-mono text-xs text-status-failed break-words">{runError}</p>}
      </section>

      {result && (
        <>
          {decisions && decisions.length > 0 && <ModeTimeline decisions={decisions} />}
          <ExecutionSummaryCard result={result} scenario={scenario} />
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/scenarios"
      className="inline-flex items-center font-mono text-[11px] uppercase tracking-wider text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      ← Back to scenarios
    </Link>
  );
}
