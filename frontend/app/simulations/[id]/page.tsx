"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CausalityPanel } from "@/components/CausalityPanel";
import { DecisionPipeline } from "@/components/DecisionPipeline";
import { EventTimeline } from "@/components/EventTimeline";
import { FaultTimeline } from "@/components/FaultTimeline";
import { FingerprintBadge } from "@/components/FingerprintBadge";
import { ModeLegend } from "@/components/ModeLegend";
import { ModeTimeline } from "@/components/ModeTimeline";
import { ReplayExplainer } from "@/components/ReplayExplainer";
import { ReplayNarrator } from "@/components/ReplayNarrator";
import { ReplayPlaybackBar } from "@/components/ReplayPlaybackBar";
import { ReplayVerificationPanel } from "@/components/ReplayVerificationPanel";
import { SystemModeBadge } from "@/components/SystemModeBadge";
import TriplexHero3D from "@/components/TriplexHero3D";
import { TrustEvolution } from "@/components/TrustEvolution";
import { VehicleStateCard } from "@/components/VehicleStateCard";
import { VotePanel } from "@/components/VotePanel";
import { LiveTrajectoryCanvas } from "@/components/charts/LiveTrajectoryCanvas";
import { AltitudeChart, HorizontalSpeedChart, ModeBand } from "@/components/charts/TelemetryCharts";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { useReplayClock } from "@/lib/hooks/useReplayClock";
import {
  useDecisions,
  useEvents,
  useFaults,
  useSimulation,
  useTimeline,
  useTrajectory,
  useTrustHistory,
} from "@/lib/hooks/useSimulations";
import {
  controllerHealthAt,
  faultsJustInjectedAt,
  modeJustChangedAt,
} from "@/lib/replay/sceneState";
import type { SystemMode } from "@/types/api";

