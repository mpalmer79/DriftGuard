// TrustEvolution — controller trust trajectory across a run.
//
// Renders two stacked sections:
//   1. CURRENT TRUST  — three sparkbar-style rows, one per controller,
//      derived from `trustSnapshot[controller_id]`. Shows the current
//      trust score (0..1, displayed 0–100%) and the component status
//      word (HEALTHY/SUSPECT/DEGRADED/CRITICAL/RECOVERING).
//   2. VALIDITY OVER TIME — a per-step bitmap (one row per controller,
//      one cell per step) coloured by `controllers[i].valid`. This is
//      the closest proxy the frontend has to a per-step trust history
//      because the backend does not currently expose `trust.history`
//      per step — only `result.trust_snapshot` (the final state).
//      Operators can read the bitmap as: green = valid, amber = invalid.
//
// Field gap: the per-step trust trajectory is not surfaced by the API
// today. This component derives a proxy from the validity bitmap so
// reviewers can still see "when did controller_b stop voting?" at a
// glance. See the Phase 2 report for the gap reference.
//
// No charting library — only Tailwind layout primitives.

import type {
  ComponentTrustSnapshot,
  ControllerOutput,
  TimelineEntry,
} from "@/types/api";

interface TrustEvolutionProps {
  timeline: TimelineEntry[];
  trustSnapshot?: Record<string, ComponentTrustSnapshot>;
}

const STATUS_TOKEN: Record<string, string> = {
  HEALTHY: "text-status-nominal",
  RECOVERING: "text-status-safemode",
  SUSPECT: "text-status-degraded",
  DEGRADED: "text-status-degraded",
  CRITICAL: "text-status-failed",
};

const STATUS_BAR: Record<string, string> = {
  HEALTHY: "bg-status-nominal",
  RECOVERING: "bg-status-safemode",
  SUSPECT: "bg-status-degraded",
  DEGRADED: "bg-status-degraded",
  CRITICAL: "bg-status-failed",
};

function formatControllerId(id: string): string {
  const m = /^controller_([a-z])$/i.exec(id);
  if (m) return `Controller ${m[1].toUpperCase()}`;
  return id;
}

function gatherControllerIds(
  timeline: TimelineEntry[],
  trustSnapshot?: Record<string, ComponentTrustSnapshot>,
): string[] {
  const seen = new Set<string>();
  for (const entry of timeline) {
    for (const c of entry.controllers ?? []) {
      seen.add(c.controller_id);
    }
  }
  if (trustSnapshot) {
    for (const key of Object.keys(trustSnapshot)) {
      if (key === "_global" || key === "sensor") continue;
      seen.add(key);
    }
  }
  // Sort so controller_a/b/c order is stable.
  return [...seen].sort();
}

