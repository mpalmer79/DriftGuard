// TriplexHero3D.tsx — page hero R3F scene visualizing three controllers,
// the consensus voter, and connector lines that sever on rejection.
// Falls back to a static OG image when WebGL is unavailable.

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

import type { SystemMode } from "@/types/api";

import { Controller } from "./triplex/Controller";
import { SeverLine } from "./triplex/SeverLine";
import { VoteCore } from "./triplex/VoteCore";

export type ControllerStatus =
  | "HEALTHY"
  | "SUSPECT"
  | "DEGRADED"
  | "CRITICAL"
  | "RECOVERING"
  | "UNKNOWN";

export type TriplexControllerHealth = {
  id: "controller_a" | "controller_b" | "controller_c";
  trust: number;
  status: ControllerStatus;
  isTrusted: boolean;
  isRejected: boolean;
};

export type TriplexFaultInjected = {
  id: string;
  target: string;
  description: string;
  startedAtStep: number;
};

export type TriplexHero3DProps = {
  controllers: TriplexControllerHealth[];
  systemMode: SystemMode;
  modeJustChanged: { from: SystemMode; to: SystemMode } | null;
  faultsJustInjected: TriplexFaultInjected[];
  prefersReducedMotion: boolean;
  className?: string;
};

const TRIANGLE_RADIUS = 2;
const ORIGIN: [number, number, number] = [0, 0, 0];

// Fixed positions in stable [a, b, c] order around a horizontal triangle.
const CONTROLLER_POSITIONS: Array<[number, number, number]> = [
  [0, 0, TRIANGLE_RADIUS],
  [-TRIANGLE_RADIUS * Math.cos(Math.PI / 6), 0, -TRIANGLE_RADIUS / 2],
  [TRIANGLE_RADIUS * Math.cos(Math.PI / 6), 0, -TRIANGLE_RADIUS / 2],
];

const CONTROLLER_LABEL: Record<TriplexControllerHealth["id"], string> = {
  controller_a: "Controller A",
  controller_b: "Controller B",
  controller_c: "Controller C",
};

function controllerPhrase(c: TriplexControllerHealth): string {
  const label = CONTROLLER_LABEL[c.id];
  if (c.isTrusted) return `${label} trusted`;
  if (c.isRejected) return `${label} rejected`;
  return `${label} ${c.status.toLowerCase()}`;
}

function buildSummary(controllers: TriplexControllerHealth[], mode: SystemMode): string {
  const parts = controllers.map(controllerPhrase);
  return `System mode ${mode}. ${parts.join(". ")}.`;
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(ctx);
  } catch {
    return false;
  }
}

export default function TriplexHero3D({
  controllers,
  systemMode,
  modeJustChanged,
  faultsJustInjected,
  prefersReducedMotion,
  className,
}: TriplexHero3DProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(detectWebGL());
  }, []);

  const summary = useMemo(
    () => buildSummary(controllers, systemMode),
    [controllers, systemMode],
  );

  // Map controller id -> latest fault for pulse-boost keying.
  const faultByTarget = useMemo(() => {
    const map = new Map<string, TriplexFaultInjected>();
    for (const fault of faultsJustInjected) {
      map.set(fault.target, fault);
    }
    return map;
  }, [faultsJustInjected]);

  const wrapperClass = ["aspect-[16/7] w-full relative", className].filter(Boolean).join(" ");

  if (webglAvailable === false) {
    return (
      <div
        className={wrapperClass}
        aria-label="Triplex controller visualization"
      >
        <span className="sr-only">{summary}</span>
        <div className="flex flex-col items-center justify-center w-full h-full">
          <Image
            src="/og.png"
            alt="DriftGuard triplex visualization (3D unavailable in this browser)"
            width={1200}
            height={525}
            className="w-full h-full object-cover opacity-80"
            unoptimized
          />
          <p className="text-xs text-text-muted font-mono mt-2">
            {"// 3D scene unavailable in this browser"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} aria-label="Triplex controller visualization">
      <span className="sr-only">{summary}</span>
      {webglAvailable && (
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <color attach="background" args={["transparent"]} />
          <fog attach="fog" args={["#0a0a0a", 6, 14]} />
          <ambientLight intensity={0.4} />
          <directionalLight intensity={0.8} position={[5, 5, 5]} />
          <PerspectiveCamera makeDefault position={[0, 1.5, 5]} fov={50} />
          <OrbitControls
            autoRotate={!prefersReducedMotion}
            autoRotateSpeed={0.5}
            enableZoom={false}
            enablePan={false}
            enableRotate={false}
          />
          {controllers.map((health, i) => {
            const fault = faultByTarget.get(health.id);
            const pulseBoostKey = fault
              ? `${fault.startedAtStep}-${fault.id}`
              : undefined;
            return (
              <Controller
                key={health.id}
                position={CONTROLLER_POSITIONS[i]}
                health={health}
                prefersReducedMotion={prefersReducedMotion}
                pulseBoostKey={pulseBoostKey}
              />
            );
          })}
          {controllers.map((health, i) => (
            <SeverLine
              key={`line-${health.id}`}
              from={CONTROLLER_POSITIONS[i]}
              to={ORIGIN}
              health={health}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
          <VoteCore
            mode={systemMode}
            modeJustChanged={modeJustChanged}
            prefersReducedMotion={prefersReducedMotion}
          />
        </Canvas>
      )}
    </div>
  );
}
