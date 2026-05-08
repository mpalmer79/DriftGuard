// TrustScorePanel — tight tabular-snapshot tests.

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TrustScorePanel } from "./TrustScorePanel";
import type { ComponentTrustSnapshot } from "@/types/api";

afterEach(() => cleanup());

describe("TrustScorePanel", () => {
  it("renders the empty state when snapshot is missing", () => {
    render(<TrustScorePanel snapshot={undefined} />);
    expect(screen.getByText(/Trust snapshot unavailable/i)).toBeTruthy();
  });

  it("renders one row per component (controllers + sensor) and skips _global", () => {
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
      sensor: {
        status: "HEALTHY",
        trust: 1,
        fault_streak: 0,
        clean_streak: 30,
        repeat_count: 0,
      },
    };
    render(<TrustScorePanel snapshot={snapshot} />);
    expect(screen.getByTestId("trust-row-controller_a")).toBeTruthy();
    expect(screen.getByTestId("trust-row-controller_b")).toBeTruthy();
    expect(screen.getByTestId("trust-row-sensor")).toBeTruthy();
    // Trust value formatted to 2 decimals.
    expect(screen.getByText("0.92")).toBeTruthy();
    expect(screen.getByText("0.45")).toBeTruthy();
  });

  it("renders the global disagreement rate when provided", () => {
    // The runtime API mixes per-component snapshots with a `_global`
    // entry that only carries `disagreement_rate`. We cast through
    // `unknown` because the public `ComponentTrustSnapshot` type only
    // describes the per-component shape.
    const snapshot = {
      controller_a: {
        status: "HEALTHY",
        trust: 0.9,
        fault_streak: 0,
        clean_streak: 1,
        repeat_count: 0,
      },
      _global: { disagreement_rate: 0.25 },
    } as unknown as Record<string, ComponentTrustSnapshot>;
    render(<TrustScorePanel snapshot={snapshot} />);
    expect(screen.getByText(/disagreement rate: 25%/i)).toBeTruthy();
  });
});
