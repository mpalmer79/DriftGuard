import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReplayVerificationPanel } from "./ReplayVerificationPanel";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

vi.mock("@/lib/api", () => {
  return {
    api: {
      runScenario: vi.fn(),
      getReplayFingerprint: vi.fn(),
    },
  };
});

import { api } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReplayVerificationPanel", () => {
  it("renders the empty surface when fingerprint is null", () => {
    render(
      <ReplayVerificationPanel
        simulationId="sim-1"
        fingerprint={null}
        stepCount={0}
        scenarioName={null}
      />
    );
    expect(screen.getByTestId("replay-verification-panel-empty")).toBeTruthy();
  });

  it("shows the manual-verification gap callout when no scenario name is given", () => {
    render(
      <ReplayVerificationPanel
        simulationId="sim-1"
        fingerprint={HASH_A}
        stepCount={5}
        scenarioName={null}
      />
    );
    expect(screen.getByTestId("replay-verification-panel")).toBeTruthy();
    expect(screen.getByText(/MANUAL VERIFICATION ONLY/i)).toBeTruthy();
    expect(screen.queryByTestId("replay-verify-rerun")).toBeNull();
  });

  it("re-runs scenario and reports a match when fingerprints agree", async () => {
    (api.runScenario as ReturnType<typeof vi.fn>).mockResolvedValue({
      simulation_id: "rerun-sim",
    });
    (api.getReplayFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue({
      simulation_id: "rerun-sim",
      step_count: 5,
      fingerprint: HASH_A,
      algorithm: "sha256",
    });

    render(
      <ReplayVerificationPanel
        simulationId="sim-1"
        fingerprint={HASH_A}
        stepCount={5}
        scenarioName="nominal_cruise"
      />
    );

    const button = screen.getByTestId("replay-verify-rerun");
    expect(button.textContent).toContain("Re-run nominal_cruise");

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId("replay-verify-result-match")).toBeTruthy();
    });
    expect(api.runScenario).toHaveBeenCalledWith("nominal_cruise", 5);
  });

  it("reports a mismatch when re-run fingerprint differs", async () => {
    (api.runScenario as ReturnType<typeof vi.fn>).mockResolvedValue({
      simulation_id: "rerun-sim",
    });
    (api.getReplayFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue({
      simulation_id: "rerun-sim",
      step_count: 5,
      fingerprint: HASH_B,
      algorithm: "sha256",
    });

    render(
      <ReplayVerificationPanel
        simulationId="sim-1"
        fingerprint={HASH_A}
        stepCount={5}
        scenarioName="nominal_cruise"
      />
    );
    const button = screen.getByTestId("replay-verify-rerun");
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(screen.getByTestId("replay-verify-result-mismatch")).toBeTruthy();
    });
  });

  it("surfaces an error callout when verification request fails", async () => {
    (api.runScenario as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("backend down"));

    render(
      <ReplayVerificationPanel
        simulationId="sim-1"
        fingerprint={HASH_A}
        stepCount={5}
        scenarioName="nominal_cruise"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("replay-verify-rerun"));
    });
    await waitFor(() => {
      expect(screen.getByText(/VERIFICATION FAILED/i)).toBeTruthy();
      expect(screen.getByText(/backend down/i)).toBeTruthy();
    });
  });
});
