// VoteCore.tsx — central icosahedron representing the consensus voter.
// Color encodes system mode; brief pop-scale animates on mode change.

"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

import type { SystemMode } from "@/types/api";

const MODE_COLOR: Record<SystemMode, string> = {
  NORMAL: "#34d399",
  DEGRADED: "#fbbf24",
  SAFE_MODE: "#a78bfa",
  FAILED: "#f87171",
};

const TRANSITION_DURATION_S = 0.2;

export type VoteCoreProps = {
  mode: SystemMode;
  modeJustChanged: { from: SystemMode; to: SystemMode } | null;
  prefersReducedMotion: boolean;
};

export function VoteCore({ mode, modeJustChanged, prefersReducedMotion }: VoteCoreProps) {
  const meshRef = useRef<Mesh>(null);
  const transitionStartRef = useRef<number | null>(null);

  // Trigger a pop-scale animation when modeJustChanged identity changes.
  useEffect(() => {
    if (!modeJustChanged) return;
    if (prefersReducedMotion) return;
    transitionStartRef.current = performance.now() / 1000;
  }, [modeJustChanged, prefersReducedMotion]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!prefersReducedMotion) {
      mesh.rotation.y += 0.3 * state.clock.getDelta();
    }

    let scale = 1;
    const startedAt = transitionStartRef.current;
    if (startedAt !== null && !prefersReducedMotion) {
      const t = state.clock.getElapsedTime() - startedAt;
      if (t >= TRANSITION_DURATION_S) {
        transitionStartRef.current = null;
        scale = 1;
      } else {
        // Triangle ramp 1.0 -> 1.3 -> 1.0 over 200ms.
        const half = TRANSITION_DURATION_S / 2;
        const phase = t < half ? t / half : 1 - (t - half) / half;
        scale = 1 + 0.3 * phase;
      }
    }
    mesh.scale.setScalar(scale);
  });

  const color = MODE_COLOR[mode];

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.5, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        metalness={0.6}
        roughness={0.3}
      />
    </mesh>
  );
}

export default VoteCore;
