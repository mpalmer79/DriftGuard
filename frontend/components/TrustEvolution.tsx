import type {
  ComponentTrustSnapshot,
  ControllerOutput,
  TimelineEntry,
  TrustSnapshotEntry,
} from "@/types/api";

interface TrustEvolutionProps {
  timeline: TimelineEntry[];
  trustSnapshot?: Record<string, ComponentTrustSnapshot>;
  trustHistory?: TrustSnapshotEntry[];
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

function isComponentSnapshot(v: unknown): v is ComponentTrustSnapshot {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as ComponentTrustSnapshot).status === "string" &&
    typeof (v as ComponentTrustSnapshot).trust === "number"
  );
}

function gatherControllerIds(
  timeline: TimelineEntry[],
  trustSnapshot?: Record<string, ComponentTrustSnapshot>,
  trustHistory?: TrustSnapshotEntry[]
): string[] {
  const seen = new Set<string>();
  for (const entry of timeline) {
    for (const c of entry.controllers ?? []) {
      seen.add(c.controller_id);
    }
  }
  const collect = (rec: Record<string, unknown> | undefined) => {
    if (!rec) return;
    for (const key of Object.keys(rec)) {
      if (key === "_global" || key === "sensor") continue;
      if (key.startsWith("controller_")) seen.add(key);
    }
  };
  collect(trustSnapshot);
  if (trustHistory) {
    for (const entry of trustHistory) collect(entry.snapshot);
  }
  return [...seen].sort();
}

function latestSnapshotFor(
  controllerId: string,
  trustHistory?: TrustSnapshotEntry[],
  trustSnapshot?: Record<string, ComponentTrustSnapshot>
): ComponentTrustSnapshot | undefined {
  if (trustHistory && trustHistory.length > 0) {
    for (let i = trustHistory.length - 1; i >= 0; i--) {
      const v = trustHistory[i].snapshot[controllerId];
      if (isComponentSnapshot(v)) return v;
    }
  }
  const v = trustSnapshot?.[controllerId];
  return isComponentSnapshot(v) ? v : undefined;
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
      <span className={`col-start-2 font-mono text-[10px] uppercase tracking-wider ${statusClass}`}>
        {status}
      </span>
    </div>
  );
}

function TrustSparkRow({
  controllerId,
  cells,
}: {
  controllerId: string;
  cells: { step: number; trust: number; status: string }[];
}) {
  return (
    <div data-testid={`trust-spark-${controllerId}`} className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-text-primary w-[110px] shrink-0">
        {formatControllerId(controllerId)}
      </span>
      <div className="flex-1 flex items-end gap-px h-8">
        {cells.map((c) => {
          const h = Math.max(2, Math.round(c.trust * 32));
          const cls = STATUS_BAR[c.status] ?? "bg-status-degraded";
          return (
            <span
              key={c.step}
              title={`step ${c.step} — trust ${c.trust.toFixed(2)} (${c.status})`}
              data-step={c.step}
              data-trust={c.trust.toFixed(3)}
              className={`inline-block w-1.5 rounded-sm ${cls}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
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
    <div data-testid={`validity-row-${controllerId}`} className="flex items-center gap-2">
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

export function TrustEvolution({ timeline, trustSnapshot, trustHistory }: TrustEvolutionProps) {
  const hasHistory = !!trustHistory && trustHistory.length > 0;
  const hasSnapshot = !!trustSnapshot && Object.keys(trustSnapshot).length > 0;

  if ((!timeline || timeline.length === 0) && !hasSnapshot && !hasHistory) {
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

  const controllerIds = gatherControllerIds(timeline, trustSnapshot, trustHistory);

  const trustByController: Record<string, { step: number; trust: number; status: string }[]> = {};
  for (const cid of controllerIds) {
    trustByController[cid] = [];
  }
  if (trustHistory) {
    for (const entry of trustHistory) {
      for (const cid of controllerIds) {
        const snap = entry.snapshot[cid];
        if (isComponentSnapshot(snap)) {
          trustByController[cid].push({
            step: entry.step,
            trust: snap.trust,
            status: snap.status,
          });
        }
      }
    }
  }

  const validityByController: Record<string, { step: number; valid: boolean }[]> = {};
  for (const cid of controllerIds) {
    validityByController[cid] = [];
  }
  for (const entry of timeline) {
    for (const c of entry.controllers ?? []) {
      if (!validityByController[c.controller_id]) continue;
      validityByController[c.controller_id].push({
        step: entry.step,
        valid: c.valid,
      });
    }
  }

  const hasValidity = timeline.some((e) => (e.controllers ?? []).length > 0);
  const stepCount = hasHistory ? trustHistory!.length : timeline.length;

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
          {stepCount} step{stepCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
          Current Trust
        </p>
        {(() => {
          const rows = controllerIds
            .map((cid) => ({ cid, snap: latestSnapshotFor(cid, trustHistory, trustSnapshot) }))
            .filter((r) => !!r.snap) as { cid: string; snap: ComponentTrustSnapshot }[];
          if (rows.length === 0) {
            return (
              <p
                data-testid="trust-current-empty"
                className="font-mono text-[11px] text-text-muted"
              >
                Trust snapshot unavailable.
              </p>
            );
          }
          return (
            <div className="space-y-2">
              {rows.map(({ cid, snap }) => (
                <CurrentTrustRow key={cid} controllerId={cid} snapshot={snap} />
              ))}
            </div>
          );
        })()}
      </div>

      {hasHistory && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
              Trust Score Per Step
            </p>
            <p className="font-mono text-[10px] text-text-muted">
              <span className="inline-block h-2 w-2 rounded-sm bg-status-nominal align-middle mr-1" />
              healthy
              <span className="inline-block h-2 w-2 rounded-sm bg-status-safemode align-middle ml-3 mr-1" />
              recovering
              <span className="inline-block h-2 w-2 rounded-sm bg-status-degraded align-middle ml-3 mr-1" />
              degraded
            </p>
          </div>
          <div className="space-y-1.5">
            {controllerIds.map((cid) => {
              const cells = trustByController[cid] ?? [];
              if (cells.length === 0) return null;
              return <TrustSparkRow key={cid} controllerId={cid} cells={cells} />;
            })}
          </div>
        </div>
      )}

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
          <p data-testid="validity-empty" className="font-mono text-[11px] text-text-muted">
            No per-step controller data.
          </p>
        ) : (
          <div className="space-y-1.5">
            {controllerIds.map((cid) => {
              const cells = validityByController[cid] ?? [];
              if (cells.length === 0) return null;
              return <ValidityBitmapRow key={cid} controllerId={cid} cells={cells} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export type TrustEvolutionTimelineEntry = TimelineEntry;
export type TrustEvolutionController = ControllerOutput;
