"use client";

import * as React from "react";
import { Card } from "@/components/Card";

interface TrajectoryPoint {
  step: number;
  position_x: number;
  position_y: number;
  altitude: number;
  system_mode: string;
}

interface Props {
  points: TrajectoryPoint[];
}

const MODE_COLORS: Record<string, string> = {
  NORMAL: "#22c55e", // green
  DEGRADED: "#f59e0b", // amber
  SAFE_MODE: "#ef4444", // red
  FAILED: "#b91c1c", // dark red
};

const MARGIN = 30;
const SIZE = 360;

export function TrajectoryMap({ points }: Props) {
  if (!points || points.length === 0) {
    return (
      <Card title="Trajectory">
        <p className="text-sm text-gray-500">No trajectory data yet.</p>
      </Card>
    );
  }

  const xs = points.map((p) => p.position_x);
  const ys = points.map((p) => p.position_y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const span = Math.max(spanX, spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const proj = (x: number, y: number) => {
    const ndx = ((x - cx) / span) * (SIZE - 2 * MARGIN);
    const ndy = ((y - cy) / span) * (SIZE - 2 * MARGIN);
    // Flip Y so north is up.
    return [SIZE / 2 + ndx, SIZE / 2 - ndy] as const;
  };

  // Build per-mode segments so we can stroke each in its mode color.
  type Segment = { mode: string; points: [number, number][] };
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (const p of points) {
    const [px, py] = proj(p.position_x, p.position_y);
    if (!current || current.mode !== p.system_mode) {
      // Start a new segment but include the previous point so trails
      // join visually.
      if (current && current.points.length > 0) {
        current.points.push([px, py]);
      }
      current = { mode: p.system_mode, points: [[px, py]] };
      segments.push(current);
    } else {
      current.points.push([px, py]);
    }
  }

  const last = points[points.length - 1];
  const [hx, hy] = proj(last.position_x, last.position_y);

  return (
    <Card title="Trajectory">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto bg-black/40 rounded"
        role="img"
        aria-label={`Vehicle trajectory across ${points.length} steps`}
      >
        {/* Synthetic grid */}
        {[...Array(9)].map((_, i) => (
          <line
            key={`v${i}`}
            x1={(SIZE / 8) * i}
            y1={0}
            x2={(SIZE / 8) * i}
            y2={SIZE}
            stroke="#1f2937"
            strokeWidth={0.5}
          />
        ))}
        {[...Array(9)].map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(SIZE / 8) * i}
            x2={SIZE}
            y2={(SIZE / 8) * i}
            stroke="#1f2937"
            strokeWidth={0.5}
          />
        ))}

        {/* Trail per mode */}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={MODE_COLORS[seg.mode] ?? "#9ca3af"}
            strokeWidth={2}
            points={seg.points.map(([x, y]) => `${x},${y}`).join(" ")}
          />
        ))}

        {/* Current position */}
        <circle cx={hx} cy={hy} r={5} fill="#38bdf8" />
        <circle cx={hx} cy={hy} r={9} fill="none" stroke="#38bdf8" strokeOpacity={0.4} />
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(MODE_COLORS).map(([mode, color]) => (
          <span key={mode} className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: color }}
            />
            <span className="text-gray-400">{mode}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}
