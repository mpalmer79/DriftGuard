// FaultEvidenceCard — operator readout for a single FaultRecord.
//
// Coverage targets:
//   * humanises known fault type tokens and renders the
//     interpretation line from the lookup table
//   * unknown types fall back to a generic phrase that still
//     surfaces the raw token
//   * severity chip + window range render from the props
//   * raw-metadata disclosure renders the JSON blob

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { FaultEvidenceCard } from "./FaultEvidenceCard";
import type { FaultRecord } from "@/types/api";

const BASE: FaultRecord = {
  fault_id: "fault-A",
  type: "SENSOR_DRIFT",
  target: "barometer",
  start_step: 10,
  end_step: 25,
  severity: "WARNING",
  metadata: { rate_per_step: 0.4, axis: "altitude" },
};

afterEach(() => cleanup());

describe("FaultEvidenceCard", () => {
  it("humanises the fault type token in the title", () => {
    render(<FaultEvidenceCard fault={BASE} />);
    expect(screen.getByText("Sensor Drift")).toBeTruthy();
  });

  it("renders the operator interpretation for a known type", () => {
    render(<FaultEvidenceCard fault={BASE} />);
    expect(screen.getByText(/Sensor reading is drifting from truth\./i)).toBeTruthy();
  });

  it("renders a generic fallback line for an unknown fault type", () => {
    const unknown: FaultRecord = { ...BASE, type: "QUANTUM_ANOMALY" };
    render(<FaultEvidenceCard fault={unknown} />);
    // Fallback should mention the raw token so the operator still
    // has something to grep on.
    expect(screen.getByText(/Unrecognized fault category \(QUANTUM_ANOMALY\)/i)).toBeTruthy();
  });

  it("renders severity chip, target, and step range", () => {
    render(<FaultEvidenceCard fault={BASE} />);
    expect(screen.getByText("WARNING")).toBeTruthy();
    expect(screen.getByText("barometer")).toBeTruthy();
    expect(screen.getByText("10 → 25")).toBeTruthy();
  });

  it("renders 'ongoing' when end_step is null", () => {
    const ongoing: FaultRecord = { ...BASE, end_step: null };
    render(<FaultEvidenceCard fault={ongoing} />);
    expect(screen.getByText("ongoing")).toBeTruthy();
  });

  it("includes a disclosure with the raw metadata as JSON", () => {
    render(<FaultEvidenceCard fault={BASE} />);
    const summary = screen.getByText(/Show raw fault metadata/i);
    expect(summary).toBeTruthy();
    const raw = screen.getByTestId("fault-evidence-raw");
    expect(raw.textContent).toMatch(/rate_per_step/);
    expect(raw.textContent).toMatch(/altitude/);
  });

  it("renders CRITICAL severity with the failure status token classes", () => {
    const crit: FaultRecord = { ...BASE, severity: "CRITICAL" };
    render(<FaultEvidenceCard fault={crit} />);
    const chip = screen.getByText("CRITICAL");
    expect(chip.className).toMatch(/status-failed/);
  });
});
