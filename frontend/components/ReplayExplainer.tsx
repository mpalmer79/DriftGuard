"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "./ui/EmptyState";

// Exported so tests can advance fake timers without hard-coding the value.
export const COPY_HINT_MS = 1500;

function truncate(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

interface ReplayExplainerProps {
  simulationId: string;
  fingerprint: string | null;
  stepCount: number;
}

export function ReplayExplainer({ simulationId, fingerprint, stepCount }: ReplayExplainerProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!fingerprint) {
    return (
      <section
        aria-label="Replay fingerprint"
        data-testid="replay-explainer-empty"
        className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
      >
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Replay Fingerprint
        </h2>
        <EmptyState
          title="// NO FINGERPRINT YET"
          description="Run at least one step to compute the deterministic fingerprint for this run."
        />
      </section>
    );
  }

  const onCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPY_HINT_MS);
    } catch {
      // Clipboard rejects in non-secure contexts; full hash stays readable via title/aria-label.
    }
  };

  return (
    <section
      aria-label="Replay fingerprint"
      data-testid="replay-explainer"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Replay Fingerprint
        </h2>
        <span className="font-mono text-[10px] tracking-wider text-text-muted">
          STEPS {stepCount}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        <code
          data-testid="replay-fingerprint-hash"
          title={fingerprint}
          aria-label={`Replay fingerprint ${fingerprint}`}
          className="font-mono text-xs text-text-primary break-all bg-surface border border-border rounded px-2 py-1"
        >
          {truncate(fingerprint)}
        </code>
        <button
          type="button"
          onClick={onCopy}
          data-testid="replay-fingerprint-copy"
          aria-label="Copy replay fingerprint to clipboard"
          className="font-mono uppercase text-[10px] tracking-wider px-2 py-1 rounded border border-border bg-surface text-text-primary hover:text-accent hover:border-accent/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="font-mono text-[10px] tracking-wider text-text-muted">
          sim {simulationId.slice(0, 8)}
        </span>
      </div>

      <ul className="text-sm text-text-primary space-y-1 list-disc pl-5">
        <li>Same seed produces the same trajectory.</li>
        <li>Same trajectory produces the same fingerprint.</li>
        <li>A regression changes the fingerprint.</li>
      </ul>

      <p className="font-mono text-[10px] tracking-wider text-text-muted">
        How verified:{" "}
        <a
          href="docs/DETERMINISM.md"
          className="underline hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
        >
          docs/DETERMINISM.md
        </a>{" "}
        ·{" "}
        <a
          href="docs/formal/SafeMode.tla"
          className="underline hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
        >
          docs/formal/SafeMode.tla
        </a>
      </p>
    </section>
  );
}
