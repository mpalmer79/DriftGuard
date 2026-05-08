"use client";

import { useEffect, useState } from "react";

const TICK_MS = 600;

interface StepReplayControlsProps {
  total: number;
  index: number;
  onChange: (next: number) => void;
  /** Optional steps where a fault is active. Renders jump-to-fault chips. */
  faultSteps?: number[];
}

export function StepReplayControls({
  total,
  index,
  onChange,
  faultSteps,
}: StepReplayControlsProps) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onChange(Math.min(total - 1, index + 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, index, total, onChange]);

  useEffect(() => {
    if (index >= total - 1) setPlaying(false);
  }, [index, total]);

  const atStart = index === 0;
  const atEnd = index >= total - 1;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          aria-label="Jump to first step"
          onClick={() => onChange(0)}
          disabled={atStart}
          className="px-2 py-1 border border-border rounded font-mono uppercase tracking-wider text-[10px] hover:border-accent/60 disabled:opacity-40"
        >
          First
        </button>
        <button
          type="button"
          aria-label="Previous step"
          onClick={() => onChange(Math.max(0, index - 1))}
          disabled={atStart}
          className="px-2 py-1 border border-border rounded font-mono uppercase tracking-wider text-[10px] hover:border-accent/60 disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause replay" : "Play replay"}
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
          className="px-3 py-1 border border-accent/40 bg-accent/10 text-accent rounded font-mono uppercase tracking-wider text-[10px] hover:bg-accent/20"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          aria-label="Next step"
          onClick={() => onChange(Math.min(total - 1, index + 1))}
          disabled={atEnd}
          className="px-2 py-1 border border-border rounded font-mono uppercase tracking-wider text-[10px] hover:border-accent/60 disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          aria-label="Jump to last step"
          onClick={() => onChange(total - 1)}
          disabled={atEnd}
          className="px-2 py-1 border border-border rounded font-mono uppercase tracking-wider text-[10px] hover:border-accent/60 disabled:opacity-40"
        >
          Last
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Replay scrubber"
          className="flex-1 min-w-[6rem]"
        />
        <span className="font-mono text-text-muted w-24 text-right">
          step {index + 1}/{total}
        </span>
      </div>

      {faultSteps && faultSteps.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
            Jump to fault
          </span>
          {faultSteps.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(Math.min(total - 1, Math.max(0, s)))}
              className="px-2 py-0.5 rounded border border-status-degraded/40 bg-status-degraded/10 text-status-degraded font-mono text-[10px] uppercase tracking-wider hover:border-status-degraded/70"
            >
              step {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
