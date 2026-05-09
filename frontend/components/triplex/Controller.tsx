// Controller.tsx — R3F mesh for a single triplex controller node.
// Renders an inner sphere + translucent outer shell whose pulse
// frequency, amplitude, and color encode the controller's status.

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";

import type { ControllerStatus, TriplexControllerHealth } from "../TriplexHero3D";

const STATUS_COLOR: Record<ControllerStatus, string> = {
  HEALTHY: "#34d399",
  SUSPECT: "#a3e635",
  DEGRADED: "#fbbf24",
  CRITICAL: "#f87171",
  RECOVERING: "#67e8f9",
  UNKNOWN: "#9ca3af",
};

const STATUS_PULSE: Record<ControllerStatus, { freqHz: number; amplitude: number }> = {
  HEALTHY: { freqHz: 0.6, amplitude: 0.04 },
  SUSPECT: { freqHz: 1.2, amplitude: 0.06 },
  DEGRADED: { freqHz: 1.8, amplitude: 0.08 },
  CRITICAL: { freqHz: 2.4, amplitude: 0.12 },
  RECOVERING: { freqHz: 1.0, amplitude: 0.05 },
  UNKNOWN: { freqHz: 0.6, amplitude: 0.02 },
};

export type ControllerProps = {
  position: [number, number, number];
  health: TriplexControllerHealth;
  prefersReducedMotion: boolean;
  pulseBoostKey?: string;
};

export function Controller({
  position,
  health,
  prefersReducedMotion,
  pulseBoostKey,
}: ControllerProps) {
  const innerRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);
  const innerMaterialRef = useRef<MeshStandardMaterial>(null);
  const shellMaterialRef = useRef<MeshStandardMaterial>(null);

  const pulseBoostUntilRef = useRef<number>(0);
  const lastBoostKeyRef = useRef<string | undefined>(pulseBoostKey);

  const color = STATUS_COLOR[health.status];
  const { freqHz, amplitude } = STATUS_PULSE[health.status];

  // Memoised emissive intensity (re-derived on prop change).
  const emissiveIntensity = useMemo(() => 0.3 + health.trust * 0.4, [health.trust]);

  // Bump pulse on fresh fault injection.
  useEffect(() => {
    if (pulseBoostKey === undefined) return;
    if (pulseBoostKey === lastBoostKeyRef.current) return;
    lastBoostKeyRef.current = pulseBoostKey;
    if (prefersReducedMotion) return;
    pulseBoostUntilRef.current = performance.now() / 1000 + 0.6;
  }, [pulseBoostKey, prefersReducedMotion]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const shell = shellRef.current;
    const inner = innerRef.current;
    if (!shell || !inner) return;

    if (prefersReducedMotion) {
      shell.scale.setScalar(1);
      inner.scale.setScalar(1);
      return;
    }

    const boosted = t < pulseBoostUntilRef.current;
    const amp = amplitude * (boosted ? 2.0 : 1.0);
    const shellScale = 1 + amp * Math.sin(2 * Math.PI * freqHz * t);
    shell.scale.setScalar(shellScale);

    if (health.status === "CRITICAL") {
      const jitter = 1 + 0.04 * Math.sin(2 * Math.PI * 5 * t);
      inner.scale.set(1, jitter, 1);
    } else {
      inner.scale.setScalar(1);
    }
  });

  return (
    <group position={position}>
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial
          ref={innerMaterialRef}
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
      <mesh ref={shellRef}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshStandardMaterial
          ref={shellMaterialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
          metalness={0.4}
          roughness={0.5}
          transparent
          opacity={0.18}
        />
      </mesh>
    </group>
  );
}

export default Controller;
