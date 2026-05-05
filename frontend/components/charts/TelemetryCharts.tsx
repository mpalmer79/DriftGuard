"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/Card";

interface TrajectoryPoint {
  step: number;
  altitude: number;
  position_x: number;
  position_y: number;
  system_mode: string;
}

interface Decision {
  step: number;
  system_mode: string;
}

const MODE_COLORS: Record<string, string> = {
  NORMAL: "#22c55e",
  DEGRADED: "#f59e0b",
  SAFE_MODE: "#ef4444",
  FAILED: "#b91c1c",
};

interface AltitudeChartProps {
  points: TrajectoryPoint[];
}

export function AltitudeChart({ points }: AltitudeChartProps) {
  if (!points || points.length === 0) {
    return (
      <Card title="Altitude">
        <p className="text-sm text-gray-500">No data.</p>
      </Card>
    );
  }
  const data = points.map((p) => ({ step: p.step, altitude: p.altitude }));
  return (
    <Card title="Altitude over time">
      <div className="h-48" role="img" aria-label="Altitude vs step chart">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="step" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="altitude"
              stroke="#38bdf8"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function HorizontalSpeedChart({ points }: AltitudeChartProps) {
  if (!points || points.length === 0) {
    return null;
  }
  const data = points.map((p, i) => {
    if (i === 0) return { step: p.step, speed: 0 };
    const dx = p.position_x - points[i - 1].position_x;
    const dy = p.position_y - points[i - 1].position_y;
    return { step: p.step, speed: Math.hypot(dx, dy) };
  });
  return (
    <Card title="Horizontal speed (per step)">
      <div className="h-48" role="img" aria-label="Horizontal speed vs step chart">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="step" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#22c55e"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface ModeBandProps {
  decisions: Decision[];
}

/**
 * Gantt-style band: each step is a colored cell representing the
 * system mode at that step. Useful for seeing transitions at a
 * glance.
 */
export function ModeBand({ decisions }: ModeBandProps) {
  if (!decisions || decisions.length === 0) {
    return null;
  }
  return (
    <Card title="Mode timeline">
      <div
        role="img"
        aria-label={`System mode across ${decisions.length} steps`}
        className="flex flex-wrap gap-px text-[10px]"
      >
        {decisions.map((d) => (
          <span
            key={d.step}
            title={`step ${d.step}: ${d.system_mode}`}
            className="w-3 h-4 rounded-sm"
            style={{ background: MODE_COLORS[d.system_mode] ?? "#9ca3af" }}
          />
        ))}
      </div>
    </Card>
  );
}
