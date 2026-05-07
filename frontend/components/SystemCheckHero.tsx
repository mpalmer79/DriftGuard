"use client";

import { useEffect, useState } from "react";

const CONTROLLERS = [
  { label: "controller_a", delayMs: 200 },
  { label: "controller_b", delayMs: 450 },
  { label: "controller_c", delayMs: 700 },
] as const;

const BOOT_TOTAL_MS = 950;

export function SystemCheckHero() {
  const [booted, setBooted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReduced = mql.matches;
    setReduced(prefersReduced);
    if (prefersReduced) {
      setBooted(true);
      return;
    }
    const t = window.setTimeout(() => setBooted(true), BOOT_TOTAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="aspect-[4/3] bg-surface-elevated border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">SYSTEM CHECK</p>
      <div className="flex items-end justify-center gap-8 sm:gap-10">
        {CONTROLLERS.map((c) => (
          <ControllerDot key={c.label} label={c.label} delayMs={c.delayMs} reduced={reduced} />
        ))}
      </div>
      <p
        className={`font-mono text-xs uppercase tracking-wider text-status-nominal transition-opacity duration-500 ${
          booted ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        STATUS: NOMINAL
      </p>
      <style>{`
        @keyframes sch-boot {
          0% {
            opacity: 0.3;
            background-color: var(--status-failed);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          }
          100% {
            opacity: 1;
            background-color: var(--status-nominal);
            box-shadow: 0 0 12px var(--status-nominal);
          }
        }
        @keyframes sch-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.82; }
        }
      `}</style>
    </div>
  );
}

function ControllerDot({
  label,
  delayMs,
  reduced,
}: {
  label: string;
  delayMs: number;
  reduced: boolean;
}) {
  const dotStyle: React.CSSProperties = reduced
    ? {
        backgroundColor: "var(--status-nominal)",
        boxShadow: "0 0 12px var(--status-nominal)",
      }
    : {
        opacity: 0.3,
        backgroundColor: "var(--status-failed)",
        animation: `sch-boot 1s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms forwards, sch-pulse 2s ease-in-out ${delayMs + 1000}ms infinite`,
      };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="block h-4 w-4 rounded-full" style={dotStyle} aria-hidden />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  );
}
