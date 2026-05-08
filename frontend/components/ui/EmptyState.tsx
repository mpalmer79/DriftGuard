import * as React from "react";
import Link from "next/link";

export type EmptyStateKind = "no-data" | "not-started" | "completed" | "error";

interface ActionDescriptor {
  label: string;
  href: string;
}

export interface EmptyStateProps {
  title: string;
  /** Long-form prose. Original API. */
  description?: React.ReactNode;
  /** Short hint for the operator. New, additive — alias of description with operator tone. */
  hint?: React.ReactNode;
  /** ReactNode (original) or descriptor `{label, href}` (new). */
  action?: React.ReactNode | ActionDescriptor;
  kind?: EmptyStateKind;
  /** Optional severity bullet (no SVG dep). When true a coloured dot is rendered next to the title. */
  severe?: boolean;
}

const STRIPE: Record<EmptyStateKind, string> = {
  "no-data": "border-l-border-strong",
  "not-started": "border-l-status-degraded",
  completed: "border-l-status-nominal",
  error: "border-l-status-failed",
};

const BULLET: Record<EmptyStateKind, string> = {
  "no-data": "bg-text-muted",
  "not-started": "bg-status-degraded",
  completed: "bg-status-nominal",
  error: "bg-status-failed",
};

function isActionDescriptor(action: unknown): action is ActionDescriptor {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "href" in action &&
    typeof (action as ActionDescriptor).label === "string" &&
    typeof (action as ActionDescriptor).href === "string"
  );
}

export function EmptyState({
  title,
  description,
  hint,
  action,
  kind = "no-data",
  severe = false,
}: EmptyStateProps) {
  const body = hint ?? description;
  const stripe = STRIPE[kind];
  const bullet = BULLET[kind];

  return (
    <div
      role="status"
      data-empty-kind={kind}
      className={`border border-dashed border-border rounded-md p-6 text-sm border-l-4 ${stripe} bg-surface/40`}
    >
      <h3 className="font-mono uppercase tracking-wider text-text-primary text-xs flex items-center gap-2">
        {severe && (
          <span
            aria-hidden="true"
            data-testid="empty-state-bullet"
            className={`inline-block w-2 h-2 rounded-full ${bullet}`}
          />
        )}
        <span>{title}</span>
      </h3>
      {body && <p className="mt-2 text-text-muted leading-relaxed">{body}</p>}
      {action && (
        <div className="mt-3">
          {isActionDescriptor(action) ? (
            <Link
              href={action.href}
              className="inline-flex items-center font-mono uppercase text-xs tracking-wider text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {action.label}
            </Link>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  retry?: () => void;
}

// Dedicated "backend unreachable / request failed" surface. Kept as a
// separate named export to match existing call sites; visual treatment
// matches the EmptyState `error` kind.
export function ErrorState({ message, retry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-empty-kind="error"
      className="border border-dashed border-status-failed/50 rounded-md p-4 text-sm border-l-4 border-l-status-failed bg-status-failed/5"
    >
      <p className="text-text-primary">{message}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-2 font-mono uppercase text-xs tracking-wider text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          retry
        </button>
      )}
    </div>
  );
}
