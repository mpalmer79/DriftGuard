"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { DecisionRecord, FaultRecord, TimelineEntry } from "@/types/api";
import { Card } from "@/components/Card";
import { CausalityPanel } from "@/components/CausalityPanel";
import { DecisionPipeline } from "@/components/DecisionPipeline";
import { FaultEvidenceCard } from "@/components/FaultEvidenceCard";
import { FingerprintBadge } from "@/components/FingerprintBadge";
import { ModeTimeline } from "@/components/ModeTimeline";
import { ReplayExplainer } from "@/components/ReplayExplainer";
import { ReplayVerificationPanel } from "@/components/ReplayVerificationPanel";
import { SystemModeBadge } from "@/components/SystemModeBadge";
import { ControllerOutputTable } from "@/components/ControllerOutputTable";
import { VoteResultCard } from "@/components/VoteResultCard";
import { StepReplayControls } from "@/components/StepReplayControls";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

type LoadStatus = "loading" | "ready" | "error";

export default function ReplayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const scenarioName = searchParams?.get("scenario") ?? null;

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    Promise.allSettled([api.getTimeline(id), api.getFaults(id), api.getReplayFingerprint(id)]).then(
      ([tl, fa, fp]) => {
        if (!active) return;
        if (tl.status === "fulfilled") {
          setTimeline(tl.value);
          setIndex(0);
          setStatus("ready");
        } else {
          setError(tl.reason?.message ?? "Failed to load timeline.");
          setStatus("error");
        }
        if (fa.status === "fulfilled") setFaults(fa.value);
        else setFaults([]);
        if (fp.status === "fulfilled") setFingerprint(fp.value.fingerprint);
        else setFingerprint(null);
      }
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton width="40%" height="2rem" />
        <Skeleton height="6rem" />
        <Skeleton height="14rem" />
      </div>
    );
  }

  if (status === "error" && error) {
    return <ErrorState message={error} retry={() => location.reload()} />;
  }

  if (timeline.length === 0) {
    return (
      <EmptyState
        title="// NO TIMELINE AVAILABLE YET"
        description="Run a scenario or step a simulation forward to populate the replay timeline."
        action={
          <Link
            href="/scenarios"
            className="inline-flex items-center font-mono uppercase text-xs tracking-wider text-accent hover:underline"
          >
            Browse scenarios →
          </Link>
        }
      />
    );
  }

  const current = timeline[index];
  const decision = current?.decision;
  const previousDecision: DecisionRecord | null =
    index > 0 ? (timeline[index - 1].decision as DecisionRecord) : null;
  const sensor = current?.sensor;

  // Faults without an explicit end_step are treated as open-ended.
  const activeFaults = faults.filter((f) => {
    if (!current) return false;
    const ends = f.end_step ?? Number.POSITIVE_INFINITY;
    return current.step >= f.start_step && current.step <= ends;
  });

  const decisions: DecisionRecord[] = timeline.map((entry) => entry.decision as DecisionRecord);

  const faultStartSteps = Array.from(new Set(faults.map((f) => f.start_step))).sort(
    (a, b) => a - b
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Replay</h1>
        {decision && <SystemModeBadge mode={decision.system_mode} />}
        <code className="font-mono text-[11px] text-text-muted break-all">{id}</code>
        {fingerprint && <FingerprintBadge fingerprint={fingerprint} compact label="FINGERPRINT" />}
      </header>

      <Card>
        <StepReplayControls
          total={timeline.length}
          index={index}
          onChange={setIndex}
          faultSteps={faultStartSteps}
        />
      </Card>

      <ModeTimeline decisions={decisions} currentStep={current?.step} />

      <CausalityPanel
        decision={(decision as DecisionRecord) ?? null}
        previousDecision={previousDecision}
        faults={activeFaults}
        replayFingerprint={fingerprint}
      />

      <DecisionPipeline step={current ?? null} />

      {activeFaults.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
            Fault evidence at step {current?.step}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeFaults.map((fault) => (
              <FaultEvidenceCard key={fault.fault_id} fault={fault} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Sensor reading">
          {sensor ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
              <Row k="status" v={sensor.status} />
              <Row k="confidence" v={sensor.confidence} />
              <Row k="altitude" v={Number(sensor.altitude).toFixed(2)} />
              <Row k="velocity" v={Number(sensor.velocity).toFixed(2)} />
              <Row k="heading" v={Number(sensor.heading).toFixed(2)} />
              <Row k="fault flags" v={(sensor.fault_flags || []).join(", ") || "—"} />
            </dl>
          ) : (
            <p className="font-mono text-xs text-text-muted">No sensor reading at this step.</p>
          )}
        </Card>
        <Card title="Vote details">
          {decision ? (
            <div className="text-sm space-y-1 font-mono">
              <div className="text-xs text-text-muted">
                trusted: {(decision.trusted_controllers ?? []).join(", ") || "—"}
              </div>
              <div className="text-xs text-text-muted">
                rejected: {(decision.rejected_controllers ?? []).join(", ") || "—"}
              </div>
              <div className="text-text-muted pt-2">{decision.justification}</div>
            </div>
          ) : (
            <p className="font-mono text-xs text-text-muted">No decision at this step.</p>
          )}
        </Card>
      </div>

      <ControllerOutputTable
        outputs={(current?.controllers ?? []).map((c) => ({
          ...c,
          valid: !!c.valid,
        }))}
      />
      <VoteResultCard
        vote={
          current?.vote
            ? {
                outcome: current.vote.outcome,
                selected_action: current.vote.selected_action,
                agreeing_controllers: current.vote.agreeing_controllers ?? [],
                rejected_controllers: current.vote.rejected_controllers ?? [],
                reason: current.vote.reason,
              }
            : null
        }
      />

      <Card title={`Events at step ${current?.step}`}>
        {current?.events?.length ? (
          <ul className="text-xs space-y-1 max-h-64 overflow-y-auto font-mono">
            {current.events.map((e) => (
              <li key={e.event_id}>
                <span className="text-text-muted">{e.component}</span>{" "}
                <span className="opacity-80">{e.type}</span> <span>{e.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-text-muted">No events at this step.</p>
        )}
      </Card>

      <ReplayVerificationPanel
        simulationId={id}
        fingerprint={fingerprint}
        stepCount={timeline.length}
        scenarioName={scenarioName}
      />

      <ReplayExplainer simulationId={id} fingerprint={fingerprint} stepCount={timeline.length} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-muted">{k}</dt>
      <dd className="text-text-primary">{String(v)}</dd>
    </div>
  );
}
