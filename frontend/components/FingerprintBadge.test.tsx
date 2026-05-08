import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FingerprintBadge } from "./FingerprintBadge";

const HASH = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("FingerprintBadge", () => {
  it("truncates the hash with full hash in title/aria-label", () => {
    render(<FingerprintBadge fingerprint={HASH} />);
    const hash = screen.getByTestId("fingerprint-badge-hash");
    expect(hash.textContent).toBe(`${HASH.slice(0, 8)}…${HASH.slice(-8)}`);
    expect(hash.getAttribute("title")).toBe(HASH);
    expect(hash.getAttribute("aria-label")).toBe(`fingerprint ${HASH}`);
  });

  it("renders an optional label", () => {
    render(<FingerprintBadge fingerprint={HASH} label="RUN A" />);
    expect(screen.getByText("RUN A")).toBeTruthy();
  });

  it("copies the full hash and flips to 'Copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<FingerprintBadge fingerprint={HASH} />);
    const button = screen.getByTestId("fingerprint-badge-copy");
    expect(button.textContent).toBe("Copy");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith(HASH);
    await waitFor(() => {
      expect(button.textContent).toBe("Copied");
    });
  });

  it("does not throw if clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    render(<FingerprintBadge fingerprint={HASH} />);
    const button = screen.getByTestId("fingerprint-badge-copy");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toBe("Copy");
  });
});