export default function SimulationDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const scenarioName = searchParams?.get("scenario") ?? null;

  const meta = useSimulation(id);
  const events = useEvents(id);
  const faults = useFaults(id);
  const decisions = useDecisions(id);
  const trajectory = useTrajectory(id);
  const timeline = useTimeline(id);
  const trustHistory = useTrustHistory(id);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const totalSteps = decisions.data?.length ?? 0;
  const clock = useReplayClock({ totalSteps, prefersReducedMotion });
  const { play: startPlayback } = clock;

  const hasAutoPlayedRef = useRef(false);
  useEffect(() => {
    if (hasAutoPlayedRef.current) return;
    if (prefersReducedMotion) return;
    if (totalSteps < 2) return;
    hasAutoPlayedRef.current = true;
    startPlayback();
  }, [prefersReducedMotion, totalSteps, startPlayback]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api
      .getReplayFingerprint(id)
      .then((r) => {
        if (active) setFingerprint(r.fingerprint);
      })
      .catch(() => {
        if (active) setFingerprint(null);
      });
    return () => {
      active = false;
    };
  }, [id, decisions.data?.length]);

  const decisionsList = decisions.data ?? null;
  const trustHistoryList = trustHistory.data ?? null;
  const faultsList = faults.data ?? null;
  const currentStep = clock.currentStep;
  const currentDecision = decisionsList?.[currentStep] ?? null;
  const previousDecision = currentStep > 0 ? (decisionsList?.[currentStep - 1] ?? null) : null;
  const currentTimelineEntry = timeline.data?.[currentStep] ?? null;

  const modeAtStep = useCallback(
    (step: number): SystemMode | null => decisionsList?.[step]?.system_mode ?? null,
    [decisionsList]
  );

  const controllerTrustAtStep = useCallback(
    (step: number): number => {
      const entries = controllerHealthAt(decisionsList?.[step] ?? null, trustHistoryList, step);
      if (entries.length === 0) return 1;
      const sum = entries.reduce((acc, h) => acc + h.trust, 0);
      return sum / entries.length;
    },
    [decisionsList, trustHistoryList]
  );

  const activeFaults = useMemo(
    () =>
      (faultsList ?? []).filter(
        (f) => f.start_step <= currentStep && (f.end_step === null || f.end_step > currentStep)
      ),
    [faultsList, currentStep]
  );
  const sceneControllers = useMemo(
    () => controllerHealthAt(currentDecision, trustHistoryList, currentStep),
    [currentDecision, trustHistoryList, currentStep]
  );
  const sceneFaultsJustInjected = useMemo(
    () => faultsJustInjectedAt(faultsList ?? [], currentStep),
    [faultsList, currentStep]
  );
  const sceneModeJustChanged = useMemo(
    () => modeJustChangedAt(decisionsList, currentStep),
    [decisionsList, currentStep]
  );
  const sceneSystemMode: SystemMode = currentDecision?.system_mode ?? "NORMAL";

  const errorStatus = (meta.error as { status?: number } | undefined)?.status;
  if (errorStatus === 404) return <SimulationNotFound id={id} />;
  if (meta.error) return <ErrorState message={meta.error.message} retry={meta.mutate} />;
  if (!meta.data) {
    return (
      <div className="space-y-4">
        <Skeleton width="40%" height="2rem" />
        <Skeleton height="12rem" />
        <Skeleton height="12rem" />
      </div>
    );
  }
  if (!meta.data.simulation) return <SimulationNotFound id={id} />;

  const seed = meta.data.simulation?.seed;

  const decisionRows = (decisions.data ?? []) as {
    step: number;
    system_mode: string;
    final_action: string;
    justification: string;
  }[];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          {"// SIMULATION"}
        </p>
        <p className="font-mono text-xs text-text-muted break-all">{id}</p>
        <div className="flex flex-wrap items-center gap-3">
          {currentDecision && <SystemModeBadge mode={currentDecision.system_mode} />}
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
            SEED {seed} / {meta.data.step_count} STEPS
          </span>
          {fingerprint && (
            <FingerprintBadge fingerprint={fingerprint} compact label="FINGERPRINT" />
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-5">
          <DetailLink href={`/simulations/${id}/live`}>live →</DetailLink>
          <DetailLink href={`/simulations/${id}/replay`}>replay →</DetailLink>
          <DetailLink href={`/simulations/${id}/report`}>report →</DetailLink>
        </nav>
        <ModeLegend />
      </header>

      <TriplexHero3D
        controllers={sceneControllers}
        systemMode={sceneSystemMode}
        modeJustChanged={sceneModeJustChanged}
        faultsJustInjected={sceneFaultsJustInjected}
        prefersReducedMotion={prefersReducedMotion}
      />

      <ReplayNarrator decision={currentDecision} faults={activeFaults} />

      <CausalityPanel
        decision={currentDecision}
        previousDecision={previousDecision}
        faults={faults.data ?? []}
        replayFingerprint={fingerprint}
      />

      <ModeTimeline decisions={decisions.data ?? []} currentStep={clock.currentStep} />

      {currentTimelineEntry && <DecisionPipeline step={currentTimelineEntry} />}

      {currentTimelineEntry && (
        <VotePanel
          controllers={currentTimelineEntry.controllers}
          vote={currentTimelineEntry.vote}
        />
      )}

      <TrustEvolution timeline={timeline.data ?? []} trustHistory={trustHistory.data ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VehicleStateCard state={currentTimelineEntry?.state ?? null} />
        <FaultTimeline faults={faults.data ?? []} />
      </div>

      <details className="surface-elevated-grad border border-border rounded-md group">
        <summary className="cursor-pointer p-4 flex items-center justify-between gap-3 flex-wrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <span className="font-mono uppercase text-sm tracking-wider text-text-primary">
            Telemetry &amp; trajectory
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {trajectory.data?.length ?? 0} points
          </span>
        </summary>
        <div className="p-4 pt-0 space-y-4">
          <LiveTrajectoryCanvas
            points={trajectory.data ?? []}
            currentStep={clock.currentStep}
            controllerTrustAtStep={controllerTrustAtStep}
            prefersReducedMotion={prefersReducedMotion}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AltitudeChart points={trajectory.data ?? []} />
            <HorizontalSpeedChart points={trajectory.data ?? []} />
          </div>
          <ModeBand
            decisions={
              (decisions.data ?? []) as {
                step: number;
                system_mode: string;
                final_action: string;
              }[]
            }
          />
        </div>
      </details>

      <details className="surface-elevated-grad border border-border rounded-md group">
        <summary className="cursor-pointer p-4 flex items-center justify-between gap-3 flex-wrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <span className="font-mono uppercase text-sm tracking-wider text-text-primary">
            Decision log
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {decisionRows.length} {decisionRows.length === 1 ? "row" : "rows"}
          </span>
        </summary>
        <div className="px-4 pb-4">
          {decisionRows.length > 0 ? (
            <div className="text-xs max-h-72 overflow-y-auto border-t border-border">
              <table className="w-full font-mono">
                <thead className="text-text-muted uppercase tracking-wider text-left sticky top-0 bg-surface-elevated">
                  <tr>
                    <th className="py-1 font-normal">Step</th>
                    <th className="font-normal">Mode</th>
                    <th className="font-normal">Action</th>
                    <th className="font-normal">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionRows.map((d) => (
                    <tr key={d.step} className="border-t border-border">
                      <td className="py-1 text-text-primary">{d.step}</td>
                      <td className="text-text-primary">{d.system_mode}</td>
                      <td className="text-text-primary">{d.final_action}</td>
                      <td className="text-text-muted">{d.justification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <p className="font-mono text-xs text-text-muted">No decisions yet.</p>
              <Link
                href={`/simulations/${id}/live`}
                className="inline-flex items-center font-mono uppercase text-xs tracking-wider text-accent hover:underline"
              >
                Run live →
              </Link>
            </div>
          )}
        </div>
      </details>

      <ReplayVerificationPanel
        simulationId={id}
        fingerprint={fingerprint}
        stepCount={meta.data.step_count ?? 0}
        scenarioName={scenarioName}
      />

      <ReplayExplainer
        simulationId={id}
        fingerprint={fingerprint}
        stepCount={meta.data.step_count ?? 0}
      />

      <EventTimeline events={events.data ?? []} limit={120} />

      <div
        data-testid="replay-playback-sticky"
        className="sticky bottom-0 z-40 -mx-6 px-6 py-2 bg-dg-panel/95 backdrop-blur border-t border-border"
      >
        <ReplayPlaybackBar clock={clock} totalSteps={totalSteps} modeAtStep={modeAtStep} />
      </div>
    </div>
  );
}

function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono uppercase text-xs tracking-wider text-text-muted hover:text-accent transition-colors"
    >
      {children}
    </Link>
  );
}

function SimulationNotFound({ id }: { id: string }) {
  return (
    <div
      role="alert"
      className="surface-elevated-grad relative border border-border rounded-md overflow-hidden"
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-status-failed" aria-hidden />
      <div className="p-5 pl-6 space-y-3">
        <p className="font-mono uppercase text-sm tracking-wider text-status-failed">
          {"// SIMULATION NOT FOUND"}
        </p>
        <p className="font-mono text-xs text-text-muted break-words">
          simulation &lsquo;{id}&rsquo; not found
        </p>
        <p className="text-sm text-text-primary leading-relaxed max-w-[560px]">
          This simulation may have been cleared during a backend restart. Run a new scenario to
          continue.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Link
            href="/scenarios"
            className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md bg-accent text-bg hover:opacity-90 transition"
          >
            Browse Scenarios
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-mono uppercase text-xs tracking-wider px-4 py-2 rounded-md border border-border text-text-primary hover:border-accent transition"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
