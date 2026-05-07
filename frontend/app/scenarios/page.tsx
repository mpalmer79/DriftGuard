"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Scenario } from "@/types/api";
import { ScenarioCard } from "@/components/ScenarioCard";

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listScenarios()
      .then((s) => {
        if (active) setScenarios(s);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  const loading = scenarios === null && error === null;
  const empty = scenarios !== null && scenarios.length === 0;

  return (
    <div className="space-y-8">
      <style>{skeletonCss}</style>

      <header className="flex items-start gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            {"// DETERMINISTIC FAULT INJECTION TESTBED"}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            Scenarios
          </h1>
          <p className="text-text-muted leading-relaxed max-w-[640px]">
            Each scenario is deterministic. Same seed plus same fault schedule produces the same
            decisions and events.
          </p>
        </div>
        <Link
          href="/scenarios/new"
          className="ml-auto inline-flex items-center font-mono uppercase text-xs tracking-wider px-5 py-2.5 rounded-md bg-accent text-bg hover:opacity-90 transition"
        >
          New Scenario
        </Link>
      </header>

      <section className="hidden md:block border-y border-border bg-surface -mx-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-8 gap-y-2 py-3 font-mono text-xs uppercase tracking-wider text-text-muted">
          <LegendPill colorClass="bg-status-nominal" label="NOMINAL" />
          <LegendPill colorClass="bg-status-degraded" label="DEGRADED" />
          <LegendPill colorClass="bg-status-safemode" label="SAFE_MODE" />
          <LegendPill colorClass="bg-status-failed" label="FAILED" />
        </div>
      </section>

      {error && (
        <div
          className="relative bg-surface-elevated border border-status-failed rounded-md overflow-hidden"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--status-failed) 10%, var(--surface-elevated))",
            borderColor:
              "color-mix(in srgb, var(--status-failed) 40%, var(--border))",
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 bg-status-failed"
            aria-hidden
          />
          <p className="font-mono text-sm text-status-failed p-4 pl-5 break-words">{error}</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {empty && (
        <p className="font-mono text-sm text-text-muted text-center py-16">
          {"// NO SCENARIOS REGISTERED"}
        </p>
      )}

      {scenarios && scenarios.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenarios.map((s) => (
            <ScenarioCard key={s.name} scenario={s} />
          ))}
        </div>
      )}
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

function SkeletonCard() {
  return (
    <div
      className="relative bg-surface-elevated border border-border rounded-md overflow-hidden dg-skeleton"
      aria-hidden
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-border" />
      <div className="p-5 pl-6 space-y-3">
        <div className="h-4 w-2/3 rounded bg-border" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-border" />
          <div className="h-3 w-5/6 rounded bg-border" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="h-3 w-1/3 rounded bg-border" />
          <div className="h-3 w-3/4 rounded bg-border" />
        </div>
        <div className="h-3 w-1/2 rounded bg-border" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 w-24 rounded-md bg-border" />
          <div className="h-8 w-32 rounded-md bg-border" />
        </div>
      </div>
    </div>
  );
}

const skeletonCss = `
@keyframes dg-skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
.dg-skeleton {
  animation: dg-skeleton-pulse 1.5s ease-in-out infinite;
}
`;
