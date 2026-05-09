// Live, animated trajectory canvas for the simulation detail page.
// Renders the full path, mode band, confidence corridor, and an
// animated marker driven by requestAnimationFrame (rAF) refs only.
"use client";

import * as React from "react";
import type { TrajectoryPoint } from "@/types/api";

export type LiveTrajectoryCanvasProps = {
  points: TrajectoryPoint[];
  currentStep: number;
  controllerTrustAtStep: (step: number) => number;
  prefersReducedMotion: boolean;
  className?: string;
};

const SIZE = 360;
const MARGIN = 30;
const BAND_HEIGHT = 12;
const TRAIL_LENGTH = 6;
const TWEEN_DURATION_MS = 220;

const MODE_COLORS: Record<string, string> = {
  NORMAL: "#22c55e",
  DEGRADED: "#f59e0b",
  SAFE_MODE: "#ef4444",
  FAILED: "#b91c1c",
};
const FALLBACK_MODE_COLOR = "#9ca3af";

function modeColor(mode: string): string {
  return MODE_COLORS[mode] ?? FALLBACK_MODE_COLOR;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Shortest-arc lerp between two angles (degrees).
function lerpAngle(from: number, to: number, eased: number): number {
  return from + (((((to - from) % 360) + 540) % 360) - 180) * eased;
}

type Projector = (x: number, y: number) => readonly [number, number];

type ProjectionBounds = {
  proj: Projector;
};

type Segment = { mode: string; points: [number, number][] };

type ModeBandRect = { x: number; width: number; mode: string };

type TweenState = {
  startMs: number;
  fromX: number;
  fromY: number;
  fromAngle: number;
  toX: number;
  toY: number;
  toAngle: number;
};

function buildProjection(points: TrajectoryPoint[]): ProjectionBounds {
  if (points.length === 0) {
    const proj: Projector = () => [SIZE / 2, SIZE / 2] as const;
    return { proj };
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
  const proj: Projector = (x, y) => {
    const ndx = ((x - cx) / span) * (SIZE - 2 * MARGIN);
    const ndy = ((y - cy) / span) * (SIZE - 2 * MARGIN);
    return [SIZE / 2 + ndx, SIZE / 2 - ndy] as const;
  };
  return { proj };
}

function buildSegments(points: TrajectoryPoint[], proj: Projector): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (const p of points) {
    const [px, py] = proj(p.position_x, p.position_y);
    if (!current || current.mode !== p.system_mode) {
      if (current && current.points.length > 0) {
        current.points.push([px, py]);
      }
      current = { mode: p.system_mode, points: [[px, py]] };
      segments.push(current);
    } else {
      current.points.push([px, py]);
    }
  }
  return segments;
}

function buildModeBand(points: TrajectoryPoint[]): ModeBandRect[] {
  const total = points.length;
  if (total === 0) return [];
  return points.map((p, i) => {
    const x = (i / total) * SIZE;
    const next = ((i + 1) / total) * SIZE;
    return { x, width: Math.max(0.5, next - x), mode: p.system_mode };
  });
}

function headingDegFor(points: TrajectoryPoint[], step: number, proj: Projector): number {
  if (points.length < 2) return 0;
  const idx = Math.max(0, Math.min(points.length - 1, step));
  const prevIdx = Math.max(0, idx - 1);
  const a = points[prevIdx];
  const b = points[idx];
  const [ax, ay] = proj(a.position_x, a.position_y);
  const [bx, by] = proj(b.position_x, b.position_y);
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function LiveTrajectoryCanvas({
  points,
  currentStep,
  controllerTrustAtStep,
  prefersReducedMotion,
  className,
}: LiveTrajectoryCanvasProps) {
  const markerGroupRef = React.useRef<SVGGElement | null>(null);
  const trailCircleRefs = React.useRef<Array<SVGCircleElement | null>>(
    Array.from({ length: TRAIL_LENGTH }, () => null)
  );
  const trailBufferRef = React.useRef<Array<{ x: number; y: number }>>([]);
  const tweenStateRef = React.useRef<TweenState | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastVisualRef = React.useRef<{ x: number; y: number; angle: number } | null>(null);

  const projection = React.useMemo(() => buildProjection(points), [points]);
  const segments = React.useMemo(
    () => buildSegments(points, projection.proj),
    [points, projection]
  );
  const modeBand = React.useMemo(() => buildModeBand(points), [points]);

  const totalSteps = points.length;
  const safeStep = Math.max(0, Math.min(totalSteps - 1, currentStep));

  const target = React.useMemo(() => {
    if (totalSteps === 0) {
      return { x: SIZE / 2, y: SIZE / 2, angle: 0 };
    }
    const p = points[safeStep];
    const [x, y] = projection.proj(p.position_x, p.position_y);
    const angle = headingDegFor(points, safeStep, projection.proj);
    return { x, y, angle };
  }, [points, projection, safeStep, totalSteps]);

  const currentMode = totalSteps > 0 ? points[safeStep].system_mode : "NORMAL";
  const corridorColor = modeColor(currentMode);
  const trustValue = clamp01(controllerTrustAtStep(safeStep));
  const corridorWidth = 8 + 16 * (1 - trustValue);

  const corridorPath = React.useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => {
        const [px, py] = projection.proj(p.position_x, p.position_y);
        return `${i === 0 ? "M" : "L"} ${px} ${py}`;
      })
      .join(" ");
  }, [points, projection]);

  const playheadX = totalSteps > 0 ? ((safeStep + 0.5) / totalSteps) * SIZE : 0;

  // Apply marker + trail transforms via refs (no React state).
  React.useEffect(() => {
    if (totalSteps === 0) return;

    // Reduced motion: snap once, no rAF, no trail rendering.
    if (prefersReducedMotion) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const group = markerGroupRef.current;
      if (group) {
        group.setAttribute(
          "transform",
          `translate(${target.x} ${target.y}) rotate(${target.angle})`
        );
      }
      lastVisualRef.current = { x: target.x, y: target.y, angle: target.angle };
      return;
    }

    const from = lastVisualRef.current ?? {
      x: target.x,
      y: target.y,
      angle: target.angle,
    };
    tweenStateRef.current = {
      startMs: performance.now(),
      fromX: from.x,
      fromY: from.y,
      fromAngle: from.angle,
      toX: target.x,
      toY: target.y,
      toAngle: target.angle,
    };

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tick = (now: number) => {
      const tween = tweenStateRef.current;
      if (!tween) {
        rafRef.current = null;
        return;
      }
      const elapsed = now - tween.startMs;
      const raw = elapsed / TWEEN_DURATION_MS;
      const done = raw >= 1;
      const t = done ? 1 : raw;
      const eased = easeInOutCubic(t);
      const x = tween.fromX + (tween.toX - tween.fromX) * eased;
      const y = tween.fromY + (tween.toY - tween.fromY) * eased;
      const angle = lerpAngle(tween.fromAngle, tween.toAngle, eased);

      const group = markerGroupRef.current;
      if (group) {
        group.setAttribute("transform", `translate(${x} ${y}) rotate(${angle})`);
      }

      // Push the prior visual position into the ring buffer and re-render
      // trail circles by reading from refs.
      const buffer = trailBufferRef.current;
      buffer.unshift({ x, y });
      if (buffer.length > TRAIL_LENGTH) {
        buffer.length = TRAIL_LENGTH;
      }
      for (let i = 0; i < TRAIL_LENGTH; i += 1) {
        const ref = trailCircleRefs.current[i];
        if (!ref) continue;
        const point = buffer[i] ?? { x, y };
        ref.setAttribute("cx", String(point.x));
        ref.setAttribute("cy", String(point.y));
      }

      lastVisualRef.current = { x, y, angle };

      if (done) {
        tweenStateRef.current = null;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [target, totalSteps, prefersReducedMotion]);

  // Initial transform synchronously so the first paint already places the marker.
  React.useEffect(() => {
    if (totalSteps === 0) return;
    const group = markerGroupRef.current;
    if (!group) return;
    if (lastVisualRef.current === null) {
      group.setAttribute("transform", `translate(${target.x} ${target.y}) rotate(${target.angle})`);
      lastVisualRef.current = { x: target.x, y: target.y, angle: target.angle };
    }
  }, [target, totalSteps]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      tweenStateRef.current = null;
      lastVisualRef.current = null;
      trailBufferRef.current = [];
    };
  }, []);

  const wrapperClass = [
    "relative w-full min-w-[320px] max-w-[480px] aspect-square mx-auto",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (totalSteps === 0) {
    return (
      <section aria-label="Live vehicle trajectory" className={wrapperClass}>
        <div className="font-mono text-xs text-text-muted">No trajectory data yet.</div>
      </section>
    );
  }

  const initialTransform = `translate(${target.x} ${target.y}) rotate(${target.angle})`;
  // Trail circles are omitted when reduced motion is active (cleaner than
  // collapsing them to the marker).
  const showTrail = !prefersReducedMotion;

  return (
    <section aria-label="Live vehicle trajectory" className={wrapperClass}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Live vehicle trajectory, step ${safeStep + 1} of ${totalSteps}`}
      >
        {/* Background grid */}
        <g data-testid="live-trajectory-grid">
          {Array.from({ length: 9 }, (_unused, i) => (
            <line
              key={`v${i}`}
              x1={(SIZE / 8) * i}
              y1={0}
              x2={(SIZE / 8) * i}
              y2={SIZE}
              stroke="#1f2937"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          ))}
          {Array.from({ length: 9 }, (_unused, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(SIZE / 8) * i}
              x2={SIZE}
              y2={(SIZE / 8) * i}
              stroke="#1f2937"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          ))}
        </g>

        {/* Mode band along the top edge */}
        <g data-testid="live-trajectory-mode-band">
          {modeBand.map((rect, i) => (
            <rect
              key={`band-${i}`}
              x={rect.x}
              y={0}
              width={rect.width}
              height={BAND_HEIGHT}
              fill={modeColor(rect.mode)}
            />
          ))}
          <line
            data-testid="live-trajectory-mode-caret"
            x1={playheadX}
            y1={0}
            x2={playheadX}
            y2={BAND_HEIGHT}
            stroke="#fbf6e9"
            strokeWidth={1.5}
          />
        </g>

        {/* Confidence corridor (behind the path) */}
        <path
          data-testid="live-trajectory-corridor"
          d={corridorPath}
          fill="none"
          stroke={corridorColor}
          strokeOpacity={0.15}
          strokeWidth={corridorWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Path segments per consecutive same-mode run */}
        <g data-testid="live-trajectory-segments">
          {segments.map((seg, i) => (
            <polyline
              key={`seg-${i}`}
              fill="none"
              stroke={modeColor(seg.mode)}
              strokeWidth={2}
              points={seg.points.map(([x, y]) => `${x},${y}`).join(" ")}
            />
          ))}
        </g>

        {/* Trail (omitted under reduced motion) */}
        {showTrail ? (
          <g data-testid="live-trajectory-trail">
            {Array.from({ length: TRAIL_LENGTH }, (_unused, i) => {
              const opacity = 0.8 * (1 - i / TRAIL_LENGTH);
              const radius = 3 - (2 * i) / (TRAIL_LENGTH - 1);
              return (
                <circle
                  key={`trail-${i}`}
                  ref={(el) => {
                    trailCircleRefs.current[i] = el;
                  }}
                  cx={target.x}
                  cy={target.y}
                  r={Math.max(1, radius)}
                  fill="#38bdf8"
                  opacity={Math.max(0, opacity)}
                />
              );
            })}
          </g>
        ) : null}

        {/* Vehicle marker */}
        <g ref={markerGroupRef} data-testid="live-trajectory-marker" transform={initialTransform}>
          <polygon points="0,-4 4,4 -4,4" fill="#38bdf8" />
        </g>

        {/* Step label */}
        <text
          x={SIZE - 8}
          y={SIZE - 8}
          textAnchor="end"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={10}
          fill="#5a6478"
          data-testid="live-trajectory-step-label"
        >
          STEP {safeStep + 1} / {totalSteps}
        </text>
      </svg>
    </section>
  );
}
