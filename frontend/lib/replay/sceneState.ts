// sceneState — pure derivations from a replay's decisions, faults, and trust
// snapshots into the values the replay UI renders for a given step. No React,
// no DOM, no side-effects: identical inputs always yield identical outputs.

import type {
  ComponentTrustSnapshot,
  DecisionRecord,
  FaultRecord,
  SystemMode,
  TrustSnapshotEntry,
} from "@/types/api";

export type ControllerId = "controller_a" | "controller_b" | "controller_c";

export type ControllerStatus =
  | "HEALTHY"
  | "SUSPECT"
  | "DEGRADED"
  | "CRITICAL"
  | "RECOVERING"
  | "UNKNOWN";

export type StatusAt = {
  headline: string;
  cause: string | null;
  mode: SystemMode | "UNKNOWN";
};

export type ControllerHealthAt = {
  id: ControllerId;
  trust: number;
  status: ControllerStatus;
  isTrusted: boolean;
  isRejected: boolean;
};

export type ActiveFaultAt = {
  id: string;
  target: string;
  description: string;
  startedAtStep: number;
};

export type ModeChangeAt = { from: SystemMode; to: SystemMode } | null;

const CONTROLLER_IDS: readonly ControllerId[] = [
  "controller_a",
  "controller_b",
  "controller_c",
];

const STATUS_LINES: Record<SystemMode, string> = {
  NORMAL: "All three controllers agree. The system is operating normally.",
  DEGRADED:
    "One controller is unhealthy. The system is still producing actions, but with restrictions.",
  SAFE_MODE:
    "The system has lost confidence in its inputs. It is restricted to safe actions only.",
  FAILED: "Multiple critical failures. The system has aborted.",
};

const FAULT_TYPE_LINES: Record<string, string> = {
  SENSOR_DROPOUT: "a sensor stopped reporting",
  SENSOR_NOISE: "a sensor is reporting noisy data",
  SENSOR_NOISE_SPIKE: "a sensor produced a sudden burst of noise",
  SENSOR_BIAS: "a sensor is biased",
  SENSOR_DRIFT: "a sensor is drifting from the true value",
  SENSOR_SPIKE: "a sensor produced a sudden out-of-range value",
  CONTROLLER_LATENCY: "a controller is responding too slowly",
  CONTROLLER_TIMEOUT: "a controller did not respond in time",
  CONTROLLER_FAULT: "a controller has failed",
  CONTROLLER_DRIFT: "a controller is drifting from consensus",
  CONTROLLER_BIAS: "a controller is producing biased commands",
  CONTROLLER_INVALID_OUTPUT: "a controller produced an invalid command",
  CONTROLLER_CONFIDENCE_DROP: "a controller's confidence in its own output collapsed",
  CONTROLLER_SILENT_FAILURE: "a controller went silent",
  CONFLICTING_CONTROLLER: "two controllers disagree",
  COMPOUND_FAULT: "multiple components are failing at once",
  DATA_LOSS: "telemetry data was lost",
  GPS_DENIED: "GPS signal was lost",
};

