"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/Card";
import { SystemModeBadge } from "@/components/SystemModeBadge";
import { TrajectoryMap } from "@/components/charts/TrajectoryMap";
import { AltitudeChart, HorizontalSpeedChart } from "@/components/charts/TelemetryCharts";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import type { SystemMode } from "@/types/api";

interface StreamPoint {
  step: number;
  system_mode: string;
  final_action: string;
  altitude: number;
  velocity: number;
  heading: number;
  position_x: number;
  position_y: number;
}

const SPEEDS = [
  { label: "1×", value: 1 },
  { label: "5×", value: 5 },
  { label: "50×", value: 50 },
];

export default function LiveSimulationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [points, setPoints] = useState<StreamPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [steps, setSteps] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  function start() {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setError(null);
    setRunning(true);
    const src = new EventSource(api.streamUrl(id, steps, speed));
    sourceRef.current = src;
    src.addEventListener("step", (ev: MessageEvent) => {
      try {
        const point: StreamPoint = JSON.parse(ev.data);
        setPoints((prev) => [...prev, point]);
      } catch {
        // Ignore malformed payloads.
      }
    });
    src.addEventListener("end", () => {
      src.close();
      sourceRef.current = null;
      setRunning(false);
    });
    src.onerror = () => {
      setError("Live stream interrupted. Make sure the simulation is in memory.");
      src.close();
      sourceRef.current = null;
      setRunning(false);
    };
  }

  function stop() {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setRunning(false);
  }

  function clear() {
    stop();
    setPoints([]);
  }

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const last = points[points.length - 1];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Live</h1>
        <span className="text-xs text-gray-400">{id}</span>
        {last && <SystemModeBadge mode={last.system_mode as SystemMode} />}
        {last && <span className="text-xs text-gray-400">step {last.step}</span>}
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            steps:
            <input
              type="number"
              value={steps}
              min={1}
              max={500}
              onChange={(e) => setSteps(Math.max(1, Math.min(500, Number(e.target.value))))}
              disabled={running}
              className="bg-dg-panel border border-dg-border rounded px-2 py-1 w-20"
              aria-label="number of steps to stream"
            />
          </label>
          <fieldset className="flex items-center gap-1" aria-label="playback speed">
            <legend className="sr-only">playback speed</legend>
            <span className="text-gray-400">speed:</span>
            {SPEEDS.map((s) => (
              <Button
                key={s.value}
                variant={speed === s.value ? "primary" : "secondary"}
                size="sm"
                disabled={running}
                onClick={() => setSpeed(s.value)}
                aria-pressed={speed === s.value}
              >
                {s.label}
              </Button>
            ))}
          </fieldset>
          <div className="ml-auto flex gap-2">
            {!running ? (
              <Button variant="primary" onClick={start}>
                play
              </Button>
            ) : (
              <Button variant="secondary" onClick={stop}>
                pause
              </Button>
            )}
            <Button variant="ghost" onClick={clear} disabled={running}>
              clear
            </Button>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} retry={start} />}

      {points.length === 0 ? (
        <EmptyState
          title="// AWAITING SSE STREAM"
          description="Press Play to start the SSE stream. Steps will appear here as the simulation runs."
        />
      ) : (
        <>
          <TrajectoryMap points={points} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AltitudeChart points={points} />
            <HorizontalSpeedChart points={points} />
          </div>
        </>
      )}
    </div>
  );
}
