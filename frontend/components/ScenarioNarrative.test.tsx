// ScenarioNarrative — unit tests covering the operator-brief render
// surface for the five sections: header, what-this-tests, injected
// condition, expected observation, expected escalation, and the
// per-fault-type "what to inspect" checklist mapping.

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ScenarioNarrative } from "./ScenarioNarrative";
import type { Scenario } from "@/types/api";

const SENSOR_SCENARIO: Scenario = {
  name: "sensor_drift_recovery",
  description: "Sensor altitude drifts upward, then the fault clears.",
  expected_behavior: "Sensor health degrades, system restricts unsafe actions, then recovers.",
  seed: 23,
  steps: 25,
  faults: [
    {
      type: "SENSOR_DRIFT",
      target: "sensor",
      start_step: 3,
      duration: 8,
      severity: "WARNING",
      metadata: { magnitude: 4.0 },
    },
  ],
  expected_final_modes: ["NORMAL", "DEGRADED", "SAFE_MODE"],
};

const CONTROLLER_SCENARIO: Scenario = {
  name: "single_controller_latency",
  description: "Controller B exceeds the latency budget for several steps.",
  expected_behavior: "System rejects controller_b and may degrade as latency persists.",
  seed: 11,
  steps: 15,
  faults: [
    {
      type: "CONTROLLER_LATENCY",
      target: "controller_b",
      start_step: 2,
      duration: 10,
      severity: "WARNING",
      metadata: {},
    },
  ],
  expected_final_modes: ["NORMAL", "DEGRADED", "SAFE_MODE"],
};

const GPS_SCENARIO: Scenario = {
  name: "gps_denied_navigation",
  description: "GPS signal lost mid-mission, simulating jamming or urban canyon.",
  expected_behavior:
    "System enters DEGRADED on signal loss as controllers fall back to inertial estimates.",
  seed: 47,
  steps: 20,
  faults: [
    {
      type: "GPS_DENIED",
      target: "gps",
      start_step: 5,
      duration: 15,
      severity: "WARNING",
      metadata: {},
    },
  ],
  expected_final_modes: ["NORMAL", "DEGRADED", "SAFE_MODE"],
};

const NOMINAL_SCENARIO: Scenario = {
  name: "nominal_cruise",
  description: "Steady-state cruise with no faults injected.",
  expected_behavior: "System remains in NORMAL mode for the full run.",
  seed: 42,
  steps: 20,
  faults: [],
  expected_final_modes: ["NORMAL"],
};

const NULL_DURATION_SCENARIO: Scenario = {
  name: "fault_until_end",
  description: "Fault runs until the end of the scenario.",
  expected_behavior: "System tolerates the fault for the remainder of the run.",
  seed: 7,
  steps: 12,
  faults: [
    {
      type: "SENSOR_DROPOUT",
      target: "sensor",
      start_step: 4,
      duration: null,
      severity: "WARNING",
      metadata: {},
    },
  ],
  expected_final_modes: ["DEGRADED"],
};

afterEach(() => cleanup());

describe("ScenarioNarrative", () => {
  it("renders header, seed, default steps and fault count", () => {
    render(<ScenarioNarrative scenario={SENSOR_SCENARIO} />);
    // Formatted name (underscores → spaces, title case).
    expect(screen.getByText("Sensor Drift Recovery")).toBeTruthy();
    expect(screen.getByText(/SEED 23/)).toBeTruthy();
    expect(screen.getByText(/25 STEPS/)).toBeTruthy();
    expect(screen.getByText(/1 FAULT/)).toBeTruthy();
  });

  it("quotes description and expected_behavior verbatim", () => {
    render(<ScenarioNarrative scenario={SENSOR_SCENARIO} />);
    expect(screen.getByText(SENSOR_SCENARIO.description)).toBeTruthy();
    expect(screen.getByText(SENSOR_SCENARIO.expected_behavior)).toBeTruthy();
  });

  it("renders fault chips with start_step → start_step+duration window", () => {
    render(<ScenarioNarrative scenario={SENSOR_SCENARIO} />);
    expect(screen.getByText("SENSOR_DRIFT")).toBeTruthy();
    expect(screen.getByText("sensor")).toBeTruthy();
    expect(screen.getByText("step 3 → 11")).toBeTruthy();
  });

  it("renders 'step N → end' window label for null-duration faults", () => {
    render(<ScenarioNarrative scenario={NULL_DURATION_SCENARIO} />);
    expect(screen.getByText("step 4 → end")).toBeTruthy();
  });

  it("renders expected escalation as connected mode chips", () => {
    render(<ScenarioNarrative scenario={SENSOR_SCENARIO} />);
    const chips = screen.getAllByTestId("mode-chip");
    expect(chips.length).toBe(3);
    expect(chips[0].textContent).toBe("NORMAL");
    expect(chips[1].textContent).toBe("DEGRADED");
    expect(chips[2].textContent).toBe("SAFE_MODE");
  });

  it("uses the sensor checklist for sensor-target faults", () => {
    render(<ScenarioNarrative scenario={SENSOR_SCENARIO} />);
    expect(screen.getByText(/Look at fault_flags/i)).toBeTruthy();
    // Start step 3 + 5 = 8 → "by step 8"
    expect(screen.getByText(/by step 8/i)).toBeTruthy();
  });

  it("uses the controller checklist for controller-target faults", () => {
    render(<ScenarioNarrative scenario={CONTROLLER_SCENARIO} />);
    expect(screen.getByText(/rejected_controllers list for controller_b/i)).toBeTruthy();
    expect(screen.getByText(/SPLIT or CONSENSUS-without-this-controller/i)).toBeTruthy();
  });

  it("uses the GPS checklist for gps-target faults", () => {
    render(<ScenarioNarrative scenario={GPS_SCENARIO} />);
    expect(screen.getByText(/INS-only navigation continues/i)).toBeTruthy();
    expect(screen.getByText(/SAFE_MODE if denial duration exceeds/i)).toBeTruthy();
  });

  it("renders the no-faults message and fallback checklist for nominal scenarios", () => {
    render(<ScenarioNarrative scenario={NOMINAL_SCENARIO} />);
    expect(screen.getByText(/baseline \/ nominal scenario/i)).toBeTruthy();
    expect(screen.getByText(/decisions table/i)).toBeTruthy();
    // Single mode → exactly one chip.
    const chips = screen.getAllByTestId("mode-chip");
    expect(chips.length).toBe(1);
  });
});
