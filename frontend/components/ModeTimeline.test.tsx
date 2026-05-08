// ModeTimeline — unit tests covering segment collapsing, range
// labels, the empty state, the currentStep cursor highlight, and the
// hover/title attribute that surfaces per-segment justification.

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ModeTimeline, buildSegments } from "./ModeTimeline";
import type { DecisionRecord } from "@/types/api";

function decision(
  step: number,
  mode: DecisionRecord["system_mode"],
  justification = ""
): DecisionRecord {
  return {
    step,
    final_action: "HOLD",
    system_mode: mode,
    safe_mode_active: mode === "SAFE_MODE" || mode === "FAILED",
    justification,
    trusted_controllers: [],
    rejected_controllers: [],
  };
}

afterEach(() => cleanup());

describe("ModeTimeline.buildSegments", () => {
  it("collapses adjacent steps that share the same mode into one segment", () => {
    const segments = buildSegments([
      decision(1, "NORMAL"),
      decision(2, "NORMAL"),
      decision(3, "NORMAL"),
      decision(4, "DEGRADED"),
      decision(5, "DEGRADED"),
      decision(6, "SAFE_MODE"),
    ]);
    expect(segments.length).toBe(3);
    expect(segments[0]).toMatchObject({ mode: "NORMAL", startStep: 1, endStep: 3 });
    expect(segments[1]).toMatchObject({ mode: "DEGRADED", startStep: 4, endStep: 5 });
    expect(segments[2]).toMatchObject({ mode: "SAFE_MODE", startStep: 6, endStep: 6 });
  });

  it("uses the first decision in each segment for the justification", () => {
    const segments = buildSegments([
      decision(1, "NORMAL", "boot ok"),
      decision(2, "NORMAL", "still ok"),
      decision(3, "DEGRADED", "sensor fault detected"),
      decision(4, "DEGRADED", "still degraded"),
    ]);
    expect(segments[0].justification).toBe("boot ok");
    expect(segments[1].justification).toBe("sensor fault detected");
  });

  it("sorts unsorted input by step before collapsing", () => {
    const segments = buildSegments([
      decision(3, "NORMAL"),
      decision(1, "NORMAL"),
      decision(2, "NORMAL"),
    ]);
    expect(segments.length).toBe(1);
    expect(segments[0]).toMatchObject({ startStep: 1, endStep: 3 });
  });

  it("returns an empty array for empty input", () => {
    expect(buildSegments([])).toEqual([]);
  });
});

describe("ModeTimeline render", () => {
  it("renders the empty-state hint when decisions list is empty", () => {
    render(<ModeTimeline decisions={[]} />);
    expect(screen.getByTestId("mode-timeline-empty")).toBeTruthy();
    expect(screen.getByText(/Run a step to see mode transitions/i)).toBeTruthy();
  });

  it("renders one segment per collapsed mode run with range labels", () => {
    render(
      <ModeTimeline
        decisions={[
          decision(1, "NORMAL", "boot"),
          decision(2, "NORMAL"),
          decision(3, "DEGRADED", "drift"),
          decision(4, "SAFE_MODE", "voter split"),
        ]}
      />
    );
    const segs = screen.getAllByTestId("mode-timeline-segment");
    expect(segs.length).toBe(3);
    expect(segs[0].getAttribute("data-mode")).toBe("NORMAL");
    expect(segs[0].getAttribute("data-start")).toBe("1");
    expect(segs[0].getAttribute("data-end")).toBe("2");
    // step 3 alone → "step 3" (no en-dash range).
    expect(segs[1].textContent).toMatch(/step 3/);
    // step 4 alone → "step 4".
    expect(segs[2].textContent).toMatch(/step 4/);
  });

  it("surfaces the segment justification via the title attribute", () => {
    render(
      <ModeTimeline
        decisions={[
          decision(1, "NORMAL", "boot ok"),
          decision(2, "DEGRADED", "sensor fault detected"),
        ]}
      />
    );
    const segs = screen.getAllByTestId("mode-timeline-segment");
    expect(segs[0].getAttribute("title")).toMatch(/boot ok/);
    expect(segs[1].getAttribute("title")).toMatch(/sensor fault detected/);
  });

  it("marks the segment containing currentStep as active", () => {
    render(
      <ModeTimeline
        decisions={[
          decision(1, "NORMAL"),
          decision(2, "NORMAL"),
          decision(3, "DEGRADED"),
          decision(4, "DEGRADED"),
          decision(5, "SAFE_MODE"),
        ]}
        currentStep={4}
      />
    );
    const segs = screen.getAllByTestId("mode-timeline-segment");
    // Segment 0 = steps 1–2 (NORMAL), segment 1 = 3–4 (DEGRADED), segment 2 = 5 (SAFE_MODE).
    expect(segs[0].getAttribute("data-active")).toBe("false");
    expect(segs[1].getAttribute("data-active")).toBe("true");
    expect(segs[2].getAttribute("data-active")).toBe("false");
    expect(segs[1].className).toMatch(/ring-2/);
    expect(screen.getByText(/Cursor: step 4/i)).toBeTruthy();
  });
});
