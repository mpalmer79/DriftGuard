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
