import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { InfoCallout } from "./InfoCallout";

afterEach(() => cleanup());

describe("InfoCallout", () => {
  it("defaults to the neutral tone and renders children", () => {
    render(
      <InfoCallout>
        Determinism replays bit-for-bit when the seed and scenario are pinned.
      </InfoCallout>
    );
    const node = screen.getByRole("note");
    expect(node.getAttribute("data-tone")).toBe("neutral");
    expect(
      screen.getByText(/Determinism replays bit-for-bit when the seed and scenario are pinned\./i)
    ).toBeTruthy();
  });

  it("routes each tone to data-tone and shows the title when provided", () => {
    const { rerender } = render(
      <InfoCallout tone="info" title="REPLAY FINGERPRINT">
        body
      </InfoCallout>
    );
    expect(screen.getByRole("note").getAttribute("data-tone")).toBe("info");
    expect(screen.getByText("REPLAY FINGERPRINT")).toBeTruthy();

    rerender(
      <InfoCallout tone="warning" title="OPERATOR ATTENTION">
        body
      </InfoCallout>
    );
    expect(screen.getByRole("note").getAttribute("data-tone")).toBe("warning");
    expect(screen.getByText("OPERATOR ATTENTION")).toBeTruthy();
  });

  it("omits the title element when no title is provided", () => {
    render(<InfoCallout>body only</InfoCallout>);
    expect(screen.getByText("body only")).toBeTruthy();
    const note = screen.getByRole("note");
    expect(note.querySelector("p")).toBeNull();
  });
});