const KNOWN_STATUSES: ReadonlySet<ControllerStatus> = new Set<ControllerStatus>([
  "HEALTHY",
  "SUSPECT",
  "DEGRADED",
  "CRITICAL",
  "RECOVERING",
  "UNKNOWN",
]);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normaliseTriggerReason(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

export function describeFault(fault: { type: string; target: string }): string {
  const key = (fault.type ?? "").toUpperCase();
  const mapped = FAULT_TYPE_LINES[key];
  if (mapped) return mapped;
  return key.toLowerCase().replace(/_/g, "-");
}

export function statusAt(
  decision: DecisionRecord | null,
  faults: FaultRecord[]
): StatusAt {
  if (decision === null) {
    return { headline: "", cause: null, mode: "UNKNOWN" };
  }

  const mode = decision.system_mode;
  const headline = STATUS_LINES[mode] ?? "";

  const rawReason = decision.trigger_reason ?? "";
  const normalisedReason = normaliseTriggerReason(rawReason);
  const hasFaults = faults.length > 0;

  if (normalisedReason === "all components healthy" && !hasFaults) {
    return { headline, cause: null, mode };
  }

  if (hasFaults) {
    return {
      headline,
      cause: `Active fault: ${describeFault(faults[0])}.`,
      mode,
    };
  }

  if (normalisedReason.length > 0) {
    return {
      headline,
      cause: `Trigger: ${decision.trigger_reason}.`,
      mode,
    };
  }

  return { headline, cause: null, mode };
}

function isComponentTrustSnapshot(
  value: unknown
): value is ComponentTrustSnapshot {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.trust === "number" && typeof record.status === "string";
}

function normaliseStatus(raw: string): ControllerStatus {
  const upper = raw.toUpperCase() as ControllerStatus;
  return KNOWN_STATUSES.has(upper) ? upper : "UNKNOWN";
}

function pickLatestSnapshot(
  trustHistory: TrustSnapshotEntry[] | null,
  step: number
): TrustSnapshotEntry | null {
  if (!trustHistory || trustHistory.length === 0) return null;
  let best: TrustSnapshotEntry | null = null;
  for (const entry of trustHistory) {
    if (entry.step > step) continue;
    if (best === null || entry.step > best.step) best = entry;
  }
  return best;
}

export function controllerHealthAt(
  decision: DecisionRecord | null,
  trustHistory: TrustSnapshotEntry[] | null,
  step: number
): ControllerHealthAt[] {
  const snapshotEntry = pickLatestSnapshot(trustHistory, step);
  const trusted = decision?.trusted_controllers ?? [];
  const rejected = decision?.rejected_controllers ?? [];

  return CONTROLLER_IDS.map((id) => {
    let trust = 0;
    let status: ControllerStatus = "UNKNOWN";
    if (snapshotEntry) {
      const raw = snapshotEntry.snapshot[id];
      if (isComponentTrustSnapshot(raw)) {
        trust = clamp01(raw.trust);
        status = normaliseStatus(raw.status);
      }
    }
    return {
      id,
      trust,
      status,
      isTrusted: trusted.includes(id),
      isRejected: rejected.includes(id),
    };
  });
}

function isActiveAt(fault: FaultRecord, step: number): boolean {
  if (fault.start_step > step) return false;
  if (fault.end_step === null) return true;
  return fault.end_step > step;
}

function toActiveFaultAt(fault: FaultRecord): ActiveFaultAt {
  return {
    id: fault.fault_id,
    target: fault.target,
    description: describeFault({ type: fault.type, target: fault.target }),
    startedAtStep: fault.start_step,
  };
}

function sortFaults(a: ActiveFaultAt, b: ActiveFaultAt): number {
  if (a.startedAtStep !== b.startedAtStep) {
    return a.startedAtStep - b.startedAtStep;
  }
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function activeFaultsAt(faults: FaultRecord[], step: number): ActiveFaultAt[] {
  return faults
    .filter((fault) => isActiveAt(fault, step))
    .map(toActiveFaultAt)
    .sort(sortFaults);
}

export function faultsJustInjectedAt(
  faults: FaultRecord[],
  step: number
): ActiveFaultAt[] {
  return faults
    .filter((fault) => fault.start_step === step)
    .map(toActiveFaultAt)
    .sort(sortFaults);
}

export function modeJustChangedAt(
  decisions: DecisionRecord[] | null,
  step: number
): ModeChangeAt {
  if (step <= 0) return null;
  if (!decisions || decisions.length === 0) return null;
  if (step >= decisions.length) return null;
  const prev = decisions[step - 1].system_mode;
  const curr = decisions[step].system_mode;
  if (prev === curr) return null;
  return { from: prev, to: curr };
}
