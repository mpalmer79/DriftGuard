import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ControllerOutputTable } from "./ControllerOutputTable";
import type { ControllerOutput, VoteResult } from "@/types/api";

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

afterEach(() => cleanup());

describe("ControllerOutputTable", () => {
  it("renders the empty state when no outputs are provided", () => {
    render(<ControllerOutputTable outputs={[]} />);
    expect(screen.getByText("No controller outputs.")).toBeTruthy();
  });

  it("renders one row per controller and rounds confidence to whole percent", () => {
    const outputs = [
      makeController({ controller_id: "controller_a", confidence: 0.92 }),
      makeController({
        controller_id: "controller_b",
        confidence: 0.451,
      }),
      makeController({ controller_id: "controller_c", confidence: 0.7 }),
    ];
    render(<ControllerOutputTable outputs={outputs} />);
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByTestId("controller-row-controller_a")).toBeTruthy();
    expect(screen.getByTestId("controller-row-controller_b")).toBeTruthy();
    expect(screen.getByTestId("controller-row-controller_c")).toBeTruthy();
  });

  it("colors response time red when over the 150ms latency budget", () => {
    const outputs = [
      makeController({
        controller_id: "controller_a",
        response_time_ms: 200,
      }),
      makeController({
        controller_id: "controller_b",
        response_time_ms: 100,
      }),
    ];
    render(<ControllerOutputTable outputs={outputs} />);
    const slow = screen.getByText("200 ms");
    expect(slow.className).toMatch(/text-status-failed/);
    const fast = screen.getByText("100 ms");
    expect(fast.className).not.toMatch(/text-status-failed/);
  });

  it("uses the vote to color rows green/amber for agreeing/rejected controllers", () => {
    const outputs = [
      makeController({ controller_id: "controller_a" }),
      makeController({ controller_id: "controller_b" }),
    ];
    const vote: VoteResult = {
      outcome: "SPLIT",
      selected_action: "MAINTAIN",
      agreeing_controllers: ["controller_a"],
      rejected_controllers: ["controller_b"],
      reason: "split",
    };
    render(<ControllerOutputTable outputs={outputs} vote={vote} />);
    const a = screen.getByTestId("controller-row-controller_a");
    const b = screen.getByTestId("controller-row-controller_b");
    expect(a.className).toMatch(/bg-status-nominal/);
    expect(b.className).toMatch(/bg-status-degraded/);
  });
});
