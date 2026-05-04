"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { TimelineEntry } from "@/types/api";
import { Card } from "@/components/Card";
import { SystemModeBadge } from "@/components/SystemModeBadge";
import { ControllerOutputTable } from "@/components/ControllerOutputTable";
import { VoteResultCard } from "@/components/VoteResultCard";
import { StepReplayControls } from "@/components/StepReplayControls";

export default function ReplayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
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
  }, [id]);

  if (error) return <p className="text-sentinel-bad">{error}</p>;
  if (timeline.length === 0)
    return <p className="text-gray-400">No timeline available yet.</p>;

  const current = timeline[index];
  const decision = current?.decision;
  const sensor = current?.sensor;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Sensor reading">
          {sensor ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Row k="status" v={sensor.status} />
              <Row k="confidence" v={sensor.confidence} />
              <Row k="altitude" v={Number(sensor.altitude).toFixed(2)} />
              <Row k="velocity" v={Number(sensor.velocity).toFixed(2)} />
              <Row k="heading" v={Number(sensor.heading).toFixed(2)} />
              <Row
                k="fault flags"
                v={(sensor.fault_flags || []).join(", ") || "—"}
              />
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No sensor reading.</p>
          )}
        </Card>
        <Card title="Decision">
          {decision ? (
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-400">action: </span>
                <span className="text-sentinel-accent">{decision.final_action}</span>
              </div>
              <div>
                <span className="text-gray-400">mode: </span>
                {decision.system_mode}
              </div>
              <div className="text-gray-400">{decision.justification}</div>
              <div className="text-xs text-gray-500 pt-2">
                trusted: {(decision.trusted ?? []).join(", ") || "—"}
              </div>
              <div className="text-xs text-gray-500">
                rejected: {(decision.rejected ?? []).join(", ") || "—"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No decision.</p>
          )}
        </Card>
      </div>

      <ControllerOutputTable
        outputs={(current?.controllers ?? []).map((c: any) => ({
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
                agreeing_controllers: current.vote.agreeing ?? [],
                rejected_controllers: current.vote.rejected ?? [],
                reason: current.vote.reason,
              }
            : null
        }
      />

      <Card title={`Events at step ${current?.step}`}>
        {current?.events?.length ? (
          <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {current.events.map((e: any) => (
              <li key={e.event_id}>
                <span className="text-gray-500">{e.component}</span>{" "}
                <span className="opacity-80">{e.type}</span>{" "}
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No events at this step.</p>
        )}
      </Card>
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
