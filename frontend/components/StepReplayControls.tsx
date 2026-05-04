"use client";

import { useEffect, useState } from "react";

export function StepReplayControls({
  total,
  index,
  onChange,
}: {
  total: number;
  index: number;
  onChange: (next: number) => void;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onChange(Math.min(total - 1, index + 1));
    }, 600);
    return () => clearInterval(id);
  }, [playing, index, total, onChange]);

  useEffect(() => {
    if (index >= total - 1) setPlaying(false);
  }, [index, total]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        onClick={() => onChange(0)}
        className="px-2 py-1 border border-sentinel-border rounded"
      >
        ⏮
      </button>
      <button
        onClick={() => onChange(Math.max(0, index - 1))}
        className="px-2 py-1 border border-sentinel-border rounded"
      >
        ◀
      </button>
      <button
        onClick={() => setPlaying((p) => !p)}
        className="px-3 py-1 border border-sentinel-accent/40 bg-sentinel-accent/20 rounded"
      >
        {playing ? "pause" : "play"}
      </button>
      <button
        onClick={() => onChange(Math.min(total - 1, index + 1))}
        className="px-2 py-1 border border-sentinel-border rounded"
      >
        ▶
      </button>
      <button
        onClick={() => onChange(total - 1)}
        className="px-2 py-1 border border-sentinel-border rounded"
      >
        ⏭
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="text-gray-400 w-20 text-right">
        step {index + 1}/{total}
      </span>
    </div>
  );
}
