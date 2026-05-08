"use client";

import type { FaultRecord } from "@/types/api";

const SEVERITY_CLASS: Record<string, string> = {
  WARNING: "text-status-degraded border-status-degraded/40 bg-status-degraded/10",
  CRITICAL: "text-status-failed border-status-failed/40 bg-status-failed/10",
};

// Wording must stay aligned with docs/FAULT_MODEL.md.
const INTERPRETATION: Record<string, string> = {
  SENSOR_DRIFT: "Sensor reading is drifting from truth.",
  SENSOR_DROPOUT: "Sensor returns no/probabilistic readings.",
  SENSOR_SPIKE: "Single-step sensor outlier.",
  SENSOR_NOISE_SPIKE: "Brief sensor noise burst.",
  GPS_DENIED: "GPS unavailable; navigation runs INS-only.",
  CONTROLLER_LATENCY: "Controller response time exceeds the budget.",
  CONTROLLER_INVALID_OUTPUT: "Controller returns malformed output.",
  CONTROLLER_SILENT_FAILURE: "Controller fails to respond.",
  CONTROLLER_BIAS: "Controller is forcing a fixed action.",
  CONTROLLER_ACTION_BIAS: "Controller is forcing a fixed action.",
  CONTROLLER_CONFIDENCE_DROP: "Controller is reporting low confidence.",
  CONTROLLER_TIMEOUT: "Controller timed out.",
  CONFLICTING_CONTROLLER: "Controller is producing dissenting actions.",
  COMPOUND_FAULT: "Multiple controller faults stacked.",
  DATA_LOSS: "Telemetry path interrupted.",
};

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((tok) => (tok.length === 0 ? tok : tok[0]?.toUpperCase() + tok.slice(1).toLowerCase()))
    .join(" ");
}

function interpret(type: string): string {
  const known = INTERPRETATION[type];
  if (known) return known;
  return `Unrecognized fault category (${type}).`;
}

function severityClass(severity: string): string {
  return SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.WARNING;
}

interface FaultEvidenceCardProps {
  fault: FaultRecord;
}

export function FaultEvidenceCard({ fault }: FaultEvidenceCardProps) {
  const title = humanizeType(fault.type);
  const interpretation = interpret(fault.type);
  const range = fault.end_step === null ? "ongoing" : `${fault.start_step} → ${fault.end_step}`;
  const metadataJson = JSON.stringify(fault.metadata ?? {}, null, 2);

  return (
    <article
      data-testid="fault-evidence-card"
      data-fault-id={fault.fault_id}
      aria-label={`Fault evidence ${fault.fault_id}`}
      className="surface-elevated-grad border border-border rounded-md p-3 space-y-2"
    >
      <header className="flex items-start justify-between flex-wrap gap-2">
        <div className="space-y-0.5">
          <h3 className="font-mono uppercase text-xs tracking-wider text-text-primary">{title}</h3>
          <p className="font-mono text-[11px] text-text-muted">{fault.target}</p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wider ${severityClass(
            fault.severity
          )}`}
        >
          {fault.severity}
        </span>
      </header>

      <p className="text-sm text-text-primary leading-snug">{interpretation}</p>

      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[11px] font-mono">
        <dt className="uppercase tracking-wider text-text-muted">Window</dt>
        <dd className="text-text-primary">{range}</dd>
        <dt className="uppercase tracking-wider text-text-muted">Fault ID</dt>
        <dd className="text-text-primary break-all">{fault.fault_id}</dd>
      </dl>

      <details className="group pt-1">
        <summary className="cursor-pointer font-mono uppercase text-[10px] tracking-wider text-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent">
          Show raw fault metadata
        </summary>
        <pre
          data-testid="fault-evidence-raw"
          className="mt-2 p-2 rounded border border-border bg-surface text-[11px] text-text-primary overflow-x-auto font-mono"
        >
          {metadataJson}
        </pre>
      </details>
    </article>
  );
}
