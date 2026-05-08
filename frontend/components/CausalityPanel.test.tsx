// CausalityPanel — operator-level summary panel tests.
//
// Coverage targets the contract documented in CLAUDE.md Phase B10:
//   * renders system state + previous-mode chip when decision present
//   * hides previous-mode chip when previous_mode === system_mode (we
//     render it but visually subdue it; assert it stays present and
//     opaque-grey)
//   * resolves active_fault_ids → fault chips via the faults prop
//   * "no active faults" copy when active_fault_ids is empty
//   * detector findings sub-section appears when present, hidden when
//     empty
//   * truncated fingerprint is rendered with the full hash in title
//   * EmptyState is rendered when the decision is null

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CausalityPanel } from "./CausalityPanel";
import type { DecisionRecord, FaultRecord } from "@/types/api";

const FAULT: FaultRecord = {
  fault_id: "fault-1",
  type: "SENSOR_DRIFT",
  target: "barometer",
  start_step: 1,
  end_step: null,
  severity: "WARNING",
  metadata: {},
};

const BASE: DecisionRecord = {
  step: 5,
  final_action: "DECELERATE",
  system_mode: "DEGRADED",
  safe_mode_active: false,
  justification: "fallback applied",
  trusted_controllers: ["primary"],
  rejected_controllers: ["secondary"],
  previous_mode: "NORMAL",
  trigger_reason: "sensor drift detected",
  active_fault_ids: ["fault-1"],
  detector_findings: [
    { component: "barometer", severity: "DEGRADED", message: "altitude drift > 5m" },
  ],
  vote_split: {
    outcome: "SPLIT",
    selected_action: "DECELERATE",
    agreeing: ["primary"],
    rejected: ["secondary"],
    reason: "controllers disagreed",
  },
};

afterEach(() => cleanup());

