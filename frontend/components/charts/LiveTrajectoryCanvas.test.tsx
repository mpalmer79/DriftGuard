// Vitest + RTL coverage for LiveTrajectoryCanvas.
// Verifies render structure, mode-band/segment counts, corridor scaling,
// reduced-motion behavior, and accessibility.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { LiveTrajectoryCanvas } from "./LiveTrajectoryCanvas";
import type { TrajectoryPoint } from "@/types/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makePoint(
  step: number,
  x: number,
  y: number,
  mode: TrajectoryPoint["system_mode"] = "NORMAL"
): TrajectoryPoint {
  return {
    step,
    timestamp: step * 100,
    position_x: x,
    position_y: y,
    altitude: 100 + step,
    system_mode: mode,
  };
}

const trustHigh = (): number => 1;
const trustLow = (): number => 0.2;

describe("LiveTrajectoryCanvas", () => {
  it("renders the empty state when points.length === 0", () => {
    render(
      <LiveTrajectoryCanvas
        points={[]}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={false}
      />
    );
    expect(screen.getByText(/No trajectory data yet/i)).toBeTruthy();
    expect(screen.queryByTestId("live-trajectory-marker")).toBeNull();
  });

  it("renders one polyline segment per consecutive trajectory mode run", () => {
    // Three runs: NORMAL, DEGRADED, SAFE_MODE.
    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0, "NORMAL"),
      makePoint(1, 1, 1, "NORMAL"),
      makePoint(2, 2, 2, "DEGRADED"),
      makePoint(3, 3, 3, "DEGRADED"),
      makePoint(4, 4, 4, "SAFE_MODE"),
    ];
    const { container } = render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    const segGroup = container.querySelector('[data-testid="live-trajectory-segments"]');
    expect(segGroup).toBeTruthy();
    const polylines = segGroup?.querySelectorAll("polyline") ?? [];
    expect(polylines.length).toBe(3);
  });

  it("renders one rect per point in the mode band", () => {
    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0, "NORMAL"),
      makePoint(1, 1, 1, "NORMAL"),
      makePoint(2, 2, 2, "DEGRADED"),
      makePoint(3, 3, 3, "SAFE_MODE"),
    ];
    const { container } = render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    const band = container.querySelector('[data-testid="live-trajectory-mode-band"]');
    expect(band).toBeTruthy();
    const rects = band?.querySelectorAll("rect") ?? [];
    expect(rects.length).toBe(points.length);
  });

  it("step label renders STEP 5 / 25 when currentStep === 4 and points.length === 25", () => {
    const points: TrajectoryPoint[] = Array.from({ length: 25 }, (_unused, i) =>
      makePoint(i, i, i)
    );
    render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={4}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    const label = screen.getByTestId("live-trajectory-step-label");
    expect(label.textContent).toContain("STEP 5 / 25");
  });

  it("corridor stroke-width is wider when controller trust is 0.2 vs 1.0", () => {
    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0),
      makePoint(1, 5, 5),
      makePoint(2, 10, 10),
    ];

    const { container: highContainer } = render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={1}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    const highCorridor = highContainer.querySelector(
      '[data-testid="live-trajectory-corridor"]'
    );
    const highWidth = Number(highCorridor?.getAttribute("stroke-width"));

    cleanup();

    const { container: lowContainer } = render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={1}
        controllerTrustAtStep={trustLow}
        prefersReducedMotion={true}
      />
    );
    const lowCorridor = lowContainer.querySelector(
      '[data-testid="live-trajectory-corridor"]'
    );
    const lowWidth = Number(lowCorridor?.getAttribute("stroke-width"));

    expect(Number.isFinite(highWidth)).toBe(true);
    expect(Number.isFinite(lowWidth)).toBe(true);
    expect(lowWidth).toBeGreaterThan(highWidth);
  });

  it("schedules no requestAnimationFrame calls when prefersReducedMotion is true", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 0);

    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0),
      makePoint(1, 5, 5),
      makePoint(2, 10, 10),
    ];

    const { rerender } = render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    rerender(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={1}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    rerender(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={2}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );

    expect(rafSpy).toHaveBeenCalledTimes(0);
  });

  it("schedules at least one requestAnimationFrame call when prefersReducedMotion is false", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 0);

    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0),
      makePoint(1, 5, 5),
      makePoint(2, 10, 10),
    ];

    render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={false}
      />
    );

    expect(rafSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("exposes an accessible aria-label on the wrapper and svg", () => {
    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0),
      makePoint(1, 5, 5),
    ];
    render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={0}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    expect(screen.getByRole("region", { name: /Live vehicle trajectory/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Live vehicle trajectory/i })).toBeTruthy();
  });

  it("does not crash when points.length === 1", () => {
    const points: TrajectoryPoint[] = [makePoint(0, 7, 9)];
    expect(() =>
      render(
        <LiveTrajectoryCanvas
          points={points}
          currentStep={0}
          controllerTrustAtStep={trustHigh}
          prefersReducedMotion={true}
        />
      )
    ).not.toThrow();
    expect(screen.getByTestId("live-trajectory-marker")).toBeTruthy();
    expect(screen.getByTestId("live-trajectory-step-label").textContent).toContain(
      "STEP 1 / 1"
    );
  });

  it("places the marker at the projected position of points[currentStep] initially", () => {
    // Two points, currentStep=1 → marker should be at the projected
    // position of the second point. With the projection logic copied
    // from TrajectoryMap and these inputs, the second point projects
    // to the right edge of the inner box at (330, 30) for SIZE=360
    // and MARGIN=30 (extreme of x, extreme of -y).
    const points: TrajectoryPoint[] = [
      makePoint(0, 0, 0, "NORMAL"),
      makePoint(1, 10, 10, "NORMAL"),
    ];
    render(
      <LiveTrajectoryCanvas
        points={points}
        currentStep={1}
        controllerTrustAtStep={trustHigh}
        prefersReducedMotion={true}
      />
    );
    const marker = screen.getByTestId("live-trajectory-marker");
    const transform = marker.getAttribute("transform") ?? "";
    // Expect translate near (330, 30) (allow numeric formatting).
    const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
    expect(match).not.toBeNull();
    if (match) {
      const tx = Number(match[1]);
      const ty = Number(match[2]);
      expect(tx).toBeCloseTo(330, 1);
      expect(ty).toBeCloseTo(30, 1);
    }
  });
});
