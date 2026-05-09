import { describe, it, expect } from "vitest";

import {
  activeFaultsAt,
  controllerHealthAt,
  describeFault,
  faultsJustInjectedAt,
  modeJustChangedAt,
  statusAt,
} from "./sceneState";
import type {
  DecisionRecord,
  FaultRecord,
  SystemMode,
  TrustSnapshotEntry,
} from "@/types/api";

function makeDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    step: 0,
    final_action: "HOLD",
    system_mode: "NORMAL",
    safe_mode_active: false,
    justification: "",
    trusted_controllers: [],
    rejected_controllers: [],
    trigger_reason: "all components healthy",
    ...overrides,
  };
}

function makeFault(overrides: Partial<FaultRecord> = {}): FaultRecord {
  return {
    fault_id: "f1",
    type: "SENSOR_DROPOUT",
    target: "sensor",
    start_step: 0,
    end_step: null,
    severity: "WARNING",
    metadata: {},
    ...overrides,
  };
}

describe("statusAt", () => {
  it("returns UNKNOWN/empty/null when decision is null", () => {
    const result = statusAt(null, []);
    expect(result).toEqual({ headline: "", cause: null, mode: "UNKNOWN" });
  });

  it("returns the NORMAL headline and null cause when mode=NORMAL, trigger_reason='all components healthy', faults=[]", () => {
    const decision = makeDecision({
      system_mode: "NORMAL",
      trigger_reason: "all components healthy",
    });
    const result = statusAt(decision, []);
    expect(result.headline).toBe(
      "All three controllers agree. The system is operating normally."
    );
    expect(result.cause).toBeNull();
    expect(result.mode).toBe("NORMAL");
  });

  it("returns DEGRADED headline + cause-with-fault when mode=DEGRADED with at least one fault", () => {
    const decision = makeDecision({
      system_mode: "DEGRADED",
      trigger_reason: "controller disagreement",
    });
    const fault = makeFault({
      fault_id: "fa",
      type: "CONTROLLER_LATENCY",
      target: "controller_b",
      start_step: 1,
    });
    const result = statusAt(decision, [fault]);
    expect(result.headline).toBe(
      "One controller is unhealthy. The system is still producing actions, but with restrictions."
    );
    expect(result.cause).toBe(
      "Active fault: a controller is responding too slowly."
    );
    expect(result.mode).toBe("DEGRADED");
  });

  it("returns SAFE_MODE headline", () => {
    const decision = makeDecision({
      system_mode: "SAFE_MODE",
      trigger_reason: "low confidence",
    });
    const result = statusAt(decision, []);
    expect(result.headline).toBe(
      "The system has lost confidence in its inputs. It is restricted to safe actions only."
    );
    expect(result.mode).toBe("SAFE_MODE");
  });

  it("returns FAILED headline", () => {
    const decision = makeDecision({
      system_mode: "FAILED",
      trigger_reason: "critical fault",
    });
    const result = statusAt(decision, []);
    expect(result.headline).toBe("Multiple critical failures. The system has aborted.");
    expect(result.mode).toBe("FAILED");
  });

  it("'all components healthy' with empty faults -> cause is null even if mode is NORMAL", () => {
    const decision = makeDecision({
      system_mode: "NORMAL",
      trigger_reason: "All Components Healthy",
    });
    const result = statusAt(decision, []);
    expect(result.cause).toBeNull();
  });

  it("non-empty trigger_reason with no faults and DEGRADED mode -> cause begins with 'Trigger: '", () => {
    const decision = makeDecision({
      system_mode: "DEGRADED",
      trigger_reason: "sensor drift detected",
    });
    const result = statusAt(decision, []);
    expect(result.cause).not.toBeNull();
    expect(result.cause?.startsWith("Trigger: ")).toBe(true);
  });
});

describe("controllerHealthAt", () => {
  it("returns 3 entries in order: controller_a, controller_b, controller_c, even when trustHistory is empty", () => {
    const result = controllerHealthAt(null, [], 0);
    expect(result).toHaveLength(3);
    expect(result.map((entry) => entry.id)).toEqual([
      "controller_a",
      "controller_b",
      "controller_c",
    ]);
  });

  it("picks the latest snapshot at step <= currentStep (uses snapshot from step 5 when current=10 and only step 5 exists)", () => {
    const trustHistory: TrustSnapshotEntry[] = [
      {
        step: 5,
        snapshot: {
          controller_a: {
            status: "HEALTHY",
            trust: 0.9,
            fault_streak: 0,
            clean_streak: 5,
            repeat_count: 0,
          },
          controller_b: {
            status: "DEGRADED",
            trust: 0.4,
            fault_streak: 2,
            clean_streak: 0,
            repeat_count: 1,
          },
          controller_c: {
            status: "HEALTHY",
            trust: 0.85,
            fault_streak: 0,
            clean_streak: 4,
            repeat_count: 0,
          },
        },
      },
    ];
    const result = controllerHealthAt(null, trustHistory, 10);
    expect(result[0].trust).toBeCloseTo(0.9);
    expect(result[0].status).toBe("HEALTHY");
    expect(result[1].trust).toBeCloseTo(0.4);
    expect(result[1].status).toBe("DEGRADED");
  });

  it("isTrusted/isRejected reflect the decision record's trusted/rejected lists", () => {
    const decision = makeDecision({
      trusted_controllers: ["controller_a", "controller_c"],
      rejected_controllers: ["controller_b"],
    });
    const result = controllerHealthAt(decision, [], 0);
    const byId = Object.fromEntries(result.map((entry) => [entry.id, entry]));
    expect(byId.controller_a.isTrusted).toBe(true);
    expect(byId.controller_a.isRejected).toBe(false);
    expect(byId.controller_b.isTrusted).toBe(false);
    expect(byId.controller_b.isRejected).toBe(true);
    expect(byId.controller_c.isTrusted).toBe(true);
    expect(byId.controller_c.isRejected).toBe(false);
  });

  it("decision=null -> all three entries have isTrusted=false, isRejected=false", () => {
    const result = controllerHealthAt(null, [], 0);
    for (const entry of result) {
      expect(entry.isTrusted).toBe(false);
      expect(entry.isRejected).toBe(false);
    }
  });

  it("snapshot with no trust/status is treated as trust=0, status='UNKNOWN'", () => {
    const trustHistory: TrustSnapshotEntry[] = [
      {
        step: 0,
        snapshot: {
          controller_a: { disagreement_rate: 0.1 },
          controller_b: { disagreement_rate: 0.2 },
          controller_c: { disagreement_rate: 0.3 },
        },
      },
    ];
    const result = controllerHealthAt(null, trustHistory, 0);
    for (const entry of result) {
      expect(entry.trust).toBe(0);
      expect(entry.status).toBe("UNKNOWN");
    }
  });
});