describe("CausalityPanel", () => {
  it("renders an empty state when decision is null", () => {
    render(<CausalityPanel decision={null} faults={[]} />);
    expect(screen.queryByTestId("causality-panel")).toBeNull();
    expect(screen.getByText(/NO DECISION YET/i)).toBeTruthy();
  });

  it("renders system state + previous-mode chip when modes differ", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    // "DEGRADED" appears in both the SystemModeBadge and a detector
    // finding chip — both legitimate, so we expect at least one.
    expect(screen.getAllByText("DEGRADED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/← previous: NORMAL/i)).toBeTruthy();
  });

  it("renders the previous-mode chip with subdued styling when modes match", () => {
    const sameMode: DecisionRecord = {
      ...BASE,
      previous_mode: "DEGRADED",
    };
    const { container } = render(<CausalityPanel decision={sameMode} faults={[FAULT]} />);
    const chip = screen.getByText(/← previous: DEGRADED/i);
    expect(chip).toBeTruthy();
    // Subdued chip carries the opacity-60 class so it stays present
    // but visually de-emphasised, per spec.
    expect(chip.className).toMatch(/opacity-60/);
    // Sanity-check we still rendered the panel itself.
    expect(container.querySelector('[data-testid="causality-panel"]')).not.toBeNull();
  });

  it("resolves active_fault_ids to type→target labels via the faults prop", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    expect(screen.getByText("SENSOR_DRIFT → barometer")).toBeTruthy();
  });

  it("falls back to the bare fault id when not found in faults", () => {
    render(<CausalityPanel decision={BASE} faults={[]} />);
    expect(screen.getByText("fault-1")).toBeTruthy();
  });

  it("shows 'no active faults' when active_fault_ids is empty", () => {
    const noFaults: DecisionRecord = { ...BASE, active_fault_ids: [] };
    render(<CausalityPanel decision={noFaults} faults={[]} />);
    expect(screen.getByText(/no active faults/i)).toBeTruthy();
  });

  it("renders the detector findings sub-section when present", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    expect(screen.getByText(/Detector findings/i)).toBeTruthy();
    expect(screen.getByText("barometer")).toBeTruthy();
  });

  it("hides the detector findings sub-section when empty", () => {
    const noFindings: DecisionRecord = { ...BASE, detector_findings: [] };
    render(<CausalityPanel decision={noFindings} faults={[FAULT]} />);
    expect(screen.queryByText(/Detector findings/i)).toBeNull();
  });

  it("renders truncated fingerprint with full hash in title attr", () => {
    const fp = "abcdef1234567890abcdef1234567890abcdef12";
    render(<CausalityPanel decision={BASE} faults={[FAULT]} replayFingerprint={fp} />);
    const truncated = screen.getByText(`${fp.slice(0, 12)}…`);
    expect(truncated).toBeTruthy();
    expect(truncated.getAttribute("title")).toBe(fp);
  });

  it("renders an em-dash when no fingerprint is provided", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    // The fingerprint row is the only one rendering a bare em-dash
    // inside a font-mono span with text-text-muted.
    const muted = screen.getAllByText("—");
    expect(muted.length).toBeGreaterThan(0);
  });

  it("renders the controller vote summary from vote_split", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    expect(screen.getByText(/SPLIT: DECELERATE \(1\/2 agree\)/i)).toBeTruthy();
  });

  it("falls back to trusted/rejected when vote_split is missing", () => {
    const legacy: DecisionRecord = {
      ...BASE,
      vote_split: undefined,
      trusted_controllers: ["a", "b"],
      rejected_controllers: ["c"],
    };
    render(<CausalityPanel decision={legacy} faults={[FAULT]} />);
    // 2 trusted / 3 total (2 + 1).
    expect(screen.getByText(/DECELERATE \(2\/3 agree\)/i)).toBeTruthy();
  });

  it("uses justification when trigger_reason is absent", () => {
    const legacy: DecisionRecord = {
      ...BASE,
      trigger_reason: undefined,
      justification: "manual override",
    };
    render(<CausalityPanel decision={legacy} faults={[FAULT]} />);
    expect(screen.getByText("manual override")).toBeTruthy();
  });

  it("derives previous_mode from previousDecision prop when missing on decision", () => {
    const decision: DecisionRecord = {
      ...BASE,
      previous_mode: undefined,
    };
    const previous: DecisionRecord = {
      ...BASE,
      step: 4,
      system_mode: "NORMAL",
    };
    render(<CausalityPanel decision={decision} faults={[FAULT]} previousDecision={previous} />);
    expect(screen.getByText(/← previous: NORMAL/i)).toBeTruthy();
  });

  it("renders FaultEvidenceCards when activeFaults is supplied", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} activeFaults={[FAULT]} />);
    // Fault cards live in the dedicated container; the chip-style
    // label should NOT appear when activeFaults is supplied.
    expect(screen.getByTestId("causality-active-fault-cards")).toBeTruthy();
    expect(screen.queryByText("SENSOR_DRIFT → barometer")).toBeNull();
    // The card itself uses the humanised type (Title Case).
    expect(screen.getByText("Sensor Drift")).toBeTruthy();
  });

  it("falls back to fault chips when activeFaults is omitted", () => {
    render(<CausalityPanel decision={BASE} faults={[FAULT]} />);
    expect(screen.queryByTestId("causality-active-fault-cards")).toBeNull();
    expect(screen.getByText("SENSOR_DRIFT → barometer")).toBeTruthy();
  });

  it("renders the ReplayExplainer instead of the fingerprint row when expanded", () => {
    const fp = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    render(
      <CausalityPanel
        decision={BASE}
        faults={[FAULT]}
        replayFingerprint={fp}
        expanded
        simulationId="sim-1"
        stepCount={42}
      />
    );
    // Replay Fingerprint row label should NOT render when expanded.
    expect(screen.queryByText(/Replay Fingerprint/i)).toBeTruthy();
    expect(screen.getByTestId("causality-replay-explainer")).toBeTruthy();
    expect(screen.getByTestId("replay-explainer")).toBeTruthy();
    // The truncated 12-char form (legacy) is gone; the 8…8 explainer
    // form is the one rendered.
    expect(screen.queryByText(`${fp.slice(0, 12)}…`)).toBeNull();
    expect(screen.getByTestId("replay-fingerprint-hash").textContent).toBe(
      `${fp.slice(0, 8)}…${fp.slice(-8)}`
    );
  });
});
