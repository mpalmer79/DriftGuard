import type { ComponentTrustSnapshot, ControllerOutput, VoteResult } from "@/types/api";

// Mirrors the kernel's controller latency budget. The backend doesn't
// yet emit a per-controller value, so it stays hard-coded here.
const LATENCY_BUDGET_MS = 150;

interface VotePanelProps {
  controllers: ControllerOutput[];
  vote: VoteResult;
  trustSnapshot?: Record<string, ComponentTrustSnapshot>;
}

type Bucket = "agreeing" | "rejected" | "neutral";

const BUCKET_CARD: Record<Bucket, string> = {
  agreeing: "border-status-nominal/40 bg-status-nominal/5",
  rejected: "border-status-degraded/40 bg-status-degraded/5",
  neutral: "border-border bg-surface",
};

const BUCKET_CHIP: Record<Bucket, string> = {
  agreeing: "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  rejected: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  neutral: "text-text-muted border-border bg-surface",
};

const STATUS_TOKEN: Record<string, string> = {
  HEALTHY: "text-status-nominal",
  RECOVERING: "text-status-safemode",
  SUSPECT: "text-status-degraded",
  DEGRADED: "text-status-degraded",
  CRITICAL: "text-status-failed",
};

function formatControllerId(id: string): string {
  const m = /^controller_([a-z])$/i.exec(id);
  if (m) return `Controller ${m[1].toUpperCase()}`;
  return id;
}

function bucketFor(controllerId: string, agreeing: string[], rejected: string[]): Bucket {
  if (agreeing.includes(controllerId)) return "agreeing";
  if (rejected.includes(controllerId)) return "rejected";
  return "neutral";
}

function exclusionReason(c: ControllerOutput): string {
  if (!c.valid) {
    return `${c.controller_id} excluded: invalid output`;
  }
  if (c.response_time_ms > LATENCY_BUDGET_MS) {
    return `${c.controller_id} excluded: latency ${c.response_time_ms}ms exceeds ${LATENCY_BUDGET_MS}ms`;
  }
  return `${c.controller_id} excluded: rejected`;
}

function rationale(vote: VoteResult): string {
  switch (vote.outcome) {
    case "CONSENSUS":
      return `Majority consensus: ${vote.selected_action ?? "—"}`;
    case "SPLIT":
      return "No consensus — controllers disagree.";
    case "INSUFFICIENT_DATA":
      return "Insufficient valid controllers — defaulting to safe action.";
    default:
      return vote.outcome;
  }
}

function TrustMeter({ snapshot }: { snapshot: ComponentTrustSnapshot }) {
  const trust = Math.max(0, Math.min(1, snapshot.trust ?? 0));
  const pct = Math.round(trust * 100);
  const statusClass = STATUS_TOKEN[snapshot.status] ?? "text-text-muted";
  const barColor =
    snapshot.status === "HEALTHY"
      ? "bg-status-nominal"
      : snapshot.status === "RECOVERING"
        ? "bg-status-safemode"
        : snapshot.status === "CRITICAL"
          ? "bg-status-failed"
          : "bg-status-degraded";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-wider ${statusClass}`}>
          {snapshot.status}
        </span>
        <span className="font-mono text-[10px] text-text-muted">{pct}%</span>
      </div>
      <div
        className="h-1 rounded bg-border overflow-hidden"
        role="progressbar"
        aria-label="trust"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ControllerCard({
  output,
  bucket,
  trust,
}: {
  output: ControllerOutput;
  bucket: Bucket;
  trust?: ComponentTrustSnapshot;
}) {
  const overBudget = output.response_time_ms > LATENCY_BUDGET_MS;
  const confidencePct = Math.round((output.confidence ?? 0) * 100);
  return (
    <div
      data-testid={`vote-card-${output.controller_id}`}
      className={`border rounded-md p-3 space-y-2 ${BUCKET_CARD[bucket]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-text-primary">
          {formatControllerId(output.controller_id)}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] uppercase border ${
            output.valid
              ? "text-status-nominal border-status-nominal/40 bg-status-nominal/10"
              : "text-status-failed border-status-failed/40 bg-status-failed/10"
          }`}
        >
          {output.valid ? "valid" : "invalid"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase tracking-wide ${BUCKET_CHIP[bucket]}`}
        >
          {output.action}
        </span>
        <span className="font-mono text-[11px] text-text-muted">{confidencePct}% conf</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-muted uppercase tracking-wider text-[10px]">response</span>
        <span className={overBudget ? "text-status-failed" : "text-text-primary"}>
          {output.response_time_ms} ms
        </span>
      </div>
      {trust && <TrustMeter snapshot={trust} />}
    </div>
  );
}

export function VotePanel({ controllers, vote, trustSnapshot }: VotePanelProps) {
  const agreeing = vote.agreeing_controllers ?? [];
  const rejected = vote.rejected_controllers ?? [];

  // Exclusion reasons are derived from each controller's valid flag and
  // latency, never invented.
  const rejectedOutputs = controllers.filter((c) => rejected.includes(c.controller_id));
  const exclusions = rejectedOutputs.map(exclusionReason);

  return (
    <section
      aria-label="Controller vote"
      data-testid="vote-panel"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
          Controller Vote
        </h2>
        <span
          data-testid="vote-outcome"
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase tracking-wider ${
            vote.outcome === "CONSENSUS"
              ? BUCKET_CHIP.agreeing
              : vote.outcome === "SPLIT"
                ? BUCKET_CHIP.rejected
                : "text-status-safemode border-status-safemode/40 bg-status-safemode/10"
          }`}
        >
          {vote.outcome}
        </span>
      </div>

      {controllers.length === 0 ? (
        <p className="font-mono text-xs text-text-muted">No controller outputs.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {controllers.map((c) => (
            <ControllerCard
              key={c.controller_id}
              output={c}
              bucket={bucketFor(c.controller_id, agreeing, rejected)}
              trust={trustSnapshot?.[c.controller_id]}
            />
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border space-y-1">
        <p
          data-testid="vote-rationale"
          className="font-mono text-sm uppercase tracking-wide text-text-primary"
        >
          {rationale(vote)}
        </p>
        {vote.reason && <p className="text-xs text-text-muted leading-relaxed">{vote.reason}</p>}
      </div>

      <div>
        <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted mb-1">
          Excluded
        </p>
        {exclusions.length === 0 ? (
          <p className="font-mono text-xs text-text-muted">No exclusions.</p>
        ) : (
          <ul className="space-y-0.5">
            {exclusions.map((line) => (
              <li key={line} className="font-mono text-[11px] text-status-degraded leading-snug">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