describe("activeFaultsAt", () => {
  it("includes a fault with start=2, end=null at step 5", () => {
    const fault = makeFault({ fault_id: "open", start_step: 2, end_step: null });
    const result = activeFaultsAt([fault], 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("open");
  });

  it("excludes a fault with start=2, end=4 at step 5", () => {
    const fault = makeFault({ fault_id: "closed", start_step: 2, end_step: 4 });
    const result = activeFaultsAt([fault], 5);
    expect(result).toHaveLength(0);
  });

  it("includes a fault with start=2, end=10 at step 5", () => {
    const fault = makeFault({ fault_id: "spanning", start_step: 2, end_step: 10 });
    const result = activeFaultsAt([fault], 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("spanning");
  });

  it("excludes a fault with start=10 at step 5", () => {
    const fault = makeFault({ fault_id: "future", start_step: 10, end_step: null });
    const result = activeFaultsAt([fault], 5);
    expect(result).toHaveLength(0);
  });

  it("sorted by start_step ascending then by fault_id ascending", () => {
    const faults: FaultRecord[] = [
      makeFault({ fault_id: "z", start_step: 3 }),
      makeFault({ fault_id: "a", start_step: 5 }),
      makeFault({ fault_id: "b", start_step: 3 }),
      makeFault({ fault_id: "m", start_step: 1 }),
    ];
    const result = activeFaultsAt(faults, 10);
    expect(result.map((entry) => entry.id)).toEqual(["m", "b", "z", "a"]);
  });
});

describe("faultsJustInjectedAt", () => {
  it("returns only faults whose start_step === step", () => {
    const faults: FaultRecord[] = [
      makeFault({ fault_id: "earlier", start_step: 2 }),
      makeFault({ fault_id: "now1", start_step: 5 }),
      makeFault({ fault_id: "now2", start_step: 5 }),
      makeFault({ fault_id: "later", start_step: 8 }),
    ];
    const result = faultsJustInjectedAt(faults, 5);
    expect(result.map((entry) => entry.id)).toEqual(["now1", "now2"]);
  });

  it("step where no fault was injected -> empty array", () => {
    const faults: FaultRecord[] = [
      makeFault({ fault_id: "f1", start_step: 1 }),
      makeFault({ fault_id: "f2", start_step: 4 }),
    ];
    const result = faultsJustInjectedAt(faults, 3);
    expect(result).toEqual([]);
  });
});

describe("modeJustChangedAt", () => {
  function decisionWithMode(step: number, mode: SystemMode): DecisionRecord {
    return makeDecision({ step, system_mode: mode });
  }

  it("step 0 -> null", () => {
    const decisions = [decisionWithMode(0, "NORMAL")];
    expect(modeJustChangedAt(decisions, 0)).toBeNull();
  });

  it("decisions null -> null", () => {
    expect(modeJustChangedAt(null, 5)).toBeNull();
  });

  it("decisions empty -> null", () => {
    expect(modeJustChangedAt([], 1)).toBeNull();
  });

  it("two adjacent decisions with same mode -> null", () => {
    const decisions = [
      decisionWithMode(0, "NORMAL"),
      decisionWithMode(1, "NORMAL"),
    ];
    expect(modeJustChangedAt(decisions, 1)).toBeNull();
  });

  it("two adjacent decisions with different modes -> { from, to } object", () => {
    const decisions = [
      decisionWithMode(0, "NORMAL"),
      decisionWithMode(1, "DEGRADED"),
    ];
    expect(modeJustChangedAt(decisions, 1)).toEqual({
      from: "NORMAL",
      to: "DEGRADED",
    });
  });

  it("step >= decisions.length -> null", () => {
    const decisions = [
      decisionWithMode(0, "NORMAL"),
      decisionWithMode(1, "DEGRADED"),
    ];
    expect(modeJustChangedAt(decisions, 2)).toBeNull();
    expect(modeJustChangedAt(decisions, 99)).toBeNull();
  });
});

describe("describeFault", () => {
  it("maps SENSOR_DROPOUT to 'a sensor stopped reporting'", () => {
    expect(describeFault({ type: "SENSOR_DROPOUT", target: "sensor" })).toBe(
      "a sensor stopped reporting"
    );
  });

  it("maps CONTROLLER_LATENCY to 'a controller is responding too slowly'", () => {
    expect(describeFault({ type: "CONTROLLER_LATENCY", target: "controller_b" })).toBe(
      "a controller is responding too slowly"
    );
  });

  it("falls back to lowercase-hyphen for unknown types (UNKNOWN_TYPE -> 'unknown-type')", () => {
    expect(describeFault({ type: "UNKNOWN_TYPE", target: "x" })).toBe("unknown-type");
  });
});
