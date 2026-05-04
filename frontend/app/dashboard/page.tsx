"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { StepResponse, VehicleState } from "@/types/api";
import { Card } from "@/components/Card";
import { VehicleStateCard } from "@/components/VehicleStateCard";
import { ControllerOutputTable } from "@/components/ControllerOutputTable";
import { VoteResultCard } from "@/components/VoteResultCard";

export default function DashboardPage() {
  const [sims, setSims] = useState<{ id: string; seed: number; created_at: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [latest, setLatest] = useState<StepResponse | null>(null);
  const [state, setState] = useState<VehicleState | null>(null);
  const [seed, setSeed] = useState(42);

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
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api.getState(activeId).then(setState).catch(() => setState(null));
  }, [activeId]);

  async function create() {
    try {
      const res = await api.createSimulation(seed);
      setActiveId(res.simulation_id);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function step(times = 1) {
    if (!activeId) return;
    try {
      let last: StepResponse | null = null;
      for (let i = 0; i < times; i++) {
        last = await api.stepSimulation(activeId);
      }
      setLatest(last);
      if (last) setState(last.state);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="ml-auto flex gap-2 items-center text-sm">
          <label className="text-gray-400">seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="bg-sentinel-panel border border-sentinel-border rounded px-2 py-1 w-20"
          />
          <button
            onClick={create}
            className="px-3 py-1 rounded bg-sentinel-accent/20 border border-sentinel-accent/40"
          >
            new simulation
          </button>
        </div>
      </header>

      {error && <p className="text-sentinel-bad text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Simulations" className="md:col-span-1">
          {sims.length === 0 ? (
            <p className="text-sm text-gray-500">No simulations yet.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {sims.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveId(s.id)}
                    className={`block w-full text-left px-2 py-1 rounded ${
                      activeId === s.id ? "bg-sentinel-accent/20" : ""
                    }`}
                  >
                    <span className="opacity-80">{s.id}</span>
                    <span className="ml-2 text-gray-500">seed {s.seed}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="md:col-span-2 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => step(1)}
              disabled={!activeId}
              className="px-3 py-1 rounded bg-sentinel-accent/20 border border-sentinel-accent/40 text-sm disabled:opacity-50"
            >
              run 1 step
            </button>
            <button
              onClick={() => step(5)}
              disabled={!activeId}
              className="px-3 py-1 rounded border border-sentinel-border text-sm disabled:opacity-50"
            >
              run 5 steps
            </button>
            <button
              onClick={() => step(20)}
              disabled={!activeId}
              className="px-3 py-1 rounded border border-sentinel-border text-sm disabled:opacity-50"
            >
              run 20 steps
            </button>
            {activeId && (
              <Link
                href={`/simulations/${activeId}`}
                className="ml-auto text-sm text-sentinel-accent self-center"
              >
                detail →
              </Link>
            )}
          </div>

          <VehicleStateCard state={state} />
          {latest && (
            <>
              <ControllerOutputTable outputs={latest.controllers as any} />
              <VoteResultCard vote={latest.vote as any} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
