"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StepResponse, VehicleState } from "@/types/api";
import { Card } from "@/components/Card";
import { ControllerOutputTable } from "@/components/ControllerOutputTable";
import { VehicleStateCard } from "@/components/VehicleStateCard";
import { VoteResultCard } from "@/components/VoteResultCard";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";

export default function DashboardPage() {
  const [sims, setSims] = useState<{ id: string; seed: number; created_at: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [latest, setLatest] = useState<StepResponse | null>(null);
  const [state, setState] = useState<VehicleState | null>(null);
  const [seed, setSeed] = useState(42);
  const [busy, setBusy] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api
      .getState(activeId)
      .then(setState)
      .catch(() => setState(null));
  }, [activeId]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createSimulation(seed);
      setActiveId(res.simulation_id);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function step(times = 1) {
    if (!activeId) return;
    setBusy(true);
    try {
      let last: StepResponse | null = null;
      for (let i = 0; i < times; i++) {
        last = await api.stepSimulation(activeId);
      }
      setLatest(last);
      if (last) setState(last.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="ml-auto flex gap-2 items-center text-sm">
          <label className="text-gray-400" htmlFor="dash-seed">
            seed
          </label>
          <input
            id="dash-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="bg-sentinel-panel border border-sentinel-border rounded px-2 py-1 w-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sentinel-accent"
            aria-label="seed for new simulation"
          />
          <Button variant="primary" onClick={create} disabled={busy}>
            new simulation
          </Button>
        </div>
      </header>

      {error && <ErrorState message={error} retry={refreshList} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Simulations" className="md:col-span-1">
          {sims.length === 0 ? (
            <EmptyState
              title="No simulations yet"
              description="Click 'new simulation' to start one."
            />
          ) : (
            <ul className="text-xs space-y-1" aria-label="simulation list">
              {sims.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveId(s.id)}
                    aria-current={activeId === s.id ? "true" : undefined}
                    className={`block w-full text-left px-2 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sentinel-accent ${
                      activeId === s.id ? "bg-sentinel-accent/20" : "hover:bg-sentinel-border/40"
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
            <Button variant="primary" onClick={() => step(1)} disabled={!activeId || busy}>
              run 1 step
            </Button>
            <Button onClick={() => step(5)} disabled={!activeId || busy}>
              run 5 steps
            </Button>
            <Button onClick={() => step(20)} disabled={!activeId || busy}>
              run 20 steps
            </Button>
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
              <ControllerOutputTable outputs={latest.controllers} />
              <VoteResultCard vote={latest.vote} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
