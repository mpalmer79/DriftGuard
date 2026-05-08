"use client";

import { useEffect, useRef, useState } from "react";

export const COPY_HINT_MS = 1500;

function truncate(hash: string, head = 8, tail = 8): string {
  if (hash.length <= head + tail) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export interface FingerprintBadgeProps {
  fingerprint: string;
  /** Override the head/tail visible character counts. */
  head?: number;
  tail?: number;
  /** Optional label rendered to the left of the hash. */
  label?: string;
  /** Compact variant — smaller padding, no label, intended for headers. */
  compact?: boolean;
}

export function FingerprintBadge({
  fingerprint,
  head = 8,
  tail = 8,
  label,
  compact = false,
}: FingerprintBadgeProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPY_HINT_MS);
    } catch {
      // Clipboard rejects in non-secure contexts; the full hash stays
      // accessible via title/aria-label.
    }
  };

  const codeClass = compact
    ? "font-mono text-[11px] text-text-primary bg-surface border border-border rounded px-1.5 py-0.5"
    : "font-mono text-xs text-text-primary break-all bg-surface border border-border rounded px-2 py-1";

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap" data-testid="fingerprint-badge">
      {label && (
        <span className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
          {label}
        </span>
      )}
      <code
        title={fingerprint}
        aria-label={`fingerprint ${fingerprint}`}
        data-testid="fingerprint-badge-hash"
        className={codeClass}
      >
        {truncate(fingerprint, head, tail)}
      </code>
      <button
        type="button"
        onClick={onCopy}
        data-testid="fingerprint-badge-copy"
        aria-label="Copy fingerprint to clipboard"
        className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded border border-border bg-surface text-text-primary hover:text-accent hover:border-accent/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
