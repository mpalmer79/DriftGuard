"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { LandingScenarioPreview } from "@/components/LandingScenarioPreview";
import { api } from "@/lib/api";
import type { Scenario } from "@/types/api";

const SystemCheckHero3D = dynamic(() => import("@/components/SystemCheckHero3D"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" />,
});

const FEATURED_SCENARIOS = [
  "sensor_drift_recovery",
  "split_vote_escalation",
  "multi_fault_failure",
  "gps_denied_navigation",
] as const;

const PRIMARY_DEMO_SCENARIO = "sensor_drift_recovery";

export default function HomePage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [recentSimulationId, setRecentSimulationId] = useState<string | null>(null);
  const [primaryRunning, setPrimaryRunning] = useState(false);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listScenarios()
      .then((data) => {
        if (!active) return;
        setScenarios(data);
      })
      .catch((err: Error) => {
        if (!active) return;
        setScenariosError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  // Pick the most-recent simulation so the replay capability chip
  // deep-links to a real run; falls back to /scenarios when none exist.
  useEffect(() => {
    let active = true;
    api
      .listSimulations()
      .then((sims) => {
        if (!active || sims.length === 0) return;
        const newest = sims.reduce((acc, s) => (s.created_at > acc.created_at ? s : acc), sims[0]);
        setRecentSimulationId(newest.id);
      })
      .catch(() => {
        /* best-effort deep link; ignore failure */
      });
    return () => {
      active = false;
    };
  }, []);

  const featured: Scenario[] = (scenarios ?? [])
    .filter((s) => (FEATURED_SCENARIOS as readonly string[]).includes(s.name))
    .sort(
      (a, b) =>
        FEATURED_SCENARIOS.indexOf(a.name as (typeof FEATURED_SCENARIOS)[number]) -
        FEATURED_SCENARIOS.indexOf(b.name as (typeof FEATURED_SCENARIOS)[number])
    );

  async function runPrimaryDemo() {
    setPrimaryRunning(true);
    setPrimaryError(null);
    try {
      const result = await api.runScenario(PRIMARY_DEMO_SCENARIO);
      router.push(`/simulations/${result.simulation_id}`);
    } catch (e) {
      setPrimaryError((e as Error).message);
      setPrimaryRunning(false);
    }
  }

  const replayHref = recentSimulationId
    ? `/simulations/${recentSimulationId}/replay`
    : "/scenarios";

  return (
    <div className="space-y-12">
      <section
        aria-labelledby="hero-title"
        className="bg-gradient-to-b from-bg to-surface-elevated border border-border rounded-xl p-6 md:p-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 items-center">
          <div className="space-y-5 order-last lg:order-first">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              DETERMINISTIC // FAULT-TOLERANT // CONTROL SYSTEM SIMULATION
            </p>
            <h1
              id="hero-title"
              className="text-4xl md:text-5xl font-semibold text-text-primary tracking-tight"
            >
              DriftGuard
            </h1>
            <p className="text-text-muted leading-relaxed max-w-xl">
              Deterministic, fault-tolerant control-system simulation. Three redundant controllers,
              majority voting, and replayable safe-mode escalation through{" "}
              <code className="font-mono text-status-nominal">NORMAL</code>
              {" → "}
              <code className="font-mono text-status-degraded">DEGRADED</code>
              {" → "}
              <code className="font-mono text-status-safemode">SAFE_MODE</code>
              {" → "}
              <code className="font-mono text-status-failed">FAILED</code>.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={runPrimaryDemo}
                disabled={primaryRunning}
                aria-label="Run sensor drift demo scenario"
                className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-5 py-2.5 rounded-md bg-accent text-bg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {primaryRunning ? "Starting demo…" : "Run Sensor Drift Demo"}
              </button>
              <Link
                href="/scenarios"
                className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-5 py-2.5 rounded-md border border-border text-text-primary hover:border-accent transition"
              >
                Browse all scenarios
              </Link>
            </div>
            {primaryError && (
              <p
                role="alert"
                data-testid="landing-primary-error"
                className="font-mono text-[11px] text-status-failed pt-1 break-words max-w-xl"
              >
                {primaryError}
              </p>
            )}
            <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted pt-1">
              Demo runs <span className="text-text-primary">sensor_drift_recovery</span> and routes
              to the simulation detail.
            </p>
          </div>
          <div className="max-w-[360px] w-full mx-auto lg:max-w-none">
            <SystemCheckHero3D />
          </div>
        </div>
      </section>

      <section aria-labelledby="what-title">
        <p
          id="what-title"
          className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted mb-4"
        >
          {"// WHAT THIS SIMULATES"}
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="what-this-simulates">
          <SimulatesItem
            stripeClass="bg-status-nominal"
            heading="A safety-critical control loop"
            body="Vehicle state, sensors, three redundant controllers, a voter, and a safe-mode manager."
          />
          <SimulatesItem
            stripeClass="bg-status-degraded"
            heading="Why redundancy matters"
            body="One controller cannot be both fast and conservative — voting brokers the conflict."
          />
          <SimulatesItem
            stripeClass="bg-status-safemode"
            heading="Why safe modes matter"
            body="The system has to know what to do when a fault is detected — escalate, contain, recover."
          />
          <SimulatesItem
            stripeClass="bg-accent"
            heading="Why deterministic replay matters"
            body="Audit, verification, and reproducibility — the same seed produces the same hash."
          />
        </ul>
      </section>

      <section aria-labelledby="scenarios-title">
        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
          <p
            id="scenarios-title"
            className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted"
          >
            {"// FEATURED SCENARIOS"}
          </p>
          <Link
            href="/scenarios"
            className="font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-accent transition"
          >
            View all →
          </Link>
        </div>
        <ScenarioPreviewStrip scenarios={scenarios} featured={featured} error={scenariosError} />
      </section>

      <section aria-labelledby="capabilities-title" className="border-t border-border pt-6">
        <p
          id="capabilities-title"
          className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted mb-3"
        >
          {"// CAPABILITIES"}
        </p>
        <ul className="flex flex-wrap gap-2" data-testid="capability-chips">
          <CapabilityChip href={replayHref} label="Deterministic replay (SHA-256 fingerprint)" />
          <CapabilityChip
            href="/scenarios"
            label="Explainable fault escalation (NORMAL → DEGRADED → SAFE_MODE → FAILED)"
          />
          <CapabilityChip href="/scenarios" label="Redundant controller voting (3-of-3 majority)" />
        </ul>
      </section>
    </div>
  );
}

function SimulatesItem({
  stripeClass,
  heading,
  body,
}: {
  stripeClass: string;
  heading: string;
  body: string;
}) {
  return (
    <li className="relative bg-surface border border-border rounded-md overflow-hidden p-4 pl-5">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${stripeClass}`} aria-hidden />
      <h3 className="font-semibold text-text-primary text-sm">{heading}</h3>
      <p className="text-sm text-text-muted leading-snug pt-1">{body}</p>
    </li>
  );
}

function ScenarioPreviewStrip({
  scenarios,
  featured,
  error,
}: {
  scenarios: Scenario[] | null;
  featured: Scenario[];
  error: string | null;
}) {
  if (error) {
    return (
      <p
        className="font-mono text-xs text-text-muted"
        role="status"
        data-testid="landing-scenarios-error"
      >
        Scenarios temporarily unavailable.
      </p>
    );
  }

  if (scenarios === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden
            className="bg-surface-elevated border border-border rounded-md h-40 animate-pulse motion-reduce:animate-none"
            data-testid="landing-scenario-skeleton"
          />
        ))}
      </div>
    );
  }

  if (featured.length === 0) {
    return (
      <p className="font-mono text-xs text-text-muted" role="status">
        No featured scenarios available.
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      data-testid="landing-scenario-grid"
    >
      {featured.map((scenario) => (
        <LandingScenarioPreview key={scenario.name} scenario={scenario} mode="grid" />
      ))}
    </div>
  );
}

function CapabilityChip({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex items-center font-mono text-[11px] tracking-wide px-3 py-1.5 rounded-full border border-border text-text-muted hover:border-accent hover:text-text-primary transition"
      >
        {label}
      </Link>
    </li>
  );
}
