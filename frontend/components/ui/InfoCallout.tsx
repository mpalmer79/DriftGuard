// InfoCallout — small, neutral context callout for short operator
// hints. Intended to be embedded inside larger components (causality
// panels, scenario explainers, replay controls) rather than used as
// a top-level page block.
//
// Tones — each maps to a left-edge accent stripe using existing
// Tailwind tokens. No new colours.
//
//   * neutral — `border` (default; quiet aside).
//   * info    — `accent`  (a useful note worth reading).
//   * warning — `status-degraded` (operator-attention required).
//
// Constraints honoured:
//   * No emojis, no exclamation marks, no SaaS pep-talk.
//   * Operator copy is the caller's responsibility; this component
//     only renders the chrome.

import * as React from "react";

export type InfoCalloutTone = "neutral" | "info" | "warning";

interface InfoCalloutProps {
  title?: string;
  children: React.ReactNode;
  tone?: InfoCalloutTone;
}

const STRIPE: Record<InfoCalloutTone, string> = {
  neutral: "border-l-border-strong",
  info: "border-l-accent",
  warning: "border-l-status-degraded",
};

export function InfoCallout({ title, children, tone = "neutral" }: InfoCalloutProps) {
  return (
    <aside
      role="note"
      data-tone={tone}
      className={`border border-border rounded-md p-3 text-xs bg-surface/40 border-l-4 ${STRIPE[tone]}`}
    >
      {title && (
        <p className="font-mono uppercase tracking-wider text-text-primary text-[0.65rem] mb-1">
          {title}
        </p>
      )}
      <div className="text-text-muted leading-relaxed">{children}</div>
    </aside>
  );
}
