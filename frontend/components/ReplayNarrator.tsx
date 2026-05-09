// ReplayNarrator: a plain-English status panel for the current replay step.
// Translates a DecisionRecord + active faults into one short, human sentence
// so non-engineers can read what the system is doing without jargon.

import type { DecisionRecord, FaultRecord } from "@/types/api";

export interface ReplayNarratorProps {
  decision: DecisionRecord | null;
  faults: FaultRecord[];
  className?: string;
}

const STATUS_LINES: Record<string, string> = {
  NORMAL: "All three controllers agree. The system is operating normally.",
  DEGRADED:
    "One controller is unhealthy. The system is still producing actions, but with restrictions.",
  SAFE_MODE:
    "The system has lost confidence in its inputs. It is restricted to safe actions only.",
  FAILED: "Multiple critical failures. The system has aborted.",
};

const TRIGGER_REASON_LINES: Record<string, string> = {
  "all components healthy": "",
  "sensor drift detected": "A sensor is reporting drifting values.",
  "controller disagreement": "The controllers no longer agree on the right action.",
  "low confidence": "Confidence in the available data is below the safe threshold.",
  "critical fault": "A critical fault was detected.",
};

const FAULT_TYPE_LINES: Record<string, string> = {
  SENSOR_DROPOUT: "a sensor stopped reporting",
  CONTROLLER_LATENCY: "a controller is responding too slowly",
  SENSOR_DRIFT: "a sensor is drifting from the true value",
  CONTROLLER_BIAS: "a controller is producing biased commands",
  SENSOR_NOISE_SPIKE: "a sensor produced a sudden burst of noise",
  SENSOR_SPIKE: "a sensor produced a sudden out-of-range value",
  CONTROLLER_TIMEOUT: "a controller did not respond in time",
  CONTROLLER_INVALID_OUTPUT: "a controller produced an invalid command",
  CONTROLLER_CONFIDENCE_DROP: "a controller's confidence in its own output collapsed",
  DATA_LOSS: "telemetry data was lost",
  GPS_DENIED: "GPS signal was lost",
};

function normaliseTriggerReason(raw: string): string {
  return raw.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function describeFault(fault: FaultRecord): string {
  const key = fault.type.toUpperCase();
  const mapped = FAULT_TYPE_LINES[key];
  if (mapped) return mapped;
  return key.toLowerCase().replace(/_/g, "-");
}

function buildSentence(decision: DecisionRecord, faults: FaultRecord[]): string {
  const status = STATUS_LINES[decision.system_mode] ?? "";

  const rawReason = decision.trigger_reason ?? "";
  const normalisedReason = normaliseTriggerReason(rawReason);
  const reasonSentence = TRIGGER_REASON_LINES[normalisedReason] ?? "";

  // Skip the cause line entirely when the system is healthy and no faults exist.
  if (normalisedReason === "all components healthy" && faults.length === 0) {
    return status;
  }

  const parts: string[] = [status];
  if (reasonSentence) parts.push(reasonSentence);
  if (faults.length > 0) {
    parts.push(`Active fault: ${describeFault(faults[0])}.`);
  }

  return parts.join(" ");
}

export function ReplayNarrator({
  decision,
  faults,
  className,
}: ReplayNarratorProps): JSX.Element {
  const sectionClass = [
    "surface-elevated-grad border border-border rounded-md p-4",
    "border-l-4 border-l-accent",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (decision === null) {
    return (
      <section
        data-testid="replay-narrator"
        aria-label="Plain-English status"
        role="status"
        aria-live="polite"
        className={sectionClass}
      >
        <p className="font-mono text-sm text-text-muted italic">Awaiting first decision…</p>
      </section>
    );
  }

  const sentence = buildSentence(decision, faults);

  return (
    <section
      data-testid="replay-narrator"
      aria-label="Plain-English status"
      role="status"
      aria-live="polite"
      className={sectionClass}
    >
      <p className="font-mono text-[1.0625rem] leading-[1.55] text-text-primary">{sentence}</p>
    </section>
  );
}
