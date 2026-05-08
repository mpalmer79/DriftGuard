"use client";

// ReplayExplainer — inline explainability panel for the replay
// fingerprint endpoint.
//
// DriftGuard's deterministic simulator emits a SHA-256 fingerprint
// over the full per-step trajectory. The hash itself is hard to read
// (64 hex chars), so this component:
//   1. shows it truncated as ABCDEFGH…ZYXWVUTS with the full hash
//      kept in the `title` and `aria-label` for screen-reader access,
//   2. exposes a copy-to-clipboard button that uses
//      navigator.clipboard.writeText and shows a transient "Copied"
//      hint, and
//   3. lists three short bullets explaining the contract: same seed
//      → same trajectory → same fingerprint. A regression flips the
//      hash.
//
// The "How verified" line links to the in-repo docs that the rest of
// the project owns: docs/DETERMINISM.md (description) and
// docs/formal/SafeMode.tla (the TLA+ spec). We deliberately use
// relative paths so the links continue to work in both the
// production deployment and locally cloned repos.

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "./ui/EmptyState";

// 1.5s in ms — long enough to register, short enough not to block
// the next click. Exported for tests so they can advance fake
// timers without hard-coding the value.
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

  // Clean up the pending timer if the component unmounts before the
  // hint expires — otherwise we'd call setState on an unmounted
  // component, which React 18 quietly drops but vitest still flags
  // in strict-mode runs.
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
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPY_HINT_MS);
    } catch {
      // Clipboard write may reject in secure-context-less environments
      // (e.g. http on iframe). We swallow the error rather than
      // surface a console error — the fingerprint is still readable
      // because the full hash is in the title/aria-label attributes.
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
