"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { FingerprintBadge } from "./FingerprintBadge";
import { InfoCallout } from "./ui/InfoCallout";

type VerifyStatus = "idle" | "running" | "match" | "mismatch" | "error";

interface VerifyResult {
  status: VerifyStatus;
  comparisonFingerprint?: string;
  comparisonSimulationId?: string;
  message?: string;
}

export interface ReplayVerificationPanelProps {
  simulationId: string;
  fingerprint: string | null;
  stepCount: number;
  /** When known, enables the "verify by re-running scenario" button. */
  scenarioName?: string | null;
  /** Steps to re-run for verification. Defaults to current step count. */
  verifySteps?: number;
}

const STATUS_TONE: Record<VerifyStatus, "neutral" | "info" | "warning"> = {
  idle: "neutral",
  running: "info",
  match: "info",
  mismatch: "warning",
  error: "warning",
};

export function ReplayVerificationPanel({
  simulationId,
  fingerprint,
  stepCount,
  scenarioName,
  verifySteps,
}: ReplayVerificationPanelProps) {
  const [result, setResult] = useState<VerifyResult>({ status: "idle" });

  const runVerification = useCallback(async () => {
    if (!scenarioName || !fingerprint) return;
    setResult({ status: "running" });
    try {
      const steps = verifySteps ?? stepCount ?? undefined;
      const run = await api.runScenario(scenarioName, steps && steps > 0 ? steps : undefined);
      const fp = await api.getReplayFingerprint(run.simulation_id);
      const match = fp.fingerprint === fingerprint;
      setResult({
        status: match ? "match" : "mismatch",
        comparisonFingerprint: fp.fingerprint,
        comparisonSimulationId: run.simulation_id,
        message: match
          ? "Re-run produced the same canonical timeline hash."
          : "Re-run produced a different hash. The scenario or kernel may have changed.",
      });
    } catch (err) {
      setResult({
        status: "error",
        message: (err as Error).message ?? "Verification request failed.",
      });
    }
  }, [scenarioName, fingerprint, stepCount, verifySteps]);

  if (!fingerprint) {
    return (
      <section
        aria-label="Replay verification"
        data-testid="replay-verification-panel-empty"
        className="surface-elevated-grad border border-border rounded-md p-4 space-y-3"
      >
        <Header stepCount={stepCount} />
        <p className="font-mono text-xs text-text-muted">
          {"// "}step the simulation to compute a fingerprint
        </p>
      </section>
    );
  }

  const canVerify = Boolean(scenarioName);

  return (
    <section
      aria-label="Replay verification"
      data-testid="replay-verification-panel"
      className="surface-elevated-grad border border-border rounded-md p-4 space-y-4"
    >
      <Header stepCount={stepCount} />

      <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 text-sm">
        <Row label="simulation">
          <code className="font-mono text-xs text-text-primary break-all">{simulationId}</code>
        </Row>
        <Row label="algorithm">
          <span className="font-mono text-xs text-text-muted">sha256 / canonical timeline</span>
        </Row>
        <Row label="steps">
          <span className="font-mono text-xs text-text-primary">{stepCount}</span>
        </Row>
        <Row label="fingerprint">
          <FingerprintBadge fingerprint={fingerprint} />
        </Row>
      </dl>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-mono uppercase text-[10px] tracking-wider text-text-muted">
            Cross-run comparison
          </p>
          {canVerify ? (
            <button
              type="button"
              onClick={runVerification}
              disabled={result.status === "running"}
              data-testid="replay-verify-rerun"
              className="font-mono uppercase text-[10px] tracking-wider px-2 py-1 rounded border border-border bg-surface text-text-primary hover:text-accent hover:border-accent/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent disabled:opacity-50"
            >
              {result.status === "running" ? "Re-running…" : `Re-run ${scenarioName}`}
            </button>
          ) : null}
        </div>

        {!canVerify && (
          <InfoCallout tone="neutral" title="MANUAL VERIFICATION ONLY">
            This simulation was not launched from a registered scenario, so a one-click re-run
            isn&apos;t available. To verify, re-run the same scenario from{" "}
            <code className="font-mono text-text-primary">/scenarios</code> and compare fingerprints
            by hand, or call{" "}
            <code className="font-mono text-text-primary">
              POST /scenarios/&lt;name&gt;/run/&lt;steps&gt;
            </code>{" "}
            followed by{" "}
            <code className="font-mono text-text-primary">
              GET /simulations/&lt;id&gt;/replay-fingerprint
            </code>
            .
          </InfoCallout>
        )}

        {result.status === "match" && result.comparisonFingerprint && (
          <VerifyResultBlock
            status="match"
            label="hashes match"
            comparisonFingerprint={result.comparisonFingerprint}
            comparisonSimulationId={result.comparisonSimulationId}
            message={result.message}
          />
        )}
        {result.status === "mismatch" && result.comparisonFingerprint && (
          <VerifyResultBlock
            status="mismatch"
            label="hashes differ"
            comparisonFingerprint={result.comparisonFingerprint}
            comparisonSimulationId={result.comparisonSimulationId}
            message={result.message}
          />
        )}
        {result.status === "error" && (
          <InfoCallout tone={STATUS_TONE.error} title="VERIFICATION FAILED">
            {result.message ?? "Verification request failed."}
          </InfoCallout>
        )}
        {result.status === "idle" && canVerify && (
          <p className="font-mono text-[11px] text-text-muted leading-relaxed">
            Re-runs the scenario at the same seed and compares the canonical fingerprint. A match
            proves the persisted timeline is reproducible end-to-end.
          </p>
        )}
      </div>
    </section>
  );
}

function Header({ stepCount }: { stepCount: number }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h2 className="font-mono uppercase text-sm tracking-wider text-text-primary">
        Replay Verification
      </h2>
      <span className="font-mono text-[10px] tracking-wider text-text-muted">
        STEPS {stepCount}
      </span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono uppercase text-[10px] tracking-wider text-text-muted self-center">
        {label}
      </dt>
      <dd className="text-text-primary break-words">{children}</dd>
    </>
  );
}

function VerifyResultBlock({
  status,
  label,
  comparisonFingerprint,
  comparisonSimulationId,
  message,
}: {
  status: "match" | "mismatch";
  label: string;
  comparisonFingerprint: string;
  comparisonSimulationId?: string;
  message?: string;
}) {
  const stripe =
    status === "match" ? "border-l-status-nominal bg-status-nominal/5" : "border-l-status-degraded";
  const labelClass = status === "match" ? "text-status-nominal" : "text-status-degraded";

  return (
    <div
      data-testid={`replay-verify-result-${status}`}
      className={`border border-border rounded-md p-3 border-l-4 ${stripe} space-y-2`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`font-mono uppercase text-[10px] tracking-wider ${labelClass}`}>
          {label}
        </span>
        {comparisonSimulationId && (
          <code className="font-mono text-[10px] text-text-muted break-all">
            re-run {comparisonSimulationId.slice(0, 8)}
          </code>
        )}
      </div>
      <FingerprintBadge fingerprint={comparisonFingerprint} label="RE-RUN" />
      {message && <p className="text-xs text-text-muted leading-relaxed">{message}</p>}
    </div>
  );
}
