import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { VotePanel } from "./VotePanel";
import type { ComponentTrustSnapshot, ControllerOutput, VoteResult } from "@/types/api";

function makeController(overrides: Partial<ControllerOutput> = {}): ControllerOutput {
  return {
    controller_id: "controller_a",
    step: 1,
    action: "MAINTAIN",
    confidence: 0.9,
    reason_code: "OK",
    response_time_ms: 100,
    valid: true,
    ...overrides,
  };
}

const CONSENSUS_VOTE: VoteResult = {
  outcome: "CONSENSUS",
  selected_action: "MAINTAIN",
  agreeing_controllers: ["controller_a", "controller_b", "controller_c"],
  rejected_controllers: [],
  reason: "all controllers agreed on MAINTAIN",
};

const CONTROLLERS_OK: ControllerOutput[] = [
  makeController({ controller_id: "controller_a" }),
  makeController({ controller_id: "controller_b", action: "MAINTAIN" }),
  makeController({ controller_id: "controller_c", action: "MAINTAIN" }),
];

afterEach(() => cleanup());

describe("VotePanel", () => {
  it("renders consensus rationale and no exclusions", () => {
    render(<VotePanel controllers={CONTROLLERS_OK} vote={CONSENSUS_VOTE} />);
    expect(screen.getByTestId("vote-rationale").textContent).toMatch(
      /Majority consensus: MAINTAIN/
    );
    expect(screen.getByText(/No exclusions/i)).toBeTruthy();
    expect(screen.getByText(/all controllers agreed on MAINTAIN/i)).toBeTruthy();
    // Outcome chip mirrors the outcome word.
    expect(screen.getByTestId("vote-outcome").textContent).toBe("CONSENSUS");
  });

  it("formats controller_a/b/c as Controller A/B/C", () => {
    render(<VotePanel controllers={CONTROLLERS_OK} vote={CONSENSUS_VOTE} />);
    expect(screen.getByText("Controller A")).toBeTruthy();
    expect(screen.getByText("Controller B")).toBeTruthy();
    expect(screen.getByText("Controller C")).toBeTruthy();
  });

  it("renders SPLIT rationale and cites latency for over-budget controllers", () => {
    const split: VoteResult = {
      outcome: "SPLIT",
      selected_action: "DECELERATE",
      agreeing_controllers: ["controller_a", "controller_c"],
      rejected_controllers: ["controller_b"],
      reason: "controller_b exceeded latency",
    };
    const controllers = [
      makeController({ controller_id: "controller_a", action: "DECELERATE" }),
      makeController({
        controller_id: "controller_b",
        action: "ASCEND",
        response_time_ms: 230,
      }),
      makeController({ controller_id: "controller_c", action: "DECELERATE" }),
    ];
    render(<VotePanel controllers={controllers} vote={split} />);
    expect(screen.getByTestId("vote-rationale").textContent).toMatch(
      /No consensus — controllers disagree/
    );
    expect(screen.getByText("controller_b excluded: latency 230ms exceeds 150ms")).toBeTruthy();
  });

  it("cites invalid output when a rejected controller is invalid", () => {
    const split: VoteResult = {
      outcome: "INSUFFICIENT_DATA",
      selected_action: null,
      agreeing_controllers: [],
      rejected_controllers: ["controller_a", "controller_b", "controller_c"],
      reason: "no valid controllers",
    };
    const controllers = [
      makeController({ controller_id: "controller_a", valid: false }),
      makeController({ controller_id: "controller_b", valid: false }),
      makeController({
        controller_id: "controller_c",
        valid: true,
        response_time_ms: 80,
      }),
    ];
    render(<VotePanel controllers={controllers} vote={split} />);
    expect(screen.getByTestId("vote-rationale").textContent).toMatch(
      /Insufficient valid controllers — defaulting to safe action/
    );
    expect(screen.getByText("controller_a excluded: invalid output")).toBeTruthy();
    expect(screen.getByText("controller_b excluded: invalid output")).toBeTruthy();
    // controller_c is valid + within budget but still in rejected_controllers
    // → fall through to bare "rejected".
    expect(screen.getByText("controller_c excluded: rejected")).toBeTruthy();
  });

  it("renders trust meter when trustSnapshot provided", () => {
    const trust: Record<string, ComponentTrustSnapshot> = {
      controller_a: {
        status: "HEALTHY",
        trust: 0.92,
        fault_streak: 0,
        clean_streak: 12,
        repeat_count: 0,
      },
      controller_b: {
        status: "DEGRADED",
        trust: 0.45,
        fault_streak: 3,
        clean_streak: 0,
        repeat_count: 0,
      },
      controller_c: {
        status: "HEALTHY",
        trust: 0.88,
        fault_streak: 0,
        clean_streak: 9,
        repeat_count: 0,
      },
    };
    render(<VotePanel controllers={CONTROLLERS_OK} vote={CONSENSUS_VOTE} trustSnapshot={trust} />);
    // Status words for all three rendered.
    expect(screen.getAllByText("HEALTHY").length).toBe(2);
    expect(screen.getByText("DEGRADED")).toBeTruthy();
    // 0.92 → 92%, 0.45 → 45%.
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
    // Three progress bars rendered.
    expect(screen.getAllByRole("progressbar").length).toBe(3);
  });

  it("flags response time as red when over the latency budget", () => {
    const split: VoteResult = {
      outcome: "SPLIT",
      selected_action: "MAINTAIN",
      agreeing_controllers: ["controller_a"],
      rejected_controllers: ["controller_b"],
      reason: "split",
    };
    const controllers = [
      makeController({
        controller_id: "controller_a",
        response_time_ms: 100,
      }),
      makeController({
        controller_id: "controller_b",
        response_time_ms: 200,
      }),
    ];
    render(<VotePanel controllers={controllers} vote={split} />);
    const slow = screen.getByText("200 ms");
    expect(slow.className).toMatch(/text-status-failed/);
    const fast = screen.getByText("100 ms");
    expect(fast.className).not.toMatch(/text-status-failed/);
  });

  it("renders empty state when no controllers were captured", () => {
    const vote: VoteResult = {
      outcome: "INSUFFICIENT_DATA",
      selected_action: null,
      agreeing_controllers: [],
      rejected_controllers: [],
      reason: "no data",
    };
    render(<VotePanel controllers={[]} vote={vote} />);
    expect(screen.getByText("No controller outputs.")).toBeTruthy();
    // Still renders the rationale + exclusions block.
    expect(screen.getByTestId("vote-rationale").textContent).toMatch(
      /Insufficient valid controllers/
    );
    expect(screen.getByText(/No exclusions/i)).toBeTruthy();
  });
});