function CurrentTrustRow({
  controllerId,
  snapshot,
}: {
  controllerId: string;
  snapshot: ComponentTrustSnapshot;
}) {
  const trust = Math.max(0, Math.min(1, snapshot.trust ?? 0));
  const pct = Math.round(trust * 100);
  const status = snapshot.status ?? "HEALTHY";
  const statusClass = STATUS_TOKEN[status] ?? "text-text-muted";
  const barClass = STATUS_BAR[status] ?? "bg-status-degraded";
  return (
    <div
      data-testid={`trust-current-${controllerId}`}
      className="grid grid-cols-[110px_1fr_60px] items-center gap-2"
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-text-primary">
        {formatControllerId(controllerId)}
      </span>
      <div
        className="h-2 rounded bg-border overflow-hidden"
        role="progressbar"
        aria-label={`${controllerId} trust`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-right tabular-nums text-text-primary">
        {pct}%
      </span>
      <span
        className={`col-start-2 font-mono text-[10px] uppercase tracking-wider ${statusClass}`}
      >
        {status}
      </span>
    </div>
  );
}

function ValidityBitmapRow({
  controllerId,
  cells,
}: {
  controllerId: string;
  cells: { step: number; valid: boolean }[];
}) {
  return (
    <div
      data-testid={`validity-row-${controllerId}`}
      className="flex items-center gap-2"
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-text-primary w-[110px] shrink-0">
        {formatControllerId(controllerId)}
      </span>
      <div className="flex-1 flex flex-wrap gap-px">
        {cells.map((c) => (
          <span
            key={c.step}
            title={`step ${c.step} — ${c.valid ? "valid" : "invalid"}`}
            data-valid={c.valid ? "true" : "false"}
            className={`inline-block h-3 w-2 rounded-sm ${
              c.valid ? "bg-status-nominal" : "bg-status-degraded"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function TrustEvolution({
  timeline,
  trustSnapshot,
}: TrustEvolutionProps) {
  if ((!timeline || timeline.length === 0) && !trustSnapshot) {
    return (
      <section
        aria-label="Trust evolution"
        data-testid="trust-evolution"
        className="surface-elevated-grad border border-border rounded-md p-4"
      >
        <p className="font-mono text-xs text-text-muted">
          No trust history yet — run a scenario to populate.
        </p>
      </section>
    );
  }

  const controllerIds = gatherControllerIds(timeline, trustSnapshot);

  // Build per-controller validity cells from the timeline. Only
  // controllers that actually appeared in `entry.controllers` get a
  // cell for that step; missing controllers are skipped (no synthetic
  // values).
  const validityByController: Record<
    string,
    { step: number; valid: boolean }[]
  > = {};
  for (const cid of controllerIds) {
    validityByController[cid] = [];
  }
  for (const entry of timeline) {
    const seen = new Set<string>();
    for (const c of entry.controllers ?? []) {
      if (!validityByController[c.controller_id]) continue;
      validityByController[c.controller_id].push({
        step: entry.step,
        valid: c.valid,
      });
      seen.add(c.controller_id);
    }
    // For controllers present in trustSnapshot but missing in this
    // step, leave a gap rather than inventing a valid/invalid.
    for (const cid of controllerIds) {
      if (!seen.has(cid)) {
        // Intentionally do nothing; bitmap shows only steps where the
        // controller actually produced an output.
      }
    }
  }

  const hasValidity = timeline.some(
    (e) => (e.controllers ?? []).length > 0,
  );

  return (
    <section
      aria-label="Trust evolution"
      data-testid="trust-evolution"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Trust Evolution
        </h2>
        <span className="font-mono text-[10px] tracking-wider text-text-muted">
          {timeline.length} step{timeline.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
          Current Trust
        </p>
        {controllerIds.length === 0 || !trustSnapshot ? (
          <p
            data-testid="trust-current-empty"
            className="font-mono text-[11px] text-text-muted"
          >
            Trust snapshot unavailable.
          </p>
        ) : (
          <div className="space-y-2">
            {controllerIds.map((cid) => {
              const snap = trustSnapshot?.[cid];
              if (!snap) return null;
              return (
                <CurrentTrustRow
                  key={cid}
                  controllerId={cid}
                  snapshot={snap}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
            Validity Over Time
          </p>
          <p className="font-mono text-[10px] text-text-muted">
            <span className="inline-block h-2 w-2 rounded-sm bg-status-nominal align-middle mr-1" />
            valid
            <span className="inline-block h-2 w-2 rounded-sm bg-status-degraded align-middle ml-3 mr-1" />
            invalid
          </p>
        </div>
        {!hasValidity ? (
          <p
            data-testid="validity-empty"
            className="font-mono text-[11px] text-text-muted"
          >
            No per-step controller data.
          </p>
        ) : (
          <div className="space-y-1.5">
            {controllerIds.map((cid) => {
              const cells = validityByController[cid] ?? [];
              if (cells.length === 0) return null;
              return (
                <ValidityBitmapRow
                  key={cid}
                  controllerId={cid}
                  cells={cells}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// Helper exported for tests that need to mock timeline shape without
// pulling in a full StepResponse generator.
export type TrustEvolutionTimelineEntry = TimelineEntry;
export type TrustEvolutionController = ControllerOutput;
