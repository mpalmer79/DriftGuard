import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  ExecutionSummaryCard,
  describeDetectorResponse,
  summarizeEscalation,
} from "./ExecutionSummaryCard";
import type { Scenario, ScenarioResult } from "@/types/api";

const BASE_RESULT: ScenarioResult = {
  scenario: "sensor_drift_recovery",
  simulation_id: "sim-123",
  steps_run: 25,
  final_mode: "DEGRADED",
  final_action: "DECELERATE",
  fault_summary: [
    {
      fault_id: "fault-1",
      type: "SENSOR_DRIFT",
      target: "sensor",
      start_step: 3,
      end_step: 11,
      severity: "WARNING",
      metadata: {},
    },
  ],
  decision_counts: { NORMAL: 3, DEGRADED: 22 },
  event_counts: { CONSENSUS: 18, SPLIT: 5, INSUFFICIENT_DATA: 2 },
  mode_transitions: [
    { step: 0, mode: "NORMAL" },
    { step: 7, mode: "DEGRADED" },
  ],
  trust_snapshot: {},
};

const NOMINAL_RESULT: ScenarioResult = {
  scenario: "nominal_cruise",
  simulation_id: "sim-nominal",
  steps_run: 20,
  final_mode: "NORMAL",
  final_action: "MAINTAIN",
  fault_summary: [],
  decision_counts: { NORMAL: 20 },
  event_counts: {},
  mode_transitions: [{ step: 0, mode: "NORMAL" }],
  trust_snapshot: {},
};

const SCENARIO: Scenario = {
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
      metadata: {},
    },
  ],
  expected_final_modes: ["NORMAL", "DEGRADED", "SAFE_MODE"],
};

afterEach(() => cleanup());

describe("summarizeEscalation", () => {
  it("returns 'No escalation occurred.' when only one mode is present", () => {
    expect(summarizeEscalation([{ step: 0, mode: "NORMAL" }])).toBe("No escalation occurred.");
  });

  it("returns 'No escalation occurred.' for empty input", () => {
    expect(summarizeEscalation([])).toBe("No escalation occurred.");
  });

  it("formats multi-step escalation as 'NORMAL → DEGRADED at step 7 → SAFE_MODE at step 12'", () => {
    const out = summarizeEscalation([
      { step: 0, mode: "NORMAL" },
      { step: 7, mode: "DEGRADED" },
      { step: 12, mode: "SAFE_MODE" },
    ]);
    expect(out).toBe("NORMAL → DEGRADED at step 7 → SAFE_MODE at step 12");
  });

  it("collapses repeated adjacent modes in the transitions list", () => {
    const out = summarizeEscalation([
      { step: 0, mode: "NORMAL" },
      { step: 5, mode: "NORMAL" },
      { step: 7, mode: "DEGRADED" },
    ]);
    expect(out).toBe("NORMAL → DEGRADED at step 7");
  });
});

describe("describeDetectorResponse", () => {
  it("returns 'No escalation' when only the initial mode is present", () => {
    expect(describeDetectorResponse([{ step: 0, mode: "NORMAL" }])).toBe("No escalation");
  });

  it("returns 'Detector escalated' once a second transition appears", () => {
    expect(
      describeDetectorResponse([
        { step: 0, mode: "NORMAL" },
        { step: 7, mode: "DEGRADED" },
      ])
    ).toBe("Detector escalated");
  });
});

describe("ExecutionSummaryCard render", () => {
  it("renders final mode chip, final action, steps run", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    // SystemModeBadge renders the mode text.
    expect(screen.getByText("DEGRADED")).toBeTruthy();
    // Final action appears twice (top metric + final-action chip).
    expect(screen.getAllByText("DECELERATE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("25")).toBeTruthy();
  });

  it("renders fault chips from result.fault_summary", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    const chips = screen.getAllByTestId("exec-summary-fault-chip");
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toMatch(/SENSOR_DRIFT/);
    expect(chips[0].textContent).toMatch(/sensor/);
  });

  it("renders 'No faults injected.' when fault_summary is empty", () => {
    render(<ExecutionSummaryCard result={NOMINAL_RESULT} />);
    expect(screen.getByText(/No faults injected/i)).toBeTruthy();
  });

  it("derives detector response from the mode_transitions length", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    expect(screen.getByTestId("exec-summary-detector").textContent).toMatch(/Detector escalated/);

    cleanup();

    render(<ExecutionSummaryCard result={NOMINAL_RESULT} />);
    expect(screen.getByTestId("exec-summary-detector").textContent).toMatch(/No escalation/);
  });

  it("renders Consensus / Split / Insufficient breakdown when event_counts has those keys", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    expect(screen.getByTestId("exec-summary-votes").textContent).toMatch(
      /Consensus: 18 \/ Split: 5 \/ Insufficient: 2/
    );
  });

  it("falls back to 'Vote stats unavailable' when no vote keys are present", () => {
    const result: ScenarioResult = { ...BASE_RESULT, event_counts: {}, decision_counts: {} };
    render(<ExecutionSummaryCard result={result} />);
    expect(screen.getByTestId("exec-summary-votes").textContent).toMatch(/Vote stats unavailable/);
  });

  it("renders the escalation one-liner from mode_transitions", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    expect(screen.getByTestId("exec-summary-escalation").textContent).toMatch(
      /NORMAL → DEGRADED at step 7/
    );
  });

  it("hides the expected-vs-actual section when no scenario prop is passed", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} />);
    expect(screen.queryByTestId("exec-summary-expected-vs-actual")).toBeNull();
  });

  it("renders 'Within expected envelope' when final_mode is in scenario.expected_final_modes", () => {
    render(<ExecutionSummaryCard result={BASE_RESULT} scenario={SCENARIO} />);
    const chip = screen.getByTestId("exec-summary-envelope-result");
    expect(chip.getAttribute("data-result")).toBe("within");
    expect(chip.textContent).toMatch(/Within expected envelope/i);
  });

  it("renders 'Outside expected envelope' when final_mode is not in expected_final_modes", () => {
    const result: ScenarioResult = { ...BASE_RESULT, final_mode: "FAILED" };
    render(<ExecutionSummaryCard result={result} scenario={SCENARIO} />);
    const chip = screen.getByTestId("exec-summary-envelope-result");
    expect(chip.getAttribute("data-result")).toBe("outside");
    expect(chip.textContent).toMatch(/Outside expected envelope/i);
  });
});
