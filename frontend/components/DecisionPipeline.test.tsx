// DecisionPipeline — sensor → controllers → voter → detectors → mode
// → action chain visualisation.
//
// Coverage:
//   * empty state when step prop is null
//   * each of the six stages renders with the right label
//   * sensor stage colors: OK + no flags → nominal; INVALID → failed
//   * controller stage colors: any invalid controller → degraded
//   * voter stage shows outcome + selected_action and surfaces the
//     vote_split.reason as a tooltip / second line
//   * detectors stage falls back to "no findings" when empty
//   * mode stage shows previous → current and trigger_reason

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DecisionPipeline } from "./DecisionPipeline";
import type { TimelineEntry } from "@/types/api";

const STEP: TimelineEntry = {
  step: 7,
  state: {
    simulation_id: "sim-1",
    step: 7,
    timestamp: 0,
    position_x: 0,
    position_y: 0,
    altitude: 100,
    velocity: 5,
    heading: 0,
    pitch: 0,
    roll: 0,
    system_mode: "DEGRADED",
    last_action: "DECELERATE",
  },
  sensor: {
    reading_id: "r-1",
    step: 7,
    altitude: 100,
    velocity: 5,
    heading: 0,
    pitch: 0,
    roll: 0,
    confidence: 0.7,
    status: "DEGRADED",
    fault_flags: ["DRIFT"],
  },
  controllers: [
    {
      controller_id: "primary",
      step: 7,
      action: "DECELERATE",
      confidence: 0.9,
      reason_code: "OK",
      response_time_ms: 50,
      valid: true,
    },
    {
      controller_id: "secondary",
      step: 7,
      action: "MAINTAIN",
      confidence: 0.6,
      reason_code: "TIMEOUT",
      response_time_ms: 1200,
      valid: false,
    },
    {
      controller_id: "tertiary",
      step: 7,
      action: "DECELERATE",
      confidence: 0.85,
      reason_code: "OK",
      response_time_ms: 60,
      valid: true,
    },
  ],
  vote: {
    outcome: "SPLIT",
    selected_action: "DECELERATE",
    agreeing_controllers: ["primary", "tertiary"],
    rejected_controllers: ["secondary"],
    reason: "secondary timed out",
  },
  decision: {
    step: 7,
    final_action: "DECELERATE",
    system_mode: "DEGRADED",
    safe_mode_active: false,
    justification: "fallback applied",
    trusted_controllers: ["primary", "tertiary"],
    rejected_controllers: ["secondary"],
    previous_mode: "NORMAL",
    trigger_reason: "controller timed out",
    active_fault_ids: ["fault-1"],
    detector_findings: [
      { component: "secondary", severity: "DEGRADED", message: "exceeded latency budget" },
    ],
    vote_split: {
      outcome: "SPLIT",
      selected_action: "DECELERATE",
      agreeing: ["primary", "tertiary"],
      rejected: ["secondary"],
      reason: "secondary timed out",
    },
  },
  events: [],
};

afterEach(() => cleanup());

describe("DecisionPipeline", () => {
  it("renders an empty state when step is null", () => {
    render(<DecisionPipeline step={null} />);
    expect(screen.queryByTestId("decision-pipeline")).toBeNull();
    expect(screen.getByText(/NO STEP SELECTED/i)).toBeTruthy();
  });

  it("renders all six stages with correct labels", () => {
    render(<DecisionPipeline step={STEP} />);
    expect(screen.getByTestId("pipeline-sensor")).toBeTruthy();
    expect(screen.getByTestId("pipeline-controllers")).toBeTruthy();
    expect(screen.getByTestId("pipeline-voter")).toBeTruthy();
    expect(screen.getByTestId("pipeline-detectors")).toBeTruthy();
    expect(screen.getByTestId("pipeline-mode")).toBeTruthy();
    expect(screen.getByTestId("pipeline-action")).toBeTruthy();
  });

  it("colors the sensor stage nominal when status OK and no flags", () => {
    const ok: TimelineEntry = {
      ...STEP,
      sensor: { ...STEP.sensor, status: "OK", fault_flags: [] },
    };
    render(<DecisionPipeline step={ok} />);
    const sensorStage = screen.getByTestId("pipeline-sensor");
    expect(sensorStage.className).toMatch(/status-nominal/);
    expect(sensorStage.textContent).toMatch(/nominal/i);
  });

  it("colors the sensor stage failed on INVALID status", () => {
    const bad: TimelineEntry = {
      ...STEP,
      sensor: { ...STEP.sensor, status: "INVALID", fault_flags: ["DROPOUT"] },
    };
    render(<DecisionPipeline step={bad} />);
    const sensorStage = screen.getByTestId("pipeline-sensor");
    expect(sensorStage.className).toMatch(/status-failed/);
  });

  it("colors the controllers stage degraded if any controller is invalid", () => {
    render(<DecisionPipeline step={STEP} />);
    const ctrlStage = screen.getByTestId("pipeline-controllers");
    expect(ctrlStage.className).toMatch(/status-degraded/);
    // All three controller chips should be present.
    expect(ctrlStage.textContent).toMatch(/primary/);
    expect(ctrlStage.textContent).toMatch(/secondary/);
    expect(ctrlStage.textContent).toMatch(/tertiary/);
  });

  it("renders the voter stage with outcome, action, and reason", () => {
    render(<DecisionPipeline step={STEP} />);
    const voter = screen.getByTestId("pipeline-voter");
    expect(voter.textContent).toMatch(/SPLIT/);
    expect(voter.textContent).toMatch(/DECELERATE/);
    const reason = screen.getByTestId("pipeline-voter-reason");
    expect(reason.textContent).toMatch(/secondary timed out/);
    expect(reason.getAttribute("title")).toBe("secondary timed out");
  });

  it("falls back to 'no findings' when detector_findings is empty", () => {
    const empty: TimelineEntry = {
      ...STEP,
      decision: { ...STEP.decision, detector_findings: [] },
    };
    render(<DecisionPipeline step={empty} />);
    const detectors = screen.getByTestId("pipeline-detectors");
    expect(detectors.textContent).toMatch(/no findings/i);
  });

  it("renders previous → current mode and the trigger reason", () => {
    render(<DecisionPipeline step={STEP} />);
    const mode = screen.getByTestId("pipeline-mode");
    expect(mode.textContent).toMatch(/NORMAL/);
    expect(mode.textContent).toMatch(/DEGRADED/);
    expect(screen.getByTestId("pipeline-mode-reason").textContent).toMatch(
      /controller timed out/i
    );
  });

  it("escalates the action stage to safemode when safe_mode_active is true", () => {
    const safe: TimelineEntry = {
      ...STEP,
      decision: {
        ...STEP.decision,
        safe_mode_active: true,
        system_mode: "SAFE_MODE",
        final_action: "ABORT",
      },
    };
    render(<DecisionPipeline step={safe} />);
    const action = screen.getByTestId("pipeline-action");
    expect(action.className).toMatch(/status-safemode/);
    expect(action.textContent).toMatch(/safe_mode=true/);
    expect(action.textContent).toMatch(/ABORT/);
  });
});
