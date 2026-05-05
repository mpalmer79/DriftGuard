"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/Card";
import { EventTimeline } from "@/components/EventTimeline";
import { FaultTimeline } from "@/components/FaultTimeline";
import { VehicleStateCard } from "@/components/VehicleStateCard";
import { AltitudeChart, HorizontalSpeedChart, ModeBand } from "@/components/charts/TelemetryCharts";
import { TrajectoryMap } from "@/components/charts/TrajectoryMap";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useDecisions,
  useEvents,
  useFaults,
  useSimulation,
  useSimulationState,
  useTrajectory,
} from "@/lib/hooks/useSimulations";

export default function SimulationDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const meta = useSimulation(id);
  const stateQ = useSimulationState(id);
  const events = useEvents(id);
  const faults = useFaults(id);
  const decisions = useDecisions(id);
  const trajectory = useTrajectory(id);

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

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{id}</h1>
        <span className="text-xs text-gray-400">seed {meta.data.simulation?.seed}</span>
        <span className="text-xs text-gray-400">{meta.data.step_count} steps</span>
        <div className="ml-auto flex gap-3 text-sm">
          <Link className="text-sentinel-accent" href={`/simulations/${id}/live`}>
            live →
          </Link>
          <Link className="text-sentinel-accent" href={`/simulations/${id}/replay`}>
            replay →
          </Link>
          <Link className="text-sentinel-accent" href={`/simulations/${id}/report`}>
            report →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VehicleStateCard state={stateQ.data ?? null} />
        <FaultTimeline faults={faults.data ?? []} />
      </div>

      <TrajectoryMap points={trajectory.data ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AltitudeChart points={trajectory.data ?? []} />
        <HorizontalSpeedChart points={trajectory.data ?? []} />
      </div>

      <ModeBand
        decisions={
          (decisions.data ?? []) as { step: number; system_mode: string; final_action: string }[]
        }
      />

      <Card title={`Decisions (${decisions.data?.length ?? 0})`}>
        {decisions.data && decisions.data.length > 0 ? (
          <div className="text-xs max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead className="text-gray-400 text-left">
                <tr>
                  <th className="py-1">step</th>
                  <th>mode</th>
                  <th>action</th>
                  <th>justification</th>
                </tr>
              </thead>
              <tbody>
                {(
                  decisions.data as {
                    step: number;
                    system_mode: string;
                    final_action: string;
                    justification: string;
                  }[]
                ).map((d) => (
                  <tr key={d.step} className="border-t border-sentinel-border">
                    <td className="py-1">{d.step}</td>
                    <td>{d.system_mode}</td>
                    <td>{d.final_action}</td>
                    <td className="opacity-80">{d.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No decisions yet"
            description="Run the simulation forward to see decisions."
          />
        )}
      </Card>

      <EventTimeline events={events.data ?? []} limit={120} />
    </div>
  );
}
