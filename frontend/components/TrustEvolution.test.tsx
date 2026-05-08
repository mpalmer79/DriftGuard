import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TrustEvolution } from "./TrustEvolution";
import type {
  ComponentTrustSnapshot,
  ControllerOutput,
  TimelineEntry,
  TrustSnapshotEntry,
  VehicleState,
  SensorReading,
  VoteResult,
  SystemDecision,
} from "@/types/api";

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

function makeState(step: number): VehicleState {
  return {
    simulation_id: "sim-1",
    step,
    timestamp: step * 0.1,
    position_x: 0,
    position_y: 0,
    altitude: 100,
    velocity: 10,
    heading: 0,
    pitch: 0,
    roll: 0,
    system_mode: "NORMAL",
    last_action: "MAINTAIN",
  };
}

function makeSensor(step: number): SensorReading {
  return {
    reading_id: `r-${step}`,
    step,
    altitude: 100,
    velocity: 10,
    heading: 0,
    pitch: 0,
    roll: 0,
    confidence: 1,
    status: "OK",
    fault_flags: [],
  };
}

function makeVote(): VoteResult {
  return {
    outcome: "CONSENSUS",
    selected_action: "MAINTAIN",
    agreeing_controllers: ["controller_a", "controller_b", "controller_c"],
    rejected_controllers: [],
    reason: "consensus",
  };
}

function makeDecision(step: number): SystemDecision {
  return {
    step,
    final_action: "MAINTAIN",
    system_mode: "NORMAL",
    safe_mode_active: false,
    justification: "ok",
    trusted_controllers: ["controller_a", "controller_b", "controller_c"],
    rejected_controllers: [],
  };
}

function makeEntry(step: number, controllers: ControllerOutput[]): TimelineEntry {
  return {
    step,
    state: makeState(step),
    sensor: makeSensor(step),
    controllers,
    vote: makeVote(),
    decision: makeDecision(step),
    events: [],
  };
}

afterEach(() => cleanup());

