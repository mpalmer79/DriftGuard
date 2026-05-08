// ReplayExplainer — replay fingerprint inline panel tests.
//
// Coverage:
//   * empty state when fingerprint is null
//   * truncated hash with full hash in title/aria-label
//   * three-bullet explanation list
//   * "How verified" line links to docs/DETERMINISM.md and
//     docs/formal/SafeMode.tla
//   * copy button calls navigator.clipboard.writeText with the full
//     hash and flips to "Copied" briefly

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReplayExplainer } from "./ReplayExplainer";

const FINGERPRINT = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ReplayExplainer", () => {
  it("renders an empty state when fingerprint is null", () => {
    render(<ReplayExplainer simulationId="sim-1" fingerprint={null} stepCount={0} />);
    expect(screen.queryByTestId("replay-explainer")).toBeNull();
    expect(screen.getByTestId("replay-explainer-empty")).toBeTruthy();
    expect(screen.getByText(/NO FINGERPRINT YET/i)).toBeTruthy();
  });

  it("truncates the hash and exposes the full hash in title/aria-label", () => {
    render(
      <ReplayExplainer simulationId="sim-1234abcd" fingerprint={FINGERPRINT} stepCount={120} />
    );
    const hash = screen.getByTestId("replay-fingerprint-hash");
    // Truncated form is first 8 chars … last 8 chars.
    expect(hash.textContent).toBe(`${FINGERPRINT.slice(0, 8)}…${FINGERPRINT.slice(-8)}`);
    expect(hash.getAttribute("title")).toBe(FINGERPRINT);
    expect(hash.getAttribute("aria-label")).toBe(`Replay fingerprint ${FINGERPRINT}`);
  });

  it("renders the three-bullet explanation and verification links", () => {
    render(<ReplayExplainer simulationId="sim-1" fingerprint={FINGERPRINT} stepCount={120} />);
    expect(screen.getByText(/Same seed produces the same trajectory/i)).toBeTruthy();
    expect(screen.getByText(/Same trajectory produces the same fingerprint/i)).toBeTruthy();
    expect(screen.getByText(/A regression changes the fingerprint/i)).toBeTruthy();

    const determinism = screen.getByText("docs/DETERMINISM.md");
    expect(determinism.getAttribute("href")).toBe("docs/DETERMINISM.md");
    const tla = screen.getByText("docs/formal/SafeMode.tla");
    expect(tla.getAttribute("href")).toBe("docs/formal/SafeMode.tla");
  });

  it("copies the full hash via navigator.clipboard.writeText and shows 'Copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<ReplayExplainer simulationId="sim-1" fingerprint={FINGERPRINT} stepCount={120} />);
    const button = screen.getByTestId("replay-fingerprint-copy");
    expect(button.textContent).toBe("Copy");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(FINGERPRINT);

    // The copy hint flips the label to "Copied" until the timer
    // fires. We just assert the visible state — timing is covered
    // by the next test.
    await waitFor(() => {
      expect(button.textContent).toBe("Copied");
    });
  });

  it("reverts the 'Copied' hint after the transient timeout", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    vi.useFakeTimers();
    render(<ReplayExplainer simulationId="sim-1" fingerprint={FINGERPRINT} stepCount={120} />);

    const button = screen.getByTestId("replay-fingerprint-copy");
    await act(async () => {
      fireEvent.click(button);
      // Resolve the awaited writeText promise.
      await Promise.resolve();
    });

    expect(button.textContent).toBe("Copied");

    // Advance past the 1.5s hint window.
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(button.textContent).toBe("Copy");
  });
});
