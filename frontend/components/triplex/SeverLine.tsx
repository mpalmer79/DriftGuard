// SeverLine.tsx — connector line between a controller and the voter core.
// Plays a 600ms bend-fade-reform animation when a controller transitions
// from trusted to rejected.

"use client";

import { useEffect, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import type { TriplexControllerHealth } from "../TriplexHero3D";

const ACCENT_TRUSTED = "#5eead4";
const COLOR_REJECTED = "#f87171";
const COLOR_NEUTRAL = "#9ca3af";

const SEVER_DURATION_S = 0.6;
const PHASE_S = 0.2;
const MAX_BEND = 0.4;
const REJECTED_BEND = 0.15;

type Vec3 = [number, number, number];

export type SeverLineProps = {
  from: Vec3;
  to: Vec3;
  health: TriplexControllerHealth;
  prefersReducedMotion: boolean;
};

type Style = {
  color: string;
  opacity: number;
  lineWidth: number;
};

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

// Perpendicular offset in the XZ plane (normalized then rotated 90deg).
function perpendicular(a: Vec3, b: Vec3): Vec3 {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  return [-dz / len, 0, dx / len];
}

function bentMidpoint(a: Vec3, b: Vec3, magnitude: number): Vec3 {
  const mid = midpoint(a, b);
  const perp = perpendicular(a, b);
  return [mid[0] + perp[0] * magnitude, mid[1] + perp[1] * magnitude, mid[2] + perp[2] * magnitude];
}

function styleFor(health: TriplexControllerHealth): Style {
  if (health.isTrusted) {
    return { color: ACCENT_TRUSTED, opacity: 0.85, lineWidth: 2 };
  }
  if (health.isRejected) {
    return { color: COLOR_REJECTED, opacity: 0.35, lineWidth: 1.5 };
  }
  return { color: COLOR_NEUTRAL, opacity: 0.4, lineWidth: 1 };
}

export function SeverLine({ from, to, health, prefersReducedMotion }: SeverLineProps) {
  const animStartRef = useRef<number | null>(null);
  const prevTrustedRef = useRef<boolean>(health.isTrusted);
  const [tick, setTick] = useState(0);

  // Detect trusted -> rejected transitions and start the snap animation.
  useEffect(() => {
    const wasTrusted = prevTrustedRef.current;
    prevTrustedRef.current = health.isTrusted;
    if (prefersReducedMotion) return;
    if (wasTrusted && health.isRejected) {
      animStartRef.current = performance.now() / 1000;
    }
  }, [health.isTrusted, health.isRejected, prefersReducedMotion]);

  // Drive the 600ms one-shot via a small per-frame state bump (gated to
  // run only while an animation is active — never on idle frames).
  useFrame((state) => {
    if (animStartRef.current === null) return;
    const t = state.clock.getElapsedTime() - animStartRef.current;
    if (t >= SEVER_DURATION_S) {
      animStartRef.current = null;
      setTick((n) => n + 1);
      return;
    }
    setTick((n) => n + 1);
  });

  const baseStyle = styleFor(health);
  let points: Vec3[];
  let color = baseStyle.color;
  let opacity = baseStyle.opacity;
  let lineWidth = baseStyle.lineWidth;

  const startedAt = animStartRef.current;
  if (startedAt !== null && !prefersReducedMotion) {
    // performance.now() is fine here — we just need a current timestamp
    // that matches the clock reference used in useFrame.
    const elapsed = performance.now() / 1000 - startedAt;
    if (elapsed < PHASE_S) {
      // Phase 1: bend from 0 to MAX_BEND.
      const k = elapsed / PHASE_S;
      points = [from, bentMidpoint(from, to, MAX_BEND * k), to];
      color = ACCENT_TRUSTED;
      opacity = 0.85;
      lineWidth = 2;
    } else if (elapsed < PHASE_S * 2) {
      // Phase 2: hold the bend, fade opacity 0.85 -> 0.
      const k = (elapsed - PHASE_S) / PHASE_S;
      points = [from, bentMidpoint(from, to, MAX_BEND), to];
      color = ACCENT_TRUSTED;
      opacity = 0.85 * (1 - k);
      lineWidth = 2;
    } else {
      // Phase 3: reform in the rejected configuration, opacity 0 -> 0.35.
      const k = (elapsed - PHASE_S * 2) / PHASE_S;
      points = [from, bentMidpoint(from, to, REJECTED_BEND), to];
      color = COLOR_REJECTED;
      opacity = 0.35 * k;
      lineWidth = 1.5;
    }
  } else if (health.isRejected) {
    points = [from, bentMidpoint(from, to, REJECTED_BEND), to];
  } else {
    points = [from, to];
  }

  // tick is read so React keeps re-rendering during the transition.
  void tick;

  return <Line points={points} color={color} opacity={opacity} lineWidth={lineWidth} transparent />;
}

export default SeverLine;
