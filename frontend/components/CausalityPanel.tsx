"use client";

// CausalityPanel — operator-level summary of why DriftGuard chose the
// final action at the latest decision step. The backend's wave-1
// causality fields (previous_mode, trigger_reason, active_fault_ids,
// detector_findings, vote_split) feed this panel directly. When the
// new fields are absent (legacy persisted simulation), each row
// gracefully falls back to the original SystemDecision fields so the
// panel still renders something meaningful.

import type {
  DecisionRecord,
  DetectorFinding,
  FaultRecord,
  SystemDecision,
  SystemMode,
} from "@/types/api";
import { FaultEvidenceCard } from "./FaultEvidenceCard";
import { ReplayExplainer } from "./ReplayExplainer";
import { SystemModeBadge } from "./SystemModeBadge";
import { EmptyState } from "./ui/EmptyState";

type AnyDecision = DecisionRecord | SystemDecision;

interface CausalityPanelProps {
  decision: AnyDecision | null;
  faults: FaultRecord[];
  replayFingerprint?: string | null;
  previousDecision?: DecisionRecord | null;
  // When supplied, the inline fault chip list is replaced with a
  // FaultEvidenceCard per active fault (operator-readable expansion
  // of each fault). The original chip behavior is preserved when the
  // prop is absent so the 14 baseline tests still pass.
  activeFaults?: FaultRecord[];
  // When true, the truncated fingerprint row is replaced with a full
  // ReplayExplainer panel (copy button + three-bullet explanation).
  // We require simulationId + stepCount when expanded so the
  // explainer can render its full surface.
  expanded?: boolean;
  simulationId?: string;
  stepCount?: number;
}

// Severity → status-token mapping. Detector findings ride on a
// component-status string (HEALTHY / SUSPECT / DEGRADED / CRITICAL /
// RECOVERING); the kernel emits these strings verbatim.
const SEVERITY_TOKEN: Record<string, string> = {
  HEALTHY: "status-nominal",
  SUSPECT: "status-degraded",
  DEGRADED: "status-degraded",
  CRITICAL: "status-failed",
  RECOVERING: "status-safemode",
};

// Static class lookup so Tailwind's content scanner picks the
// concrete utility names up at build time.
const SEVERITY_CLASS: Record<string, string> = {
  "status-nominal": "text-status-nominal border-status-nominal/40 bg-status-nominal/10",
  "status-degraded": "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  "status-failed": "text-status-failed border-status-failed/40 bg-status-failed/10",
  "status-safemode": "text-status-safemode border-status-safemode/40 bg-status-safemode/10",
};

function severityClass(severity: string): string {
  const token = SEVERITY_TOKEN[severity?.toUpperCase?.() ?? ""] ?? "status-degraded";
  return SEVERITY_CLASS[token] ?? SEVERITY_CLASS["status-degraded"];
}

function describeFault(id: string, faults: FaultRecord[]): string {
  const match = faults.find((f) => f.fault_id === id);
  if (!match) return id;
  return `${match.type} → ${match.target}`;
}

function describePreviousMode(
  decision: AnyDecision,
  fallback?: DecisionRecord | null
): SystemMode | null {
  if (decision.previous_mode !== undefined && decision.previous_mode !== null) {
    return decision.previous_mode;
  }
  if (fallback && fallback.system_mode) return fallback.system_mode;
  return null;
}

function describeVote(decision: AnyDecision): string {
  if (decision.vote_split) {
    const total =
      (decision.vote_split.agreeing?.length ?? 0) + (decision.vote_split.rejected?.length ?? 0);
    const agreeing = decision.vote_split.agreeing?.length ?? 0;
    const action = decision.vote_split.selected_action ?? "no consensus";
    return `${decision.vote_split.outcome}: ${action} (${agreeing}/${total} agree)`;
  }
  // Fallback: derive a SPLIT/CONSENSUS-ish summary from the legacy
  // trusted/rejected lists. We don't know the formal outcome, so we
  // just expose the counts and the final action.
  const trusted = decision.trusted_controllers?.length ?? 0;
  const rejected = decision.rejected_controllers?.length ?? 0;
  const total = trusted + rejected;
  return `${decision.final_action} (${trusted}/${total || trusted} agree)`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 py-2 border-b border-border last:border-b-0">
      <dt className="font-mono uppercase text-[10px] tracking-wider text-text-muted self-center">
        {label}
      </dt>
      <dd className="text-sm text-text-primary break-words">{children}</dd>
    </div>
  );
}

function FaultChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-status-degraded/40 bg-status-degraded/10 text-status-degraded font-mono text-[11px]">
      {label}
    </span>
  );
}

function FindingChip({ finding }: { finding: DetectorFinding }) {
  return (
    <span
      title={finding.message}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[11px] ${severityClass(finding.severity)}`}
    >
      <span className="uppercase">{finding.component}</span>
      <span className="opacity-60">→</span>
      <span className="uppercase">{finding.severity}</span>
    </span>
  );
}

export function CausalityPanel({
  decision,
  faults,
  replayFingerprint,
  previousDecision,
  activeFaults,
  expanded,
  simulationId,
  stepCount,
}: CausalityPanelProps) {
  if (!decision) {
    return (
      <section
        aria-label="Causality"
        className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
      >
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">Causality</h2>
        <EmptyState
          title="// NO DECISION YET"
          description="Step the simulation to populate the causality panel."
        />
      </section>
    );
  }

  const previousMode = describePreviousMode(decision, previousDecision);
  const sameMode = previousMode === null || previousMode === decision.system_mode;
  const reason = decision.trigger_reason || decision.justification || "—";
  const activeFaultIds = decision.active_fault_ids ?? [];
  const findings = decision.detector_findings ?? [];

  return (
    <section
      aria-label="Causality"
      data-testid="causality-panel"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">Causality</h2>
        <span className="font-mono text-[10px] tracking-wider text-text-muted">
          STEP {decision.step}
        </span>
      </div>

      <dl className="text-sm">
        <Row label="System State">
          <span className="inline-flex items-center gap-2 flex-wrap">
            <SystemModeBadge mode={decision.system_mode} />
            {previousMode && (
              <span
                title={`previous: ${previousMode}`}
                className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono text-[11px] ${
                  sameMode
                    ? "border-border text-text-muted bg-surface opacity-60"
                    : "border-border text-text-muted bg-surface"
                }`}
              >
                ← previous: {previousMode}
              </span>
            )}
          </span>
        </Row>

        <Row label="Decision Reason">
          <span className="leading-relaxed">{reason}</span>
        </Row>

        <Row label="Fault Evidence">
          {activeFaults && activeFaults.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="causality-active-fault-cards">
              {activeFaults.map((f) => (
                <FaultEvidenceCard key={f.fault_id} fault={f} />
              ))}
            </div>
          ) : activeFaultIds.length === 0 ? (
            <span className="font-mono text-xs text-text-muted">no active faults</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {activeFaultIds.map((id) => (
                <FaultChip key={id} label={describeFault(id, faults)} />
              ))}
            </span>
          )}
        </Row>

        <Row label="Controller Vote">
          <span className="font-mono text-xs uppercase text-text-primary">
            {describeVote(decision)}
          </span>
        </Row>

        <Row label="Final Command">
          <span className="font-mono text-sm uppercase tracking-wide text-accent">
            {decision.final_action}
          </span>
        </Row>

        {!expanded && (
          <Row label="Replay Fingerprint">
            {replayFingerprint ? (
              <span
                title={replayFingerprint}
                className="font-mono text-xs text-text-primary break-all"
              >
                {replayFingerprint.slice(0, 12)}…
              </span>
            ) : (
              <span className="font-mono text-xs text-text-muted">—</span>
            )}
          </Row>
        )}
      </dl>

      {expanded && (
        <div className="pt-2 border-t border-border" data-testid="causality-replay-explainer">
          <ReplayExplainer
            simulationId={simulationId ?? ""}
            fingerprint={replayFingerprint ?? null}
            stepCount={stepCount ?? decision.step}
          />
        </div>
      )}

      {findings.length > 0 && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
            Detector findings
          </p>
          <div className="flex flex-wrap gap-1.5">
            {findings.map((f, i) => (
              <FindingChip key={`${f.component}-${i}`} finding={f} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
