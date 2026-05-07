"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const SystemCheckHero3D = dynamic(() => import("@/components/SystemCheckHero3D"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" />,
});

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="bg-gradient-to-b from-bg to-surface-elevated border border-border rounded-xl p-6 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5 order-last lg:order-first">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              DETERMINISTIC // FAULT-TOLERANT // CONTROL SYSTEM SIMULATION
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-text-primary tracking-tight">
              DriftGuard
            </h1>
            <p className="text-text-muted leading-relaxed max-w-xl">
              A deterministic, fault-tolerant control system simulation. Three redundant controllers
              process noisy sensor data, vote by majority, and escalate through{" "}
              <code className="font-mono text-status-nominal">NORMAL</code>
              {" → "}
              <code className="font-mono text-status-degraded">DEGRADED</code>
              {" → "}
              <code className="font-mono text-status-safemode">SAFE_MODE</code>
              {" → "}
              <code className="font-mono text-status-failed">FAILED</code> as fault detection erodes
              trust. Every decision is reproducible from a seed, and every step is logged for audit.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center font-mono uppercase text-xs tracking-wider px-5 py-2.5 rounded-md bg-accent text-bg hover:opacity-90 transition"
              >
                Open Dashboard
              </Link>
              <Link
                href="/scenarios"
                className="inline-flex items-center font-mono uppercase text-xs tracking-wider px-5 py-2.5 rounded-md border border-border text-text-primary hover:border-accent transition"
              >
                Browse Scenarios
              </Link>
            </div>
          </div>
          <div>
            <SystemCheckHero3D />
          </div>
        </div>
      </section>

      <section className="hidden md:block border-y border-border bg-surface -mx-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-8 gap-y-2 py-3 font-mono text-xs uppercase tracking-wider text-text-muted">
          <LegendPill colorClass="bg-status-nominal" label="NOMINAL" />
          <LegendPill colorClass="bg-status-degraded" label="DEGRADED" />
          <LegendPill colorClass="bg-status-safemode" label="SAFE_MODE" />
          <LegendPill colorClass="bg-status-failed" label="FAILED" />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FeatureCard
          href="/dashboard"
          stripeClass="bg-status-nominal"
          title="Dashboard"
          body="Create a simulation, run steps, inject faults, watch state."
        />
        <FeatureCard
          href="/scenarios"
          stripeClass="bg-status-degraded"
          title="Scenarios"
          body="Run named mission profiles: nominal cruise, sensor drift, split vote escalation, multi-fault failure, intermittent fault."
        />
        <FeatureCard
          href="https://github.com/mpalmer79/SentinelNav"
          stripeClass="bg-accent"
          title="Source"
          body="Backend (FastAPI), simulation core (Python), persistence (SQLite), and this frontend (Next.js + TypeScript)."
          external
        />
      </section>

      <section className="bg-surface border border-border rounded-xl px-6 py-8 md:px-10 md:py-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted mb-3">
          {"// WHY THIS EXISTS"}
        </p>
        <p className="text-text-primary leading-relaxed max-w-[640px]">
          Aerospace, defense, automotive, and medical systems frequently rely on triple-redundant
          controllers with majority voting and explicit safe-mode behavior. DriftGuard models that
          pattern in a clean, inspectable way. It is not a flight simulator — it is a small,
          deterministic test bed for fault handling, recovery, and audit.
        </p>
      </section>
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

function FeatureCard({
  href,
  stripeClass,
  title,
  body,
  external = false,
}: {
  href: string;
  stripeClass: string;
  title: string;
  body: string;
  external?: boolean;
}) {
  const className =
    "group relative block bg-surface-elevated border border-border rounded-lg p-6 pl-7 overflow-hidden transition duration-150 hover:-translate-y-0.5 hover:border-accent";
  const inner = (
    <>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${stripeClass}`} aria-hidden />
      <h2 className="font-semibold mb-1.5 text-text-primary">{title}</h2>
      <p className="text-sm text-text-muted leading-relaxed">{body}</p>
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