describe("TrustEvolution", () => {
  it("renders the empty-state copy when timeline is empty and no snapshot", () => {
    render(<TrustEvolution timeline={[]} />);
    expect(screen.getByText(/No trust history yet — run a scenario to populate/i)).toBeTruthy();
  });

  it("renders one current-trust row per controller in the snapshot", () => {
    const snapshot: Record<string, ComponentTrustSnapshot> = {
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
        status: "RECOVERING",
        trust: 0.7,
        fault_streak: 0,
        clean_streak: 5,
        repeat_count: 0,
      },
      sensor: {
        status: "HEALTHY",
        trust: 1,
        fault_streak: 0,
        clean_streak: 30,
        repeat_count: 0,
      },
    };
    render(<TrustEvolution timeline={[]} trustSnapshot={snapshot} />);
    expect(screen.getByText("HEALTHY")).toBeTruthy();
    expect(screen.getByText("DEGRADED")).toBeTruthy();
    expect(screen.getByText("RECOVERING")).toBeTruthy();
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    // Three progressbars: sensor must not contribute a fourth.
    expect(screen.getAllByRole("progressbar").length).toBe(3);
    expect(screen.getByText("Controller A")).toBeTruthy();
    expect(screen.getByText("Controller B")).toBeTruthy();
    expect(screen.getByText("Controller C")).toBeTruthy();
  });

  it("renders a validity cell per (controller, step) coloured by valid flag", () => {
    const timeline: TimelineEntry[] = [
      makeEntry(1, [
        makeController({ controller_id: "controller_a", valid: true }),
        makeController({ controller_id: "controller_b", valid: false }),
      ]),
      makeEntry(2, [
        makeController({ controller_id: "controller_a", valid: true, step: 2 }),
        makeController({ controller_id: "controller_b", valid: true, step: 2 }),
      ]),
    ];
    const { container } = render(<TrustEvolution timeline={timeline} />);
    const validCells = container.querySelectorAll('[data-valid="true"]');
    const invalidCells = container.querySelectorAll('[data-valid="false"]');
    expect(validCells.length).toBe(3);
    expect(invalidCells.length).toBe(1);
    expect(invalidCells[0].getAttribute("title")).toMatch(/step 1.*invalid/);
  });

  it("falls back to 'Trust snapshot unavailable' when snapshot is missing but timeline has data", () => {
    const timeline: TimelineEntry[] = [
      makeEntry(1, [makeController({ controller_id: "controller_a" })]),
    ];
    render(<TrustEvolution timeline={timeline} />);
    expect(screen.getByTestId("trust-current-empty")).toBeTruthy();
    expect(screen.getByTestId("validity-row-controller_a")).toBeTruthy();
  });

  it("renders a per-step trust sparkline when trustHistory is supplied", () => {
    const trustHistory: TrustSnapshotEntry[] = [
      {
        step: 1,
        snapshot: {
          controller_a: {
            status: "HEALTHY",
            trust: 0.95,
            fault_streak: 0,
            clean_streak: 1,
            repeat_count: 0,
          },
          _global: { disagreement_rate: 0 },
        },
      },
      {
        step: 2,
        snapshot: {
          controller_a: {
            status: "SUSPECT",
            trust: 0.77,
            fault_streak: 1,
            clean_streak: 0,
            repeat_count: 0,
          },
          _global: { disagreement_rate: 0 },
        },
      },
      {
        step: 3,
        snapshot: {
          controller_a: {
            status: "DEGRADED",
            trust: 0.45,
            fault_streak: 3,
            clean_streak: 0,
            repeat_count: 0,
          },
          _global: { disagreement_rate: 0.33 },
        },
      },
    ];
    const { container } = render(<TrustEvolution timeline={[]} trustHistory={trustHistory} />);
    const row = container.querySelector('[data-testid="trust-spark-controller_a"]');
    expect(row).toBeTruthy();
    const cells = row!.querySelectorAll("[data-step]");
    expect(cells.length).toBe(3);
    // Step 3 cell carries the persisted backend trust value.
    const last = cells[cells.length - 1] as HTMLElement;
    expect(last.getAttribute("data-trust")).toBe("0.450");
    expect(screen.getByText(/3 steps/i)).toBeTruthy();
  });

  it("derives current-trust rows from trustHistory when no standalone snapshot is supplied", () => {
    const trustHistory: TrustSnapshotEntry[] = [
      {
        step: 1,
        snapshot: {
          controller_a: {
            status: "HEALTHY",
            trust: 1,
            fault_streak: 0,
            clean_streak: 1,
            repeat_count: 0,
          },
          controller_b: {
            status: "HEALTHY",
            trust: 1,
            fault_streak: 0,
            clean_streak: 1,
            repeat_count: 0,
          },
        },
      },
      {
        step: 2,
        snapshot: {
          controller_a: {
            status: "HEALTHY",
            trust: 0.92,
            fault_streak: 0,
            clean_streak: 2,
            repeat_count: 0,
          },
          controller_b: {
            status: "DEGRADED",
            trust: 0.5,
            fault_streak: 3,
            clean_streak: 0,
            repeat_count: 0,
          },
        },
      },
    ];
    render(<TrustEvolution timeline={[]} trustHistory={trustHistory} />);
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("DEGRADED")).toBeTruthy();
  });

  it("orders controller rows controller_a → controller_b → controller_c", () => {
    const snapshot: Record<string, ComponentTrustSnapshot> = {
      controller_c: {
        status: "HEALTHY",
        trust: 0.9,
        fault_streak: 0,
        clean_streak: 1,
        repeat_count: 0,
      },
      controller_a: {
        status: "HEALTHY",
        trust: 0.9,
        fault_streak: 0,
        clean_streak: 1,
        repeat_count: 0,
      },
      controller_b: {
        status: "HEALTHY",
        trust: 0.9,
        fault_streak: 0,
        clean_streak: 1,
        repeat_count: 0,
      },
    };
    const { container } = render(<TrustEvolution timeline={[]} trustSnapshot={snapshot} />);
    const rows = Array.from(
      container.querySelectorAll('[data-testid^="trust-current-controller_"]')
    ).map((el) => el.getAttribute("data-testid"));
    expect(rows).toEqual([
      "trust-current-controller_a",
      "trust-current-controller_b",
      "trust-current-controller_c",
    ]);
  });
});
