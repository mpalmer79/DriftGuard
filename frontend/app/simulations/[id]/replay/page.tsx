"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { DecisionRecord, FaultRecord, TimelineEntry } from "@/types/api";
import { Card } from "@/components/Card";
import { CausalityPanel } from "@/components/CausalityPanel";
import { DecisionPipeline } from "@/components/DecisionPipeline";
import { FaultEvidenceCard } from "@/components/FaultEvidenceCard";
import { ModeTimeline } from "@/components/ModeTimeline";
import { ReplayExplainer } from "@/components/ReplayExplainer";
import { SystemModeBadge } from "@/components/SystemModeBadge";
import { ControllerOutputTable } from "@/components/ControllerOutputTable";
import { VoteResultCard } from "@/components/VoteResultCard";
import { StepReplayControls } from "@/components/StepReplayControls";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ReplayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTimeline(id)
      .then((t) => {
        setTimeline(t);
        setIndex(0);
      })
      .catch((e) => setError(e.message));
    api
      .getFaults(id)
      .then(setFaults)
      .catch(() => setFaults([]));
    api
      .getReplayFingerprint(id)
      .then((r) => setFingerprint(r.fingerprint))
      .catch(() => setFingerprint(null));
  }, [id]);

  if (error) return <p className="text-dg-bad">{error}</p>;
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

  // Active faults at the current replay step. A fault is active when
  // its window contains the current step (faults without an explicit
  // end_step are open-ended).
  const activeFaults = faults.filter((f) => {
    if (!current) return false;
    const ends = f.end_step ?? Number.POSITIVE_INFINITY;
    return current.step >= f.start_step && current.step <= ends;
  });

  // Decisions list derived from the timeline so ModeTimeline can
  // render the segment band without an extra round-trip.
  const decisions: DecisionRecord[] = timeline.map((entry) => entry.decision as DecisionRecord);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Replay</h1>
        {decision && <SystemModeBadge mode={decision.system_mode} />}
        <span className="text-xs text-gray-400">{id}</span>
      </header>

      <Card>
        <StepReplayControls total={timeline.length} index={index} onChange={setIndex} />
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
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Row k="status" v={sensor.status} />
              <Row k="confidence" v={sensor.confidence} />
              <Row k="altitude" v={Number(sensor.altitude).toFixed(2)} />
              <Row k="velocity" v={Number(sensor.velocity).toFixed(2)} />
              <Row k="heading" v={Number(sensor.heading).toFixed(2)} />
              <Row k="fault flags" v={(sensor.fault_flags || []).join(", ") || "—"} />
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No sensor reading.</p>
          )}
        </Card>
        <Card title="Vote details">
          {decision ? (
            <div className="text-sm space-y-1 font-mono">
              <div className="text-xs text-gray-500">
                trusted: {(decision.trusted_controllers ?? []).join(", ") || "—"}
              </div>
              <div className="text-xs text-gray-500">
                rejected: {(decision.rejected_controllers ?? []).join(", ") || "—"}
              </div>
              <div className="text-gray-400 pt-2">{decision.justification}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No decision.</p>
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
          <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {current.events.map((e) => (
              <li key={e.event_id}>
                <span className="text-gray-500">{e.component}</span>{" "}
                <span className="opacity-80">{e.type}</span> <span>{e.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No events at this step.</p>
        )}
      </Card>

      <ReplayExplainer simulationId={id} fingerprint={fingerprint} stepCount={timeline.length} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-400">{k}</dt>
      <dd>{String(v)}</dd>
    </div>
  );
}
