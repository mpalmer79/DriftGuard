"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DecisionRecord, FaultRecord, StepResponse, VehicleState } from "@/types/api";
import { CausalityPanel } from "@/components/CausalityPanel";
import { ModeLegend } from "@/components/ModeLegend";
import { SystemModeBadge } from "@/components/SystemModeBadge";

interface SimSummary {
  id: string;
  seed: number;
  created_at: number;
}

export default function DashboardPage() {
  const [sims, setSims] = useState<SimSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [state, setState] = useState<VehicleState | null>(null);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [seed, setSeed] = useState(42);
  const [busy, setBusy] = useState(false);
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null);
  const [previousDecision, setPreviousDecision] = useState<DecisionRecord | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  async function refreshList() {
    try {
      const list = await api.listSimulations();
      setSims(list);
      if (!activeId && list.length > 0) setActiveId(list[0].id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api
      .getState(activeId)
      .then(setState)
      .catch(() => setState(null));
    api
      .getFaults(activeId)
      .then(setFaults)
      .catch(() => setFaults([]));
    api
      .getSimulation(activeId)
      .then((d) => setStepCount(d.step_count))
      .catch(() => setStepCount(0));
    // Pull the latest persisted decision so the causality panel
    // shows real data even when the user just selected the
    // simulation without stepping it themselves.
    api
      .getDecisions(activeId)
      .then((decs) => {
        if (decs.length === 0) {
          setLastDecision(null);
          setPreviousDecision(null);
          return;
        }
        setLastDecision(decs[decs.length - 1]);
        setPreviousDecision(decs.length > 1 ? decs[decs.length - 2] : null);
      })
      .catch(() => {
        setLastDecision(null);
        setPreviousDecision(null);
      });
    api
      .getReplayFingerprint(activeId)
      .then((r) => setFingerprint(r.fingerprint))
      .catch(() => setFingerprint(null));
  }, [activeId]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createSimulation(seed);
      setActiveId(res.simulation_id);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function step(times = 1) {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      let last: StepResponse | null = null;
      let prevToLast: StepResponse | null = null;
      for (let i = 0; i < times; i += 1) {
        prevToLast = last;
        last = await api.stepSimulation(activeId);
      }
      if (last) {
        setState(last.state);
        setStepCount(last.state.step);
        setLastDecision(last.decision as DecisionRecord);
        if (prevToLast) {
          setPreviousDecision(prevToLast.decision as DecisionRecord);
        } else {
          // First step in this batch — fall back to whatever was
          // previously cached so previous_mode resolution still works.
          setPreviousDecision((prev) => prev ?? lastDecision);
        }
      }
      // Refresh the fingerprint after stepping — every new step
      // changes the canonical hash.
      api
        .getReplayFingerprint(activeId)
        .then((r) => setFingerprint(r.fingerprint))
        .catch(() => {
          /* keep stale fingerprint */
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          {"// LIVE SIMULATION CONTROL"}
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
          Dashboard
        </h1>
        <p className="text-text-muted leading-relaxed max-w-[640px]">
          Create a new simulation, step through it, and inspect the system state at each step. Each
          simulation is identified by its seed — same seed reproduces the same trajectory.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="relative bg-surface-elevated border border-border rounded-md overflow-hidden"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--status-failed) 10%, var(--surface-elevated))",
            borderColor: "color-mix(in srgb, var(--status-failed) 40%, var(--border))",
          }}
        >
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-status-failed" aria-hidden />
          <p className="font-mono text-sm text-status-failed p-4 pl-5 break-words">{error}</p>
        </div>
      )}

      <section className="hidden md:block border-y border-border bg-surface -mx-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-8 gap-y-2 py-3 font-mono text-xs uppercase tracking-wider text-text-muted">
          <LegendPill colorClass="bg-status-nominal" label="NOMINAL" />
          <LegendPill colorClass="bg-status-degraded" label="DEGRADED" />
          <LegendPill colorClass="bg-status-safemode" label="SAFE_MODE" />
          <LegendPill colorClass="bg-status-failed" label="FAILED" />
        </div>
      </section>

      <ModeLegend />


      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="surface-elevated-grad border border-border rounded-md p-4">
            <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary mb-3">
              Sessions
            </h2>
            {sims.length === 0 ? (
              <p className="font-mono text-xs text-text-muted py-2">
                {"// No simulations yet. Click Create to start one."}
              </p>
            ) : (
              <ul className="space-y-1" aria-label="simulation list">
                {sims.map((s) => (
                  <SessionRow
                    key={s.id}
                    id={s.id}
                    seed={s.seed}
                    createdAt={s.created_at}
                    active={s.id === activeId}
                    onClick={() => setActiveId(s.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="surface-elevated-grad border border-border rounded-md p-4 space-y-3">
            <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
              New Simulation
            </h2>
            <div className="space-y-2">
              <label
                htmlFor="dash-seed"
                className="block font-mono uppercase text-xs text-text-muted"
              >
                Seed
              </label>
              <input
                id="dash-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="block w-full bg-bg border border-border rounded-md px-3 py-2.5 font-mono text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                aria-label="seed for new simulation"
              />
            </div>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="w-full inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2.5 rounded-md bg-accent text-bg hover:opacity-90 transition disabled:opacity-50"
            >
              {busy ? "Creating..." : "Create"}
            </button>
          </section>
        </div>

        <div className="lg:col-span-3 space-y-5">
          <section className="surface-elevated-grad border border-border rounded-md p-4 space-y-4">
            <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
              Active Simulation
            </h2>
            {!activeId ? (
              <p className="font-mono text-xs text-text-muted py-8 text-center">
                {"// SELECT OR CREATE A SIMULATION TO BEGIN"}
              </p>
            ) : (
              <>
                <p className="font-mono text-xs text-text-muted break-all">{activeId}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {state && <SystemModeBadge mode={state.system_mode} />}
                  <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
                    Step {stepCount} / ∞
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={busy}
                    className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md bg-accent text-bg hover:opacity-90 transition disabled:opacity-50"
                  >
                    Step
                  </button>
                  <button
                    type="button"
                    onClick={() => step(10)}
                    disabled={busy}
                    className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md border border-border text-text-primary hover:border-accent transition disabled:opacity-50"
                  >
                    Step x10
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard title="Vehicle State">
                    {state ? (
                      <dl className="space-y-1 font-mono text-xs">
                        <StatRow label="Alt" value={state.altitude.toFixed(1)} />
                        <StatRow label="Vel" value={state.velocity.toFixed(1)} />
                        <StatRow label="Hdg" value={`${state.heading.toFixed(1)}°`} />
                      </dl>
                    ) : (
                      <p className="font-mono text-xs text-text-muted">—</p>
                    )}
                  </StatCard>
                  <StatCard title="Last Action">
                    <p className="font-mono uppercase text-sm text-text-primary break-words">
                      {state?.last_action ?? "—"}
                    </p>
                  </StatCard>
                  <StatCard title="Faults">
                    <p
                      className={`font-mono uppercase text-sm ${
                        faults.length > 0 ? "text-status-degraded" : "text-status-nominal"
                      }`}
                    >
                      {faults.length} active
                    </p>
                  </StatCard>
                </div>
                <div className="pt-1">
                  <Link
                    href={`/simulations/${activeId}`}
                    className="inline-flex items-center font-mono uppercase text-xs tracking-wider text-accent hover:underline"
                  >
                    Open Full View →
                  </Link>
                </div>
              </>
            )}
          </section>

          {activeId && (
            <CausalityPanel
              decision={lastDecision}
              faults={faults}
              replayFingerprint={fingerprint}
              previousDecision={previousDecision}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LegendPill({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} aria-hidden />
      {label}
    </span>
  );
}

function relativeTime(epochSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SessionRow({
  id,
  seed,
  createdAt,
  active,
  onClick,
}: {
  id: string;
  seed: number;
  createdAt: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={`relative block w-full text-left rounded-md overflow-hidden transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
          active ? "bg-surface-elevated" : "hover:bg-surface"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" aria-hidden />
        )}
        <span className="flex items-center gap-3 flex-wrap px-3 py-2 pl-4">
          <span className="font-mono text-xs text-text-primary">{id.slice(0, 12)}</span>
          <span className="font-mono text-xs text-text-muted">seed {seed}</span>
          <span className="ml-auto font-mono text-xs text-text-muted">
            {relativeTime(createdAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-md p-3">
      <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted mb-2">{title}</p>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
