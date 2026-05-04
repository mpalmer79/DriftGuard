"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { FaultRecord, SimulationEvent, VehicleState } from "@/types/api";
import { Card } from "@/components/Card";
import { VehicleStateCard } from "@/components/VehicleStateCard";
import { EventTimeline } from "@/components/EventTimeline";
import { FaultTimeline } from "@/components/FaultTimeline";

export default function SimulationDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [meta, setMeta] = useState<any>(null);
  const [state, setState] = useState<VehicleState | null>(null);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getSimulation(id),
      api.getState(id).catch(() => null),
      api.getEvents(id).catch(() => []),
      api.getFaults(id),
      api.getDecisions(id),
    ])
      .then(([m, s, e, f, d]) => {
        setMeta(m);
        setState(s);
        setEvents(e ?? []);
        setFaults(f ?? []);
        setDecisions(d ?? []);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sentinel-bad">{error}</p>;
  if (!meta) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{id}</h1>
        <span className="text-xs text-gray-400">seed {meta.simulation?.seed}</span>
        <span className="text-xs text-gray-400">{meta.step_count} steps</span>
        <div className="ml-auto flex gap-3 text-sm">
          <Link className="text-sentinel-accent" href={`/simulations/${id}/replay`}>
            replay →
          </Link>
          <Link className="text-sentinel-accent" href={`/simulations/${id}/report`}>
            report →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VehicleStateCard state={state} />
        <FaultTimeline faults={faults} />
      </div>

      <Card title={`Decisions (${decisions.length})`}>
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
              {decisions.map((d) => (
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
      </Card>

      <EventTimeline events={events} limit={120} />
    </div>
  );
}
