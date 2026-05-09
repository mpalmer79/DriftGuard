import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReplayNarrator } from "./ReplayNarrator";
import type { DecisionRecord, FaultRecord } from "@/types/api";

const BASE_DECISION: DecisionRecord = {
  step: 0,
  final_action: "MAINTAIN",
  system_mode: "NORMAL",
  safe_mode_active: false,
  justification: "all clear",
  trusted_controllers: ["primary", "secondary", "tertiary"],
  rejected_controllers: [],
  previous_mode: "NORMAL",
  trigger_reason: "all components healthy",
  active_fault_ids: [],
  detector_findings: [],
};

function buildFault(overrides: Partial<FaultRecord> = {}): FaultRecord {
  return {
    fault_id: "fault-1",
    type: "SENSOR_DRIFT",
    target: "barometer",
    start_step: 1,
    end_step: null,
    severity: "WARNING",
    metadata: {},
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("ReplayNarrator", () => {
  it("renders the NORMAL status sentence with no cause line when healthy and no faults", () => {
    render(<ReplayNarrator decision={BASE_DECISION} faults={[]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para).not.toBeNull();
    expect(para?.textContent).toBe(
      "All three controllers agree. The system is operating normally."
    );
    expect(para?.textContent).not.toMatch(/Active fault:/);
    expect(para?.textContent).not.toMatch(/A sensor/);
  });

  it("renders the SAFE_MODE status sentence", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "SAFE_MODE",
      trigger_reason: "low confidence",
    };
    render(<ReplayNarrator decision={decision} faults={[]} />);
    expect(
      screen.getByText(
        /The system has lost confidence in its inputs\. It is restricted to safe actions only\./
      )
    ).toBeTruthy();
  });

  it("renders the DEGRADED status sentence", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "controller disagreement",
    };
    render(<ReplayNarrator decision={decision} faults={[]} />);
    expect(
      screen.getByText(
        /One controller is unhealthy\. The system is still producing actions, but with restrictions\./
      )
    ).toBeTruthy();
  });

  it("renders the FAILED status sentence", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "FAILED",
      trigger_reason: "critical fault",
    };
    render(<ReplayNarrator decision={decision} faults={[]} />);
    expect(screen.getByText(/Multiple critical failures\. The system has aborted\./)).toBeTruthy();
  });

  it("appends 'Active fault: a sensor stopped reporting.' for SENSOR_DROPOUT", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "controller disagreement",
    };
    const fault = buildFault({ type: "SENSOR_DROPOUT", fault_id: "f-dropout" });
    render(<ReplayNarrator decision={decision} faults={[fault]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para?.textContent).toMatch(/Active fault: a sensor stopped reporting\./);
  });

  it("appends 'Active fault: a controller is responding too slowly.' for CONTROLLER_LATENCY", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "controller disagreement",
    };
    const fault = buildFault({ type: "CONTROLLER_LATENCY", fault_id: "f-latency" });
    render(<ReplayNarrator decision={decision} faults={[fault]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para?.textContent).toMatch(/Active fault: a controller is responding too slowly\./);
  });

  it("renders the trigger-reason sentence for 'sensor drift detected' (case-insensitive)", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "Sensor Drift Detected",
    };
    render(<ReplayNarrator decision={decision} faults={[]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para?.textContent).toMatch(/A sensor is reporting drifting values\./);
  });

  it("renders only the muted 'Awaiting first decision…' paragraph when decision is null", () => {
    render(<ReplayNarrator decision={null} faults={[]} />);
    const section = screen.getByTestId("replay-narrator");
    const paras = section.querySelectorAll("p");
    expect(paras.length).toBe(1);
    expect(paras[0].textContent).toBe("Awaiting first decision…");
    expect(paras[0].className).toMatch(/text-text-muted/);
    expect(paras[0].className).toMatch(/italic/);
    // No status or cause sentences.
    expect(section.textContent).not.toMatch(/All three controllers agree/);
    expect(section.textContent).not.toMatch(/Active fault:/);
  });

  it("falls back to the lowercased hyphen-replaced fault type for unmapped types", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "controller disagreement",
    };
    const fault = buildFault({ type: "COMPOUND_FAULT", fault_id: "f-compound" });
    render(<ReplayNarrator decision={decision} faults={[fault]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para?.textContent).toMatch(/Active fault: compound-fault\./);
  });

  it("omits the trigger-reason sentence for an unmapped reason", () => {
    const decision: DecisionRecord = {
      ...BASE_DECISION,
      system_mode: "DEGRADED",
      trigger_reason: "weird reason",
    };
    render(<ReplayNarrator decision={decision} faults={[]} />);
    const para = screen.getByTestId("replay-narrator").querySelector("p");
    expect(para?.textContent).toBe(
      "One controller is unhealthy. The system is still producing actions, but with restrictions."
    );
    // No technical jargon should leak through.
    expect(para?.textContent).not.toMatch(/weird reason/i);
  });

  it("exposes role='status' and aria-live='polite' on the section", () => {
    render(<ReplayNarrator decision={BASE_DECISION} faults={[]} />);
    const section = screen.getByTestId("replay-narrator");
    expect(section.getAttribute("role")).toBe("status");
    expect(section.getAttribute("aria-live")).toBe("polite");
  });
});
